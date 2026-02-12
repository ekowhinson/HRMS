"""
Procurement business logic services.

Includes:
  - Purchase Requisition -> Purchase Order conversion
  - 3-way matching (PO, GRN, Vendor Invoice)
"""

import logging
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

logger = logging.getLogger('hrms')


def convert_requisition_to_po(requisition, vendor, created_by=None):
    """
    Convert an approved PurchaseRequisition into a PurchaseOrder.

    Creates a PO header from the requisition and copies all requisition
    items as PO line items. Updates requisition status to ORDERED.

    Args:
        requisition: PurchaseRequisition instance (must be APPROVED)
        vendor: finance.Vendor instance
        created_by: User who is creating the PO

    Returns:
        PurchaseOrder instance

    Raises:
        ValueError: If requisition is not in APPROVED status
    """
    from procurement.models import (
        PurchaseRequisition, PurchaseOrder, PurchaseOrderItem,
    )

    if requisition.status != PurchaseRequisition.Status.APPROVED:
        raise ValueError(
            f"Requisition {requisition.requisition_number} is not approved "
            f"(status: {requisition.status})"
        )

    with transaction.atomic():
        # Generate PO number
        now = timezone.now()
        prefix = f"PO-{now.year}{now.month:02d}"
        last_po = (
            PurchaseOrder.objects
            .filter(po_number__startswith=prefix)
            .order_by('-po_number')
            .first()
        )
        if last_po:
            try:
                seq = int(last_po.po_number.rsplit('-', 1)[-1]) + 1
            except (ValueError, IndexError):
                seq = 1
        else:
            seq = 1
        po_number = f"{prefix}-{seq:04d}"

        # Create PO
        po = PurchaseOrder.objects.create(
            po_number=po_number,
            vendor=vendor,
            requisition=requisition,
            order_date=now.date(),
            delivery_date=requisition.required_date,
            status=PurchaseOrder.Status.DRAFT,
            total_amount=Decimal('0'),
            notes=f"Auto-generated from requisition {requisition.requisition_number}",
        )

        # Copy requisition items to PO items
        total = Decimal('0')
        for req_item in requisition.items.all():
            item_total = req_item.quantity * req_item.unit_price
            PurchaseOrderItem.objects.create(
                purchase_order=po,
                requisition_item=req_item,
                description=req_item.description,
                item=req_item.item,
                quantity=req_item.quantity,
                unit_of_measure=req_item.unit_of_measure,
                unit_price=req_item.unit_price,
                total=item_total,
            )
            total += item_total

        po.total_amount = total
        po.save(update_fields=['total_amount'])

        # Update requisition status
        requisition.status = PurchaseRequisition.Status.ORDERED
        requisition.save(update_fields=['status', 'updated_at'])

        logger.info(
            "Converted requisition %s to PO %s (vendor: %s, total: %s)",
            requisition.requisition_number,
            po_number,
            vendor.name,
            total,
        )

    return po


def match_invoice_to_po_grn(vendor_invoice, tolerance_pct=Decimal('5.0')):
    """
    Perform 3-way matching: PO <-> GRN <-> Vendor Invoice.

    Checks:
      1. Invoice vendor matches PO vendor
      2. Invoice total is within tolerance of PO total
      3. GRN accepted quantities match PO ordered quantities
      4. Invoice amount is within tolerance of GRN received value

    Args:
        vendor_invoice: finance.VendorInvoice instance
        tolerance_pct: Acceptable percentage variance (default 5%)

    Returns:
        dict with:
            matched: bool
            checks: list of (check_name, passed, detail)
            discrepancies: list of issues found
    """
    from procurement.models import PurchaseOrder, GoodsReceiptNote

    checks = []
    discrepancies = []

    # Find related PO via invoice description/reference or linked PO field
    po = None
    if hasattr(vendor_invoice, 'purchase_order') and vendor_invoice.purchase_order:
        po = vendor_invoice.purchase_order
    else:
        # Try to find PO by vendor and approximate amount
        po = (
            PurchaseOrder.objects
            .filter(
                vendor=vendor_invoice.vendor,
                status__in=['APPROVED', 'SENT', 'PARTIAL', 'RECEIVED', 'INVOICED'],
            )
            .order_by('-order_date')
            .first()
        )

    if po is None:
        return {
            'matched': False,
            'checks': [('po_found', False, 'No matching PO found for this invoice')],
            'discrepancies': ['No PO found'],
        }

    # Check 1: Vendor match
    vendor_match = vendor_invoice.vendor_id == po.vendor_id
    checks.append((
        'vendor_match',
        vendor_match,
        f"Invoice vendor: {vendor_invoice.vendor_id}, PO vendor: {po.vendor_id}",
    ))
    if not vendor_match:
        discrepancies.append("Invoice vendor does not match PO vendor")

    # Check 2: Invoice total vs PO total (within tolerance)
    po_total = po.total_amount or Decimal('0')
    inv_total = vendor_invoice.total_amount or Decimal('0')
    if po_total > 0:
        variance_pct = abs(inv_total - po_total) / po_total * 100
    else:
        variance_pct = Decimal('100') if inv_total > 0 else Decimal('0')

    amount_match = variance_pct <= tolerance_pct
    checks.append((
        'amount_match',
        amount_match,
        f"PO total: {po_total}, Invoice total: {inv_total}, Variance: {variance_pct:.2f}%",
    ))
    if not amount_match:
        discrepancies.append(
            f"Invoice amount variance ({variance_pct:.2f}%) exceeds tolerance ({tolerance_pct}%)"
        )

    # Check 3: GRN quantities match PO
    grns = GoodsReceiptNote.objects.filter(
        purchase_order=po,
        status=GoodsReceiptNote.Status.ACCEPTED,
    ).prefetch_related('items__po_item')

    if not grns.exists():
        checks.append(('grn_found', False, 'No accepted GRN found for this PO'))
        discrepancies.append("No accepted GRN found for PO")
    else:
        # Sum accepted quantities per PO item
        grn_qty_map = {}
        grn_value = Decimal('0')
        for grn in grns:
            for grn_item in grn.items.all():
                po_item_id = grn_item.po_item_id
                grn_qty_map[po_item_id] = (
                    grn_qty_map.get(po_item_id, Decimal('0')) + grn_item.accepted_qty
                )
                grn_value += grn_item.accepted_qty * grn_item.po_item.unit_price

        # Compare with PO quantities
        qty_match = True
        for po_item in po.items.all():
            grn_qty = grn_qty_map.get(po_item.id, Decimal('0'))
            if grn_qty < po_item.quantity:
                qty_match = False
                discrepancies.append(
                    f"Item '{po_item.description}': ordered {po_item.quantity}, "
                    f"received {grn_qty}"
                )

        checks.append((
            'quantity_match',
            qty_match,
            f"GRN quantities {'match' if qty_match else 'do not match'} PO quantities",
        ))

        # Check 4: Invoice vs GRN value
        if grn_value > 0:
            grn_variance = abs(inv_total - grn_value) / grn_value * 100
        else:
            grn_variance = Decimal('100') if inv_total > 0 else Decimal('0')

        grn_value_match = grn_variance <= tolerance_pct
        checks.append((
            'grn_value_match',
            grn_value_match,
            f"GRN value: {grn_value}, Invoice: {inv_total}, Variance: {grn_variance:.2f}%",
        ))
        if not grn_value_match:
            discrepancies.append(
                f"Invoice vs GRN value variance ({grn_variance:.2f}%) exceeds tolerance"
            )

    all_passed = all(c[1] for c in checks)

    return {
        'matched': all_passed,
        'po_number': po.po_number,
        'checks': checks,
        'discrepancies': discrepancies,
    }
