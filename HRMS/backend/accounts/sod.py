"""
Segregation of Duties (SoD) enforcement for ERP operations.
Prevents the same user from performing conflicting operations.
"""
import logging
from django.core.exceptions import PermissionDenied

logger = logging.getLogger('hrms')

# Define SoD conflict pairs as (action_a, action_b, risk_description)
SOD_RULES = [
    ('finance.create_vendor', 'finance.approve_vendor_payment', 'Fictitious vendor fraud'),
    ('procurement.create_purchase_order', 'procurement.approve_purchase_order', 'Unauthorized purchasing'),
    ('finance.create_journal_entry', 'finance.post_journal_entry', 'Unauthorized GL manipulation'),
    ('procurement.receive_goods', 'finance.record_vendor_invoice', 'Collusion in procurement fraud'),
    ('inventory.manage_asset_register', 'inventory.approve_asset_disposal', 'Asset theft/misappropriation'),
    ('payroll.process_payroll', 'payroll.approve_payroll', 'Ghost employee fraud'),
    ('finance.create_budget', 'finance.approve_budget', 'Budget manipulation'),
    ('procurement.create_requisition', 'procurement.approve_requisition', 'Self-approval of purchases'),
    ('procurement.create_rfq', 'procurement.evaluate_rfq', 'Bid rigging/vendor favoritism'),
    ('finance.create_credit_note', 'finance.approve_credit_note', 'Revenue manipulation'),
    ('inventory.initiate_stock_adjustment', 'inventory.approve_stock_adjustment', 'Inventory fraud'),
    ('manufacturing.create_work_order', 'manufacturing.approve_work_order', 'Production fraud'),
]


def check_sod(user, action, target_object=None):
    """
    Check if performing `action` would violate SoD rules for this user.
    
    Looks at the user's permissions and the history of actions on the target object
    to ensure the same user doesn't perform both sides of a conflict pair.
    
    Args:
        user: The User attempting the action
        action: String action code (e.g., 'finance.post_journal_entry')
        target_object: Optional - the object being acted upon (to check created_by)
    
    Returns:
        (allowed: bool, violation_message: str or None)
    """
    for action_a, action_b, risk in SOD_RULES:
        # Check if current action is part of a conflict pair
        if action == action_a:
            conflicting_action = action_b
        elif action == action_b:
            conflicting_action = action_a
        else:
            continue
        
        # If target_object is provided, check if the same user performed the conflicting action
        if target_object:
            created_by = getattr(target_object, 'created_by', None)
            approved_by = getattr(target_object, 'approved_by', None)
            posted_by = getattr(target_object, 'posted_by', None)
            
            # For approval/posting actions, check the creator wasn't the same user
            if action in (action_b,) and created_by and created_by == user:
                msg = f"SoD violation: You cannot perform '{action}' because you created this record. Risk: {risk}"
                logger.warning(f"SoD violation blocked: user={user.email}, action={action}, risk={risk}")
                return False, msg
            
            # For creation actions, check a previous approver
            if action in (action_a,) and approved_by and approved_by == user:
                msg = f"SoD violation: You cannot perform '{action}' because you approved this record. Risk: {risk}"
                logger.warning(f"SoD violation blocked: user={user.email}, action={action}, risk={risk}")
                return False, msg
    
    return True, None


def enforce_sod(user, action, target_object=None):
    """Same as check_sod but raises PermissionDenied on violation."""
    allowed, message = check_sod(user, action, target_object)
    if not allowed:
        raise PermissionDenied(message)
