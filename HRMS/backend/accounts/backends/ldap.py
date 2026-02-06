"""
LDAP/LDAPS (Active Directory) authentication backend.
"""

import logging
from django.contrib.auth import get_user_model
from django.contrib.auth.backends import BaseBackend

from .base import MultiProviderBackendMixin

logger = logging.getLogger(__name__)
User = get_user_model()


class LDAPAuthBackend(MultiProviderBackendMixin, BaseBackend):
    """
    LDAP/LDAPS authentication backend for Active Directory.
    Configuration is loaded from AuthProvider model in database.
    """
    provider_type = 'LDAP'

    def authenticate(self, request, username=None, password=None, **kwargs):
        """
        Authenticate user against LDAP/Active Directory.

        Args:
            request: HTTP request
            username: LDAP username (sAMAccountName or email)
            password: LDAP password
        """
        if not username or not password:
            return None

        provider = self.get_provider()
        if not provider:
            logger.debug("LDAP authentication provider not enabled")
            return None

        config = provider.config
        if not config.get('server_uri'):
            logger.error("LDAP server_uri not configured")
            return None

        try:
            # Import ldap here to avoid import errors if not installed
            import ldap

            # Perform LDAP authentication
            user_info = self._ldap_authenticate(username, password, config)

            if not user_info:
                self.log_auth_event(
                    'LDAP_FAILED',
                    username,
                    provider=provider,
                    request=request,
                    extra_data={'reason': 'LDAP authentication failed'}
                )
                return None

            email = user_info.get('email', '').lower()
            if not email:
                logger.error(f"No email found for LDAP user {username}")
                return None

            # Check domain restrictions
            if not provider.check_domain_allowed(email):
                self.log_auth_event(
                    'LDAP_FAILED',
                    email,
                    provider=provider,
                    request=request,
                    extra_data={'reason': 'Domain not allowed'}
                )
                return None

            # Get or create user
            user_data = {
                'first_name': user_info.get('first_name', ''),
                'last_name': user_info.get('last_name', ''),
                'external_id': user_info.get('object_guid', ''),
            }

            user, created = self.get_or_create_user(email, user_data, provider)

            if not user:
                self.log_auth_event(
                    'LDAP_FAILED',
                    email,
                    provider=provider,
                    request=request,
                    extra_data={'reason': 'User provisioning disabled'}
                )
                return None

            # Update user info from LDAP if needed
            self.update_user_from_provider(user, user_data)

            # Ensure user is marked as external auth
            if not user.is_external_auth:
                user.is_external_auth = True
                user.can_change_password = False
                user.auth_source = 'LDAP'
                user.save(update_fields=['is_external_auth', 'can_change_password', 'auth_source'])

            # Link user to provider
            self.link_user_to_provider(
                user, provider,
                external_id=user_info.get('object_guid'),
                external_username=username,
                provider_data={
                    'dn': user_info.get('dn'),
                    'groups': user_info.get('groups', []),
                }
            )

            # Try to link to employee
            if created:
                self.link_to_employee(user, email)

            self.log_auth_event(
                'LDAP_SUCCESS',
                email,
                user=user,
                provider=provider,
                request=request,
                extra_data={'created': created}
            )

            logger.info(f"LDAP authentication successful for {email}")
            return user

        except ImportError:
            logger.error("python-ldap not installed")
            return None
        except Exception as e:
            logger.exception(f"LDAP authentication error: {e}")
            self.log_auth_event(
                'LDAP_FAILED',
                username,
                provider=provider,
                request=request,
                extra_data={'reason': str(e)}
            )
            return None

    def _ldap_authenticate(self, username, password, config):
        """
        Perform LDAP bind and retrieve user info.

        Returns:
            dict with user info or None if authentication failed
        """
        import ldap

        server_uri = config['server_uri']
        bind_dn = config.get('bind_dn', '')
        bind_password = config.get('bind_password', '')
        user_search_base = config.get('user_search_base', '')
        user_search_filter = config.get('user_search_filter', '(sAMAccountName=%(user)s)')

        # Attribute mapping
        email_attr = config.get('email_attr', 'mail')
        first_name_attr = config.get('first_name_attr', 'givenName')
        last_name_attr = config.get('last_name_attr', 'sn')

        conn = None
        try:
            # Initialize connection
            conn = ldap.initialize(server_uri)
            conn.set_option(ldap.OPT_PROTOCOL_VERSION, 3)
            conn.set_option(ldap.OPT_REFERRALS, 0)

            # SSL options for LDAPS
            if server_uri.startswith('ldaps://'):
                conn.set_option(ldap.OPT_X_TLS_REQUIRE_CERT, ldap.OPT_X_TLS_DEMAND)
                if config.get('ca_cert_path'):
                    conn.set_option(ldap.OPT_X_TLS_CACERTFILE, config['ca_cert_path'])

            # Bind with service account to search
            if bind_dn and bind_password:
                conn.simple_bind_s(bind_dn, bind_password)
            else:
                conn.simple_bind_s('', '')  # Anonymous bind

            # Search for user
            search_filter = user_search_filter.replace('%(user)s', ldap.filter.escape_filter_chars(username))
            result = conn.search_s(
                user_search_base,
                ldap.SCOPE_SUBTREE,
                search_filter,
                [email_attr, first_name_attr, last_name_attr, 'objectGUID', 'memberOf']
            )

            if not result:
                logger.warning(f"LDAP user not found: {username}")
                return None

            user_dn, user_attrs = result[0]

            # Try to bind as the user to verify password
            try:
                user_conn = ldap.initialize(server_uri)
                user_conn.set_option(ldap.OPT_PROTOCOL_VERSION, 3)
                user_conn.set_option(ldap.OPT_REFERRALS, 0)
                if server_uri.startswith('ldaps://'):
                    user_conn.set_option(ldap.OPT_X_TLS_REQUIRE_CERT, ldap.OPT_X_TLS_DEMAND)
                    if config.get('ca_cert_path'):
                        user_conn.set_option(ldap.OPT_X_TLS_CACERTFILE, config['ca_cert_path'])
                user_conn.simple_bind_s(user_dn, password)
                user_conn.unbind_s()
            except ldap.INVALID_CREDENTIALS:
                logger.warning(f"LDAP invalid credentials for: {username}")
                return None

            # Extract user info
            def get_attr(attrs, name):
                values = attrs.get(name, [])
                if values:
                    val = values[0]
                    return val.decode('utf-8') if isinstance(val, bytes) else val
                return ''

            # Convert objectGUID to string
            object_guid = ''
            if 'objectGUID' in user_attrs:
                guid_bytes = user_attrs['objectGUID'][0]
                import uuid
                object_guid = str(uuid.UUID(bytes_le=guid_bytes))

            # Extract groups
            groups = []
            if 'memberOf' in user_attrs:
                for group_dn in user_attrs['memberOf']:
                    if isinstance(group_dn, bytes):
                        group_dn = group_dn.decode('utf-8')
                    # Extract CN from DN
                    if group_dn.startswith('CN='):
                        cn = group_dn.split(',')[0][3:]
                        groups.append(cn)

            return {
                'dn': user_dn,
                'email': get_attr(user_attrs, email_attr),
                'first_name': get_attr(user_attrs, first_name_attr),
                'last_name': get_attr(user_attrs, last_name_attr),
                'object_guid': object_guid,
                'groups': groups,
            }

        except ldap.INVALID_CREDENTIALS:
            logger.warning(f"LDAP bind failed - invalid credentials")
            return None
        except ldap.SERVER_DOWN:
            logger.error(f"LDAP server unavailable: {server_uri}")
            return None
        except ldap.LDAPError as e:
            logger.error(f"LDAP error: {e}")
            return None
        finally:
            if conn:
                try:
                    conn.unbind_s()
                except:
                    pass

    def get_user(self, user_id):
        """Get user by ID."""
        try:
            return User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return None

    @classmethod
    def test_connection(cls, config):
        """
        Test LDAP connection with provided configuration.

        Returns:
            tuple: (success: bool, message: str)
        """
        try:
            import ldap

            server_uri = config.get('server_uri', '')
            bind_dn = config.get('bind_dn', '')
            bind_password = config.get('bind_password', '')

            if not server_uri:
                return False, "Server URI is required"

            conn = ldap.initialize(server_uri)
            conn.set_option(ldap.OPT_PROTOCOL_VERSION, 3)
            conn.set_option(ldap.OPT_REFERRALS, 0)
            conn.set_option(ldap.OPT_NETWORK_TIMEOUT, 10)

            if server_uri.startswith('ldaps://'):
                conn.set_option(ldap.OPT_X_TLS_REQUIRE_CERT, ldap.OPT_X_TLS_DEMAND)
                if config.get('ca_cert_path'):
                    conn.set_option(ldap.OPT_X_TLS_CACERTFILE, config['ca_cert_path'])

            if bind_dn and bind_password:
                conn.simple_bind_s(bind_dn, bind_password)
            else:
                conn.simple_bind_s('', '')

            conn.unbind_s()
            return True, "Connection successful"

        except ImportError:
            return False, "python-ldap package not installed"
        except ldap.INVALID_CREDENTIALS:
            return False, "Invalid bind credentials"
        except ldap.SERVER_DOWN:
            return False, f"Cannot connect to LDAP server"
        except ldap.LDAPError as e:
            return False, f"LDAP error: {str(e)}"
        except Exception as e:
            return False, f"Error: {str(e)}"
