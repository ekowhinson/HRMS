"""
Entity creator registration.

Import this module to register all creators with the global registry.
"""

from ..registry import import_registry
from .employee_transaction import (
    EmployeeTransactionCreator,
    EmployeeTransactionValidator,
    EmployeeTransactionMatcher,
)
from .employee import EmployeeCreator, EmployeeValidator, EmployeeMatcher
from .pay_component import PayComponentCreator, PayComponentValidator, PayComponentMatcher
from .bank import BankCreator, BankValidator, BankMatcher
from .bank_account import BankAccountCreator, BankAccountValidator, BankAccountMatcher


def register_all():
    """Register all entity creators with the global registry."""
    import_registry.register(
        'EMPLOYEE_TRANSACTION',
        creator=EmployeeTransactionCreator(),
        validator=EmployeeTransactionValidator(),
        matcher=EmployeeTransactionMatcher(),
    )
    import_registry.register(
        'EMPLOYEE',
        creator=EmployeeCreator(),
        validator=EmployeeValidator(),
        matcher=EmployeeMatcher(),
    )
    import_registry.register(
        'PAY_COMPONENT',
        creator=PayComponentCreator(),
        validator=PayComponentValidator(),
        matcher=PayComponentMatcher(),
    )
    import_registry.register(
        'BANK',
        creator=BankCreator(),
        validator=BankValidator(),
        matcher=BankMatcher(),
    )
    import_registry.register(
        'BANK_ACCOUNT',
        creator=BankAccountCreator(),
        validator=BankAccountValidator(),
        matcher=BankAccountMatcher(),
    )


register_all()
