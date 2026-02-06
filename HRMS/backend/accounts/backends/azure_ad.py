"""
Azure Active Directory (OAuth2/OIDC) authentication backend.
"""

import logging
import secrets
from django.contrib.auth import get_user_model
from django.contrib.auth.backends import BaseBackend
from django.core.cache import cache

from .base import MultiProviderBackendMixin

logger = logging.getLogger(__name__)
User = get_user_model()


class AzureADBackend(MultiProviderBackendMixin, BaseBackend):
    """
    Azure AD authentication backend using OAuth2/OIDC.
    Configuration is loaded from AuthProvider model in database.
    """
    provider_type = 'AZURE_AD'

    def authenticate(self, request, azure_token=None, **kwargs):
        """
        Authenticate user with Azure AD access token.
        Called after OAuth callback with validated token.

        Args:
            request: HTTP request
            azure_token: Dict with access_token and id_token
        """
        if not azure_token:
            return None

        provider = self.get_provider()
        if not provider:
            logger.debug("Azure AD authentication provider not enabled")
            return None

        try:
            # Get user info from Microsoft Graph API
            user_info = self._get_user_info(azure_token)

            if not user_info:
                self.log_auth_event(
                    'AZURE_FAILED',
                    azure_token.get('email', 'unknown'),
                    provider=provider,
                    request=request,
                    extra_data={'reason': 'Failed to get user info from Graph API'}
                )
                return None

            email = (user_info.get('mail') or user_info.get('userPrincipalName', '')).lower()
            if not email:
                logger.error("No email found in Azure AD user info")
                return None

            # Check domain restrictions
            if not provider.check_domain_allowed(email):
                self.log_auth_event(
                    'AZURE_FAILED',
                    email,
                    provider=provider,
                    request=request,
                    extra_data={'reason': 'Domain not allowed'}
                )
                return None

            # Get or create user
            user_data = {
                'first_name': user_info.get('givenName', ''),
                'last_name': user_info.get('surname', ''),
                'external_id': user_info.get('id', ''),
            }

            user, created = self.get_or_create_user(email, user_data, provider)

            if not user:
                self.log_auth_event(
                    'AZURE_FAILED',
                    email,
                    provider=provider,
                    request=request,
                    extra_data={'reason': 'User provisioning disabled'}
                )
                return None

            # Update user info from Azure AD if needed
            self.update_user_from_provider(user, user_data)

            # Ensure user is marked as external auth
            if not user.is_external_auth:
                user.is_external_auth = True
                user.can_change_password = False
                user.auth_source = 'AZURE_AD'
                user.save(update_fields=['is_external_auth', 'can_change_password', 'auth_source'])

            # Link user to provider
            self.link_user_to_provider(
                user, provider,
                external_id=user_info.get('id'),
                external_username=user_info.get('userPrincipalName'),
                provider_data={
                    'display_name': user_info.get('displayName'),
                    'job_title': user_info.get('jobTitle'),
                    'department': user_info.get('department'),
                    'office_location': user_info.get('officeLocation'),
                }
            )

            # Try to link to employee
            if created:
                self.link_to_employee(user, email)

            self.log_auth_event(
                'AZURE_SUCCESS',
                email,
                user=user,
                provider=provider,
                request=request,
                extra_data={'created': created}
            )

            logger.info(f"Azure AD authentication successful for {email}")
            return user

        except Exception as e:
            logger.exception(f"Azure AD authentication error: {e}")
            self.log_auth_event(
                'AZURE_FAILED',
                azure_token.get('email', 'unknown'),
                provider=provider,
                request=request,
                extra_data={'reason': str(e)}
            )
            return None

    def _get_user_info(self, token):
        """
        Get user info from Microsoft Graph API.

        Args:
            token: Dict with access_token

        Returns:
            dict with user info or None
        """
        import requests

        access_token = token.get('access_token')
        if not access_token:
            return None

        try:
            response = requests.get(
                'https://graph.microsoft.com/v1.0/me',
                headers={'Authorization': f'Bearer {access_token}'},
                timeout=10
            )

            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Graph API error: {response.status_code} - {response.text}")
                return None

        except requests.RequestException as e:
            logger.error(f"Graph API request failed: {e}")
            return None

    def get_user(self, user_id):
        """Get user by ID."""
        try:
            return User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return None

    @classmethod
    def get_authorization_url(cls, config, redirect_uri, state=None):
        """
        Generate Azure AD authorization URL.

        Args:
            config: Provider configuration dict
            redirect_uri: OAuth callback URL
            state: CSRF state parameter (generated if not provided)

        Returns:
            tuple: (auth_url, state)
        """
        try:
            import msal

            tenant_id = config.get('tenant_id', '')
            client_id = config.get('client_id', '')
            authority = config.get('authority', 'https://login.microsoftonline.com')
            scopes = config.get('scopes', ['User.Read'])

            if not tenant_id or not client_id:
                return None, None

            # Generate state if not provided
            if not state:
                state = secrets.token_urlsafe(32)

            # Store state in cache for validation
            cache.set(f'azure_oauth_state_{state}', True, timeout=600)

            app = msal.PublicClientApplication(
                client_id,
                authority=f"{authority}/{tenant_id}"
            )

            auth_url = app.get_authorization_request_url(
                scopes=scopes,
                redirect_uri=redirect_uri,
                state=state
            )

            return auth_url, state

        except ImportError:
            logger.error("msal package not installed")
            return None, None
        except Exception as e:
            logger.error(f"Error generating Azure auth URL: {e}")
            return None, None

    @classmethod
    def exchange_code_for_tokens(cls, config, code, redirect_uri):
        """
        Exchange authorization code for tokens.

        Args:
            config: Provider configuration dict
            code: Authorization code from callback
            redirect_uri: OAuth callback URL (must match original)

        Returns:
            dict with tokens or None
        """
        try:
            import msal

            tenant_id = config.get('tenant_id', '')
            client_id = config.get('client_id', '')
            client_secret = config.get('client_secret', '')
            authority = config.get('authority', 'https://login.microsoftonline.com')
            scopes = config.get('scopes', ['User.Read'])

            if not all([tenant_id, client_id, client_secret]):
                return None

            app = msal.ConfidentialClientApplication(
                client_id,
                client_credential=client_secret,
                authority=f"{authority}/{tenant_id}"
            )

            result = app.acquire_token_by_authorization_code(
                code,
                scopes=scopes,
                redirect_uri=redirect_uri
            )

            if 'access_token' in result:
                return result
            else:
                logger.error(f"Azure token error: {result.get('error_description', 'Unknown error')}")
                return None

        except ImportError:
            logger.error("msal package not installed")
            return None
        except Exception as e:
            logger.error(f"Error exchanging code for tokens: {e}")
            return None

    @classmethod
    def validate_state(cls, state):
        """
        Validate OAuth state parameter.

        Args:
            state: State from callback

        Returns:
            bool: True if valid
        """
        if not state:
            return False
        cache_key = f'azure_oauth_state_{state}'
        if cache.get(cache_key):
            cache.delete(cache_key)  # One-time use
            return True
        return False

    @classmethod
    def test_connection(cls, config):
        """
        Test Azure AD configuration.

        Returns:
            tuple: (success: bool, message: str)
        """
        try:
            import msal

            tenant_id = config.get('tenant_id', '')
            client_id = config.get('client_id', '')
            client_secret = config.get('client_secret', '')
            authority = config.get('authority', 'https://login.microsoftonline.com')

            if not tenant_id:
                return False, "Tenant ID is required"
            if not client_id:
                return False, "Client ID is required"
            if not client_secret:
                return False, "Client Secret is required"

            app = msal.ConfidentialClientApplication(
                client_id,
                client_credential=client_secret,
                authority=f"{authority}/{tenant_id}"
            )

            # Try to get a token for Graph API
            result = app.acquire_token_for_client(
                scopes=['https://graph.microsoft.com/.default']
            )

            if 'access_token' in result:
                return True, "Configuration valid - connected to Azure AD"
            else:
                error = result.get('error_description', result.get('error', 'Unknown error'))
                return False, f"Authentication failed: {error}"

        except ImportError:
            return False, "msal package not installed"
        except Exception as e:
            return False, f"Error: {str(e)}"
