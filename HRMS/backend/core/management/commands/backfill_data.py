"""
Resumable batch data backfill command for NHIA HRMS.

Processes records in configurable batches with progress reporting, ETA,
and resume capability. Designed for large-table operations on 1M+ records.

Usage:
    python manage.py backfill_data --backfill <name> [options]

    # Backfill a new column with default values
    python manage.py backfill_data --backfill set_employee_status_active \
        --batch-size 500 --dry-run

    # Resume an interrupted backfill
    python manage.py backfill_data --backfill set_employee_status_active --resume

    # List available backfills
    python manage.py backfill_data --list

Examples of backfill functions to register:
    @backfill_registry.register("set_employee_status_active")
    def backfill_employee_status(queryset, dry_run=False):
        return queryset.filter(status__isnull=True).update(status='ACTIVE')
"""

import importlib
import time
from datetime import timedelta

from django.core.cache import cache
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction


class BackfillRegistry:
    """Registry of available backfill operations."""

    _backfills = {}

    @classmethod
    def register(cls, name, description=""):
        """Decorator to register a backfill function."""

        def decorator(func):
            cls._backfills[name] = {
                "func": func,
                "description": description or func.__doc__ or "No description",
            }
            return func

        return decorator

    @classmethod
    def get(cls, name):
        return cls._backfills.get(name)

    @classmethod
    def list_all(cls):
        return cls._backfills


# Global registry instance
backfill_registry = BackfillRegistry()


# ── Built-in Backfill Examples ───────────────────────────────────────────────


@backfill_registry.register(
    "example_set_defaults",
    description="Example: Set default values for a new nullable column",
)
def example_set_defaults(queryset, dry_run=False):
    """
    Example backfill showing the pattern.
    Replace with your actual backfill logic.
    """
    # This is a template — replace with actual model and field
    count = queryset.count()
    if not dry_run and count > 0:
        queryset.update()  # Replace with actual update
    return count


class Command(BaseCommand):
    help = "Run resumable batch data backfills for large tables"

    def add_arguments(self, parser):
        parser.add_argument(
            "--backfill",
            type=str,
            help="Name of the backfill to run",
        )
        parser.add_argument(
            "--list",
            action="store_true",
            help="List available backfills",
        )
        parser.add_argument(
            "--batch-size",
            type=int,
            default=1000,
            help="Number of records per batch (default: 1000)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Preview what would be changed without making modifications",
        )
        parser.add_argument(
            "--resume",
            action="store_true",
            help="Resume from last checkpoint",
        )
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Reset checkpoint and start from the beginning",
        )
        parser.add_argument(
            "--model",
            type=str,
            help="Model to backfill in app_label.ModelName format (e.g., employees.Employee)",
        )
        parser.add_argument(
            "--field",
            type=str,
            help="Field to set (used with --value)",
        )
        parser.add_argument(
            "--value",
            type=str,
            help="Value to set on the field (used with --field)",
        )
        parser.add_argument(
            "--filter",
            type=str,
            help='Filter queryset as key=value pairs, comma-separated (e.g., "status__isnull=True")',
        )
        parser.add_argument(
            "--sleep",
            type=float,
            default=0.1,
            help="Seconds to sleep between batches (default: 0.1)",
        )

    def handle(self, *args, **options):
        # Discover backfills from all apps
        self._discover_backfills()

        if options["list"]:
            return self._list_backfills()

        if options["backfill"]:
            return self._run_registered_backfill(options)

        if options["model"] and options["field"] and options["value"]:
            return self._run_field_backfill(options)

        raise CommandError(
            "Specify --backfill <name>, --list, or --model/--field/--value. "
            "Run with --list to see available backfills."
        )

    def _discover_backfills(self):
        """Auto-discover backfill modules from installed apps."""
        from django.apps import apps

        for app_config in apps.get_app_configs():
            try:
                importlib.import_module(f"{app_config.name}.backfills")
            except ImportError:
                pass

    def _list_backfills(self):
        """List all registered backfill operations."""
        backfills = backfill_registry.list_all()
        if not backfills:
            self.stdout.write("No backfills registered.")
            return

        self.stdout.write("\nAvailable backfills:\n")
        for name, info in sorted(backfills.items()):
            self.stdout.write(f"  {name}")
            self.stdout.write(f"    {info['description']}\n")

    def _get_cache_key(self, name):
        return f"backfill:checkpoint:{name}"

    def _get_checkpoint(self, name):
        return cache.get(self._get_cache_key(name), 0)

    def _set_checkpoint(self, name, last_id):
        cache.set(self._get_cache_key(name), last_id, timeout=86400 * 7)  # 7 days

    def _clear_checkpoint(self, name):
        cache.delete(self._get_cache_key(name))

    def _run_registered_backfill(self, options):
        """Run a registered backfill function."""
        name = options["backfill"]
        entry = backfill_registry.get(name)
        if not entry:
            available = ", ".join(backfill_registry.list_all().keys())
            raise CommandError(
                f"Unknown backfill: '{name}'. Available: {available}"
            )

        func = entry["func"]
        dry_run = options["dry_run"]

        self.stdout.write(f"\n{'DRY RUN — ' if dry_run else ''}Running backfill: {name}")
        self.stdout.write(f"  {entry['description']}\n")

        start = time.monotonic()

        try:
            result = func(dry_run=dry_run)
            elapsed = time.monotonic() - start

            self.stdout.write(
                self.style.SUCCESS(
                    f"\n{'Would process' if dry_run else 'Processed'} "
                    f"{result} record(s) in {elapsed:.1f}s"
                )
            )
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"\nBackfill failed: {e}"))
            raise

    def _run_field_backfill(self, options):
        """Run a generic field-value backfill with batching and resume."""
        from django.apps import apps

        model_str = options["model"]
        field_name = options["field"]
        value = options["value"]
        batch_size = options["batch_size"]
        dry_run = options["dry_run"]
        sleep_time = options["sleep"]

        # Resolve model
        try:
            app_label, model_name = model_str.split(".")
            Model = apps.get_model(app_label, model_name)
        except (ValueError, LookupError) as e:
            raise CommandError(f"Invalid model '{model_str}': {e}")

        # Build queryset filter
        qs = Model.objects.all()
        if options["filter"]:
            filter_kwargs = {}
            for pair in options["filter"].split(","):
                key, val = pair.strip().split("=", 1)
                # Handle special values
                if val.lower() == "true":
                    val = True
                elif val.lower() == "false":
                    val = False
                elif val.lower() == "none":
                    val = None
                filter_kwargs[key.strip()] = val
            qs = qs.filter(**filter_kwargs)

        total = qs.count()
        backfill_name = f"{model_str}.{field_name}"

        # Handle checkpoint
        if options["reset"]:
            self._clear_checkpoint(backfill_name)
            self.stdout.write("Checkpoint cleared.")

        last_id = 0
        if options["resume"]:
            last_id = self._get_checkpoint(backfill_name)
            if last_id:
                self.stdout.write(f"Resuming from ID > {last_id}")
                qs = qs.filter(pk__gt=last_id)
                remaining = qs.count()
                self.stdout.write(f"  {remaining} records remaining of {total} total")
                total = remaining

        if total == 0:
            self.stdout.write(self.style.SUCCESS("No records to process."))
            return

        # Display plan
        self.stdout.write(f"\n{'DRY RUN — ' if dry_run else ''}Backfill Plan:")
        self.stdout.write(f"  Model:      {model_str}")
        self.stdout.write(f"  Field:      {field_name} = {value}")
        self.stdout.write(f"  Records:    {total:,}")
        self.stdout.write(f"  Batch size: {batch_size:,}")
        self.stdout.write(f"  Batches:    {(total + batch_size - 1) // batch_size}")
        self.stdout.write("")

        if dry_run:
            self.stdout.write(self.style.WARNING("Dry run — no changes will be made.\n"))

        # Process in batches
        processed = 0
        start_time = time.monotonic()
        update_kwargs = {field_name: value}

        qs_ordered = qs.order_by("pk")

        while True:
            batch_qs = qs_ordered.filter(pk__gt=last_id)[:batch_size]
            batch_ids = list(batch_qs.values_list("pk", flat=True))

            if not batch_ids:
                break

            if not dry_run:
                with transaction.atomic():
                    updated = Model.objects.filter(pk__in=batch_ids).update(
                        **update_kwargs
                    )
                    processed += updated
            else:
                processed += len(batch_ids)

            last_id = batch_ids[-1]

            # Save checkpoint
            if not dry_run:
                self._set_checkpoint(backfill_name, last_id)

            # Progress reporting
            elapsed = time.monotonic() - start_time
            rate = processed / elapsed if elapsed > 0 else 0
            remaining = total - processed
            eta = timedelta(seconds=int(remaining / rate)) if rate > 0 else "unknown"

            self.stdout.write(
                f"  [{processed:,}/{total:,}] "
                f"{processed * 100 // total}% | "
                f"{rate:.0f} rec/s | "
                f"ETA: {eta}"
            )

            # Throttle to prevent overwhelming the database
            if sleep_time > 0:
                time.sleep(sleep_time)

        elapsed = time.monotonic() - start_time
        verb = "Would process" if dry_run else "Processed"

        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(
                f"{verb} {processed:,} records in {elapsed:.1f}s "
                f"({processed / elapsed:.0f} rec/s)"
            )
        )

        # Clear checkpoint on successful completion
        if not dry_run:
            self._clear_checkpoint(backfill_name)
            self.stdout.write("Checkpoint cleared (backfill complete).")
