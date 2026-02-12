"""Business logic services for finance module."""

import logging
from decimal import Decimal
from django.db.models import Sum, Q
from django.utils import timezone

logger = logging.getLogger('hrms')


class FinancialStatementService:
    """Generate financial statements from GL data."""

    @staticmethod
    def generate_trial_balance(fiscal_period):
        """Aggregate JournalLines by Account for a given period."""
        from .models import JournalLine, Account

        lines = JournalLine.objects.filter(
            journal_entry__fiscal_period=fiscal_period,
            journal_entry__status='POSTED',
        ).values(
            'account__code', 'account__name', 'account__account_type'
        ).annotate(
            total_debit=Sum('debit_amount'),
            total_credit=Sum('credit_amount'),
        ).order_by('account__code')

        return list(lines)

    @staticmethod
    def generate_income_statement(fiscal_period):
        """Revenue vs Expenses for a period."""
        from .models import JournalLine

        data = JournalLine.objects.filter(
            journal_entry__fiscal_period=fiscal_period,
            journal_entry__status='POSTED',
        ).filter(
            Q(account__account_type='REVENUE') | Q(account__account_type='EXPENSE')
        ).values(
            'account__code', 'account__name', 'account__account_type'
        ).annotate(
            total_debit=Sum('debit_amount'),
            total_credit=Sum('credit_amount'),
        ).order_by('account__account_type', 'account__code')

        return list(data)

    @staticmethod
    def validate_journal_entry(entry):
        """Ensure debits = credits."""
        totals = entry.lines.aggregate(
            total_debit=Sum('debit_amount'),
            total_credit=Sum('credit_amount')
        )
        debit = totals['total_debit'] or Decimal('0')
        credit = totals['total_credit'] or Decimal('0')
        if debit != credit:
            return False, f"Debits ({debit}) != Credits ({credit})"
        if debit == 0:
            return False, "Journal entry has no amounts"
        return True, "Valid"
