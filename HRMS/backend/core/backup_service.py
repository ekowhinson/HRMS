"""Core engine for tenant data backup and restore."""

import gzip
import hashlib
import json
import logging
import os
import time
from datetime import timedelta

import django
from django.apps import apps
from django.conf import settings
from django.core import serializers
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger('hrms')


class TenantBackupService:
    """Backup and restore tenant data using Django's serialization framework."""

    # Table ordering for backup (respects FK dependencies)
    TABLE_ORDER = [
        # 1. Organization config (no FKs to other tenant data)
        'organization.division', 'organization.directorate',
        'organization.organizationunit', 'organization.department',
        'organization.jobgrade', 'organization.jobcategory',
        'organization.jobposition', 'organization.costcenter',
        'organization.worklocation', 'organization.holiday',

        # 2. Accounts (depends on org structure)
        'accounts.role', 'accounts.permission', 'accounts.rolepermission',
        'accounts.user', 'accounts.userrole',

        # 3. Employee master
        'employees.employee', 'employees.emergencycontact',
        'employees.dependent', 'employees.education',
        'employees.workexperience', 'employees.certification',
        'employees.skill', 'employees.employeebankaccount',
        'employees.employmenthistory',

        # 4. Existing modules
        'payroll.paycomponent', 'payroll.employeesalary',
        'payroll.payrollrun', 'payroll.payrollitem',
        'leave.leavetype', 'leave.leavebalance', 'leave.leaverequest',
        'benefits.loantype', 'benefits.loanaccount',
        'benefits.benefittype', 'benefits.benefitenrollment',
        'benefits.custombenefittype', 'benefits.custombenefitclaim',
        'recruitment.vacancy', 'recruitment.applicant',
        'performance.appraisal',
        'discipline.disciplinarycase',
        'training.trainingprogram',
        'exits.exitrequest',
        'policies.policy',
        'workflow.workflowdefinition',

        # 5. New ERP modules
        'finance.account', 'finance.fiscalyear', 'finance.fiscalperiod',
        'finance.journalentry', 'finance.journalline',
        'finance.budget', 'finance.budgetcommitment',
        'finance.vendor', 'finance.vendorinvoice',
        'finance.customer', 'finance.customerinvoice',
        'finance.organizationbankaccount', 'finance.payment',
        'finance.bankstatement', 'finance.bankstatementline',
        'finance.exchangerate',
        'procurement.purchaserequisition', 'procurement.requisitionitem',
        'procurement.purchaseorder', 'procurement.purchaseorderitem',
        'procurement.goodsreceiptnote', 'procurement.grnitem',
        'procurement.contract', 'procurement.contractmilestone',
        'inventory.itemcategory', 'inventory.item', 'inventory.warehouse',
        'inventory.stockentry', 'inventory.stockledger',
        'inventory.asset', 'inventory.assetdepreciation',
        'inventory.assettransfer', 'inventory.maintenanceschedule',
        'projects.project', 'projects.projecttask', 'projects.resource',
        'projects.timesheet', 'projects.projectbudget',
        'projects.milestone', 'projects.projectbilling',

        # 6. Cross-cutting
        'reports.reportdefinition', 'reports.scheduledreport',
        'core.notification', 'core.announcement', 'core.attachment',
    ]

    # Module-to-table mapping
    MODULE_MAP = {
        'organization': ['organization.*'],
        'accounts': ['accounts.*'],
        'employees': ['employees.*'],
        'payroll': ['payroll.*'],
        'leave': ['leave.*'],
        'benefits': ['benefits.*'],
        'recruitment': ['recruitment.*'],
        'performance': ['performance.*'],
        'discipline': ['discipline.*'],
        'training': ['training.*'],
        'exits': ['exits.*'],
        'policies': ['policies.*'],
        'workflow': ['workflow.*'],
        'finance': ['finance.*'],
        'procurement': ['procurement.*'],
        'inventory': ['inventory.*'],
        'projects': ['projects.*'],
        'reports': ['reports.reportdefinition', 'reports.scheduledreport'],
        'core': ['core.notification', 'core.announcement', 'core.attachment',
                 'core.systemconfiguration'],
    }

    def _resolve_tables(self, modules):
        """Resolve module names to table names."""
        tables = []
        for module in modules:
            module_tables = self.MODULE_MAP.get(module, [])
            for pattern in module_tables:
                if pattern.endswith('.*'):
                    app_label = pattern[:-2]
                    # Get all models from this app
                    try:
                        app_config = apps.get_app_config(app_label)
                        for model in app_config.get_models():
                            table_key = f"{app_label}.{model.__name__.lower()}"
                            tables.append(table_key)
                    except LookupError:
                        logger.warning(f"App '{app_label}' not found, skipping")
                else:
                    tables.append(pattern)
        return tables

    def _get_ordered_tables(self, tables):
        """Order tables by FK dependency."""
        ordered = []
        remaining = set(tables)
        for table in self.TABLE_ORDER:
            if table in remaining:
                ordered.append(table)
                remaining.discard(table)
        # Add any remaining tables not in the predefined order
        ordered.extend(sorted(remaining))
        return ordered

    def create_backup(self, organization, backup_type, modules, name, created_by):
        """Create a backup record and dispatch async task."""
        from .backup_models import TenantBackup

        now = timezone.now()
        backup_number = f"BK-{organization.code}-{now.strftime('%Y%m%d%H%M%S')}"

        # Resolve modules for full backup
        if backup_type == 'FULL':
            modules = list(self.MODULE_MAP.keys())

        backup = TenantBackup.objects.create(
            organization=organization,
            backup_number=backup_number,
            name=name,
            backup_type=backup_type,
            modules_included=modules,
            status=TenantBackup.Status.PENDING,
            created_by=created_by,
            django_version=django.get_version(),
            expires_at=now + timedelta(days=90),
        )

        # Dispatch Celery task
        from .backup_tasks import execute_backup_task
        execute_backup_task.delay(str(backup.id))

        return backup

    def execute_backup(self, backup_id):
        """Execute the backup synchronously (called by Celery task)."""
        from .backup_models import TenantBackup

        backup = TenantBackup.objects.get(id=backup_id)
        backup.status = TenantBackup.Status.IN_PROGRESS
        backup.started_at = timezone.now()
        backup.save(update_fields=['status', 'started_at'])

        try:
            tables = self._resolve_tables(backup.modules_included)
            ordered_tables = self._get_ordered_tables(tables)
            backup.tables_included = ordered_tables
            backup.save(update_fields=['tables_included'])

            archive_data = {}
            record_counts = {}
            total_records = 0
            num_tables = len(ordered_tables)

            for idx, table_key in enumerate(ordered_tables):
                try:
                    app_label, model_name = table_key.split('.')
                    model = apps.get_model(app_label, model_name)
                except (LookupError, ValueError):
                    logger.warning(f"Model '{table_key}' not found, skipping")
                    continue

                # Query all records for this tenant (including soft-deleted)
                qs = model.objects.all()
                if hasattr(model, 'tenant'):
                    qs = model.all_objects.filter(tenant=backup.organization)
                elif hasattr(model, 'organization'):
                    qs = model.objects.filter(organization=backup.organization)

                # Serialize
                data = serializers.serialize('json', qs)
                archive_data[table_key] = data
                count = qs.count()
                record_counts[table_key] = count
                total_records += count

                # Update progress
                progress = int((idx + 1) / num_tables * 100)
                backup.progress_percent = progress
                backup.progress_detail = f"Exported {table_key} ({idx + 1}/{num_tables})"
                backup.save(update_fields=['progress_percent', 'progress_detail'])

            # Compress
            json_bytes = json.dumps(archive_data).encode('utf-8')
            compressed = gzip.compress(json_bytes)

            # Calculate checksum
            checksum = hashlib.sha256(compressed).hexdigest()

            # Store
            max_inline_size = getattr(settings, 'BACKUP_SETTINGS', {}).get(
                'MAX_INLINE_SIZE_MB', 50
            ) * 1024 * 1024

            if len(compressed) <= max_inline_size:
                backup.file_data = compressed
            else:
                backup_dir = getattr(settings, 'BACKUP_SETTINGS', {}).get(
                    'LOCAL_PATH', '/var/backups/hrms/'
                )
                os.makedirs(backup_dir, exist_ok=True)
                file_path = os.path.join(backup_dir, f"{backup.backup_number}.json.gz")
                with open(file_path, 'wb') as f:
                    f.write(compressed)
                backup.file_path = file_path

            backup.file_size_bytes = len(compressed)
            backup.file_checksum = checksum
            backup.record_counts = record_counts
            backup.total_records = total_records
            backup.status = TenantBackup.Status.COMPLETED
            backup.completed_at = timezone.now()
            backup.progress_percent = 100
            backup.progress_detail = 'Backup completed'
            if backup.started_at:
                backup.duration_seconds = int(
                    (backup.completed_at - backup.started_at).total_seconds()
                )
            backup.save()

            logger.info(
                f"Backup {backup.backup_number} completed: "
                f"{total_records} records, {len(compressed)} bytes"
            )
            return backup

        except Exception as e:
            backup.status = TenantBackup.Status.FAILED
            backup.error_message = str(e)
            backup.completed_at = timezone.now()
            backup.save()
            logger.error(f"Backup {backup.backup_number} failed: {e}")
            raise

    def restore_backup(self, backup, target_org, restore_type, modules,
                       restore_mode, initiated_by, approved_by=None):
        """Create a restore record and dispatch async task."""
        from .backup_models import TenantRestore

        now = timezone.now()
        restore_number = f"RS-{target_org.code}-{now.strftime('%Y%m%d%H%M%S')}"

        if restore_type == 'FULL':
            modules = backup.modules_included

        restore = TenantRestore.objects.create(
            organization=target_org,
            backup=backup,
            restore_number=restore_number,
            restore_type=restore_type,
            modules_restored=modules,
            restore_mode=restore_mode,
            status=TenantRestore.Status.PENDING,
            initiated_by=initiated_by,
            approved_by=approved_by,
        )

        from .backup_tasks import execute_restore_task
        execute_restore_task.delay(str(restore.id))

        return restore

    def execute_restore(self, restore_id):
        """Execute the restore synchronously (called by Celery task)."""
        from .backup_models import TenantRestore, TenantBackup

        restore = TenantRestore.objects.select_related('backup', 'organization').get(
            id=restore_id
        )
        backup = restore.backup
        target_org = restore.organization

        try:
            # Safety backup for REPLACE mode
            if restore.restore_type == 'REPLACE':
                restore.status = TenantRestore.Status.PRE_BACKUP
                restore.progress_detail = 'Creating safety backup...'
                restore.save(update_fields=['status', 'progress_detail'])

                safety_backup = self.create_backup(
                    organization=target_org,
                    backup_type='FULL',
                    modules=restore.modules_restored,
                    name=f"Safety backup before restore {restore.restore_number}",
                    created_by=restore.initiated_by,
                )
                # Wait for safety backup to complete (synchronous for safety)
                self.execute_backup(str(safety_backup.id))
                restore.pre_restore_backup = safety_backup
                restore.pre_restore_completed = True
                restore.save(update_fields=['pre_restore_backup', 'pre_restore_completed'])

            # Start restore
            restore.status = TenantRestore.Status.IN_PROGRESS
            restore.started_at = timezone.now()
            restore.save(update_fields=['status', 'started_at'])

            # Load backup data
            if backup.file_data:
                compressed = bytes(backup.file_data)
            elif backup.file_path:
                with open(backup.file_path, 'rb') as f:
                    compressed = f.read()
            else:
                raise ValueError("Backup has no data")

            # Verify checksum
            checksum = hashlib.sha256(compressed).hexdigest()
            if checksum != backup.file_checksum:
                raise ValueError("Backup checksum mismatch - data may be corrupted")

            # Decompress
            json_bytes = gzip.decompress(compressed)
            archive_data = json.loads(json_bytes.decode('utf-8'))

            # Determine tables to restore
            tables_to_restore = self._resolve_tables(restore.modules_restored)
            ordered_tables = self._get_ordered_tables(tables_to_restore)

            records_restored = {}
            records_skipped = {}
            records_failed = {}
            total_restored = 0
            total_skipped = 0
            total_failed = 0
            num_tables = len(ordered_tables)

            with transaction.atomic():
                # Delete existing data for REPLACE mode
                if restore.restore_type == 'REPLACE':
                    for table_key in reversed(ordered_tables):
                        try:
                            app_label, model_name = table_key.split('.')
                            model = apps.get_model(app_label, model_name)
                            if hasattr(model, 'tenant'):
                                model.all_objects.filter(tenant=target_org).delete()
                        except (LookupError, ValueError):
                            continue

                for idx, table_key in enumerate(ordered_tables):
                    table_data = archive_data.get(table_key)
                    if not table_data:
                        continue

                    try:
                        deserialized = list(serializers.deserialize('json', table_data))
                    except Exception as e:
                        records_failed[table_key] = 0
                        logger.error(f"Failed to deserialize {table_key}: {e}")
                        continue

                    restored = 0
                    skipped = 0
                    failed = 0

                    for obj in deserialized:
                        try:
                            # Remap tenant to target org
                            if hasattr(obj.object, 'tenant_id'):
                                obj.object.tenant_id = target_org.id

                            if restore.restore_mode == 'SKIP_EXISTING':
                                model = obj.object.__class__
                                if model.objects.filter(pk=obj.object.pk).exists():
                                    skipped += 1
                                    continue

                            obj.save()
                            restored += 1
                        except Exception as e:
                            failed += 1
                            logger.warning(
                                f"Failed to restore {table_key} record: {e}"
                            )

                    records_restored[table_key] = restored
                    records_skipped[table_key] = skipped
                    records_failed[table_key] = failed
                    total_restored += restored
                    total_skipped += skipped
                    total_failed += failed

                    progress = int((idx + 1) / num_tables * 100)
                    restore.progress_percent = progress
                    restore.progress_detail = f"Restored {table_key} ({idx + 1}/{num_tables})"
                    restore.save(update_fields=['progress_percent', 'progress_detail'])

            # Complete
            restore.status = TenantRestore.Status.COMPLETED
            restore.completed_at = timezone.now()
            restore.records_restored = records_restored
            restore.records_skipped = records_skipped
            restore.records_failed = records_failed
            restore.total_restored = total_restored
            restore.total_skipped = total_skipped
            restore.total_failed = total_failed
            restore.progress_percent = 100
            restore.progress_detail = 'Restore completed'
            if restore.started_at:
                restore.duration_seconds = int(
                    (restore.completed_at - restore.started_at).total_seconds()
                )
            restore.save()

            logger.info(
                f"Restore {restore.restore_number} completed: "
                f"{total_restored} restored, {total_skipped} skipped, {total_failed} failed"
            )
            return restore

        except Exception as e:
            restore.status = TenantRestore.Status.FAILED
            restore.error_log = str(e)
            restore.completed_at = timezone.now()
            restore.save()
            logger.error(f"Restore {restore.restore_number} failed: {e}")
            raise

    def verify_backup(self, backup):
        """Verify backup integrity without restoring."""
        errors = []
        warnings = []

        # Check file exists
        if not backup.file_data and not backup.file_path:
            errors.append("Backup has no data file")
            return {'valid': False, 'errors': errors, 'warnings': warnings}

        try:
            # Load and verify checksum
            if backup.file_data:
                compressed = bytes(backup.file_data)
            else:
                with open(backup.file_path, 'rb') as f:
                    compressed = f.read()

            checksum = hashlib.sha256(compressed).hexdigest()
            if checksum != backup.file_checksum:
                errors.append('Checksum mismatch')
                return {'valid': False, 'errors': errors, 'warnings': warnings}

            # Decompress and validate JSON
            json_bytes = gzip.decompress(compressed)
            archive_data = json.loads(json_bytes.decode('utf-8'))

            # Verify record counts
            for table_key, data in archive_data.items():
                records = json.loads(data)
                actual_count = len(records)
                expected_count = backup.record_counts.get(table_key, 0)
                if actual_count != expected_count:
                    warnings.append(
                        f"{table_key}: expected {expected_count} records, found {actual_count}"
                    )

        except gzip.BadGzipFile:
            errors.append("Invalid gzip data")
        except json.JSONDecodeError:
            errors.append("Invalid JSON data")
        except Exception as e:
            errors.append(f"Verification error: {str(e)}")

        return {
            'valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings,
        }

    def cleanup_expired_backups(self):
        """Delete expired, unlocked backups."""
        from .backup_models import TenantBackup

        now = timezone.now()
        expired = TenantBackup.objects.filter(
            expires_at__lt=now,
            is_locked=False,
            status=TenantBackup.Status.COMPLETED,
        )

        count = 0
        for backup in expired:
            # Delete file if stored on filesystem
            if backup.file_path and os.path.exists(backup.file_path):
                os.remove(backup.file_path)
            backup.file_data = None
            backup.status = TenantBackup.Status.EXPIRED
            backup.save(update_fields=['file_data', 'status'])
            count += 1

        return count

    def clone_tenant(self, source_org, target_org_name, target_org_code, created_by):
        """Create a complete clone of a tenant."""
        from organization.models import Organization

        # Create new organization
        new_org = Organization.objects.create(
            name=target_org_name,
            code=target_org_code,
            slug=target_org_code.lower().replace(' ', '-'),
            country=source_org.country,
            currency=source_org.currency,
            currency_symbol=source_org.currency_symbol,
            timezone=source_org.timezone,
            modules_enabled=source_org.modules_enabled,
        )

        # Create full backup of source
        backup = self.create_backup(
            organization=source_org,
            backup_type='FULL',
            modules=list(self.MODULE_MAP.keys()),
            name=f"Clone source for {target_org_name}",
            created_by=created_by,
        )

        # Execute backup synchronously
        self.execute_backup(str(backup.id))

        # Restore into new org
        restore = self.restore_backup(
            backup=backup,
            target_org=new_org,
            restore_type='FULL',
            modules=backup.modules_included,
            restore_mode='OVERWRITE',
            initiated_by=created_by,
        )

        # Execute restore synchronously
        self.execute_restore(str(restore.id))

        return new_org
