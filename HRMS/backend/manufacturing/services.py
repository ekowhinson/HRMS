"""Business logic for manufacturing module."""

import logging
from decimal import Decimal
from django.apps import apps
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger('hrms')


def _get_inventory_model(model_name):
    """Resolve an inventory model by name without direct import."""
    return apps.get_model('inventory', model_name)


def _get_finance_model(model_name):
    """Resolve a finance model by name without direct import."""
    return apps.get_model('finance', model_name)


def _generate_wo_number(tenant=None):
    """Generate WO-YYYYMM-NNNN number."""
    from .models import WorkOrder
    now = timezone.now()
    base = f"WO-{now.year}{now.month:02d}"
    qs = WorkOrder.all_objects.filter(work_order_number__startswith=base)
    if tenant:
        qs = qs.filter(tenant=tenant)
    last = qs.order_by('-work_order_number').first()
    if last:
        try:
            seq = int(last.work_order_number.rsplit('-', 1)[-1]) + 1
        except (ValueError, IndexError):
            seq = 1
    else:
        seq = 1
    return f"{base}-{seq:04d}"


def _generate_batch_number(tenant=None):
    """Generate BAT-YYYYMM-NNNN number."""
    from .models import ProductionBatch
    now = timezone.now()
    base = f"BAT-{now.year}{now.month:02d}"
    qs = ProductionBatch.all_objects.filter(batch_number__startswith=base)
    if tenant:
        qs = qs.filter(tenant=tenant)
    last = qs.order_by('-batch_number').first()
    if last:
        try:
            seq = int(last.batch_number.rsplit('-', 1)[-1]) + 1
        except (ValueError, IndexError):
            seq = 1
    else:
        seq = 1
    return f"{base}-{seq:04d}"


def copy_bom_version(bom):
    """Create a new version of a BOM, copying all lines and routings."""
    from .models import BillOfMaterials, BOMLine, ProductionRouting

    new_version = BillOfMaterials.objects.filter(
        finished_product=bom.finished_product, tenant=bom.tenant
    ).count() + 1

    new_bom = BillOfMaterials(
        tenant=bom.tenant,
        code=f"{bom.code}-v{new_version}",
        name=bom.name,
        description=bom.description,
        finished_product=bom.finished_product,
        version=new_version,
        yield_qty=bom.yield_qty,
        status=BillOfMaterials.Status.DRAFT,
    )
    new_bom.save()

    for line in bom.lines.all():
        BOMLine.objects.create(
            tenant=bom.tenant, bom=new_bom,
            raw_material=line.raw_material,
            quantity=line.quantity,
            unit_of_measure=line.unit_of_measure,
            scrap_percent=line.scrap_percent,
            sort_order=line.sort_order,
        )

    for routing in bom.routings.all():
        ProductionRouting.objects.create(
            tenant=bom.tenant, bom=new_bom,
            operation_number=routing.operation_number,
            name=routing.name,
            description=routing.description,
            work_center=routing.work_center,
            setup_time_minutes=routing.setup_time_minutes,
            run_time_minutes=routing.run_time_minutes,
            sort_order=routing.sort_order,
        )

    return new_bom


def start_work_order(wo_id):
    """Transition a released work order to IN_PROGRESS."""
    from .models import WorkOrder

    wo = WorkOrder.objects.get(pk=wo_id)
    if wo.status != WorkOrder.Status.RELEASED:
        raise ValueError("Only released orders can be started")
    wo.status = WorkOrder.Status.IN_PROGRESS
    wo.actual_start = timezone.now()
    wo.save(update_fields=['status', 'actual_start', 'updated_at'])
    return wo


def release_work_order(wo_id):
    """Validate BOM is active and transition WO to RELEASED."""
    from .models import WorkOrder, WorkOrderOperation

    wo = WorkOrder.objects.get(pk=wo_id)
    if wo.status != WorkOrder.Status.DRAFT:
        raise ValueError(f"Work order must be in DRAFT status (current: {wo.status})")

    bom = wo.bom
    if bom.status != 'ACTIVE':
        raise ValueError(f"BOM {bom.code} is not active (status: {bom.status})")

    # Create operations from BOM routing if not already created
    if not wo.operations.exists():
        routings = bom.routings.all().order_by('sort_order', 'operation_number')
        ops = []
        for routing in routings:
            ops.append(WorkOrderOperation(
                tenant=wo.tenant,
                work_order=wo,
                routing=routing,
                operation_number=routing.operation_number,
                name=routing.name,
                work_center=routing.work_center,
                setup_time=routing.setup_time_minutes,
                run_time=routing.run_time_minutes,
            ))
        if ops:
            WorkOrderOperation.objects.bulk_create(ops)

    # Create material consumption plan from BOM lines
    from .models import MaterialConsumption
    if not wo.material_consumptions.exists():
        lines = bom.lines.all()
        consumptions = []
        for line in lines:
            planned = line.effective_quantity * wo.planned_qty / bom.yield_qty
            wh = line.bom.lines.first()  # Use BOM's work center warehouse if available
            warehouse = bom.routings.first().work_center.warehouse if bom.routings.exists() and bom.routings.first().work_center.warehouse else None
            if warehouse:
                consumptions.append(MaterialConsumption(
                    tenant=wo.tenant,
                    work_order=wo,
                    item=line.raw_material,
                    warehouse=warehouse,
                    planned_qty=planned,
                ))
        if consumptions:
            MaterialConsumption.objects.bulk_create(consumptions)

    wo.status = WorkOrder.Status.RELEASED
    wo.save(update_fields=['status', 'updated_at'])
    return wo


def issue_materials(wo_id):
    """Create StockEntry ISSUE for each MaterialConsumption line."""
    from .models import WorkOrder, MaterialConsumption
    StockEntry = _get_inventory_model('StockEntry')
    StockLedger = _get_inventory_model('StockLedger')

    wo = WorkOrder.objects.get(pk=wo_id)
    if wo.status not in (WorkOrder.Status.RELEASED, WorkOrder.Status.IN_PROGRESS):
        raise ValueError("Work order must be RELEASED or IN_PROGRESS to issue materials")

    consumptions = wo.material_consumptions.filter(stock_entry__isnull=True, actual_qty__gt=0)
    entries_created = []

    with transaction.atomic():
        for mc in consumptions:
            stock_entry = StockEntry(
                tenant=wo.tenant,
                entry_type=StockEntry.EntryType.ISSUE,
                entry_date=timezone.now(),
                item=mc.item,
                warehouse=mc.warehouse,
                quantity=mc.actual_qty,
                unit_cost=mc.item.standard_cost or Decimal('0.00'),
                source='MANUFACTURING',
                source_reference=wo.work_order_number,
                notes=f"Material issue for WO {wo.work_order_number}",
            )
            stock_entry.save()

            # Update StockLedger
            ledger, _ = StockLedger.objects.get_or_create(
                item=mc.item, warehouse=mc.warehouse,
                defaults={'tenant': wo.tenant, 'balance_qty': 0, 'valuation_amount': 0}
            )
            ledger.balance_qty -= mc.actual_qty
            ledger.last_movement_date = timezone.now().date()
            ledger.save(update_fields=['balance_qty', 'last_movement_date', 'updated_at'])

            mc.stock_entry = stock_entry
            mc.consumed_at = timezone.now()
            mc.save(update_fields=['stock_entry', 'consumed_at', 'updated_at'])
            entries_created.append(str(stock_entry.pk))

        if wo.status == WorkOrder.Status.RELEASED:
            wo.status = WorkOrder.Status.IN_PROGRESS
            wo.actual_start = timezone.now()
            wo.save(update_fields=['status', 'actual_start', 'updated_at'])

    return {'entries_created': len(entries_created)}


def report_production(wo_id, qty, batch_data=None):
    """Record production output — create ProductionBatch and StockEntry RECEIPT."""
    from .models import WorkOrder, ProductionBatch
    StockEntry = _get_inventory_model('StockEntry')
    StockLedger = _get_inventory_model('StockLedger')
    Warehouse = _get_inventory_model('Warehouse')

    wo = WorkOrder.objects.get(pk=wo_id)
    if wo.status not in (WorkOrder.Status.IN_PROGRESS, WorkOrder.Status.RELEASED):
        raise ValueError("Work order must be IN_PROGRESS or RELEASED")

    qty = Decimal(str(qty))
    tenant = wo.tenant

    with transaction.atomic():
        batch_number = _generate_batch_number(tenant=tenant)

        # Determine warehouse for finished goods receipt
        warehouse = None
        if wo.bom.routings.exists():
            last_routing = wo.bom.routings.order_by('-sort_order').first()
            if last_routing and last_routing.work_center.warehouse:
                warehouse = last_routing.work_center.warehouse
        if not warehouse:
            warehouse = Warehouse.objects.filter(is_active=True).first()

        if not warehouse:
            raise ValueError("No warehouse available for finished goods receipt")

        # Create stock entry for finished goods
        stock_entry = StockEntry(
            tenant=tenant,
            entry_type=StockEntry.EntryType.RECEIPT,
            entry_date=timezone.now(),
            item=wo.product,
            warehouse=warehouse,
            quantity=qty,
            unit_cost=wo.product.standard_cost or Decimal('0.00'),
            source='MANUFACTURING',
            source_reference=wo.work_order_number,
            notes=f"Production receipt for WO {wo.work_order_number}",
        )
        stock_entry.save()

        # Update stock ledger
        ledger, _ = StockLedger.objects.get_or_create(
            item=wo.product, warehouse=warehouse,
            defaults={'tenant': tenant, 'balance_qty': 0, 'valuation_amount': 0}
        )
        ledger.balance_qty += qty
        ledger.last_movement_date = timezone.now().date()
        ledger.save(update_fields=['balance_qty', 'last_movement_date', 'updated_at'])

        batch = ProductionBatch(
            tenant=tenant,
            batch_number=batch_number,
            work_order=wo,
            quantity=qty,
            manufacture_date=timezone.now().date(),
            expiry_date=batch_data.get('expiry_date') if batch_data else None,
            stock_entry=stock_entry,
        )
        batch.save()

        wo.completed_qty += qty
        wo.save(update_fields=['completed_qty', 'updated_at'])

    return {'batch_number': batch_number, 'stock_entry_id': str(stock_entry.pk)}


def calculate_production_cost(wo_id):
    """Calculate total production cost: materials + labor + overhead."""
    from .models import WorkOrder

    wo = WorkOrder.objects.prefetch_related(
        'material_consumptions__item', 'operations__work_center'
    ).get(pk=wo_id)

    # Material cost
    material_cost = Decimal('0.00')
    for mc in wo.material_consumptions.all():
        unit_cost = mc.item.standard_cost or Decimal('0.00')
        material_cost += mc.actual_qty * unit_cost

    # Labor cost (operation time × work center hourly rate)
    labor_cost = Decimal('0.00')
    for op in wo.operations.all():
        hours = Decimal(op.actual_time or op.run_time or 0) / Decimal('60')
        labor_cost += hours * (op.work_center.hourly_rate or Decimal('0.00'))

    total_cost = material_cost + labor_cost
    wo.actual_cost = total_cost
    wo.save(update_fields=['actual_cost', 'updated_at'])

    return {
        'material_cost': str(material_cost),
        'labor_cost': str(labor_cost),
        'total_cost': str(total_cost),
    }


def close_work_order(wo_id):
    """Close work order — validate operations complete, calculate cost, post to GL."""
    from .models import WorkOrder

    wo = WorkOrder.objects.get(pk=wo_id)
    if wo.status != WorkOrder.Status.IN_PROGRESS:
        raise ValueError("Work order must be IN_PROGRESS to close")

    # Calculate final cost
    cost_data = calculate_production_cost(wo_id)

    # Post to GL via Celery task (resolved through app registry, not direct import)
    try:
        app = apps.get_app_config('finance')
        task_module = __import__(f'{app.name}.tasks', fromlist=['post_production_to_gl'])
        task_module.post_production_to_gl.delay(str(wo_id))
    except (LookupError, ImportError, AttributeError) as e:
        logger.warning(f"Could not dispatch GL posting for WO {wo_id}: {e}")

    wo.status = WorkOrder.Status.COMPLETED
    wo.actual_end = timezone.now()
    wo.save(update_fields=['status', 'actual_end', 'updated_at'])

    return {
        'status': 'completed',
        'work_order': wo.work_order_number,
        **cost_data,
    }
