"""
Leave utility functions.
"""

from datetime import date, timedelta


def count_working_days(start_date: date, end_date: date) -> int:
    """
    Count working days from start_date (inclusive) to end_date (exclusive).
    Excludes weekends (Saturday/Sunday) and public holidays.
    Returns 0 if end_date <= start_date.
    """
    if end_date <= start_date:
        return 0

    from organization.models import Holiday

    # Fetch all holidays in the range in a single query
    holidays = set(
        Holiday.objects.filter(
            date__gte=start_date,
            date__lt=end_date,
            is_deleted=False,
        ).values_list('date', flat=True)
    )

    count = 0
    current = start_date
    while current < end_date:
        # weekday(): 0=Monday ... 6=Sunday; 5,6 are weekend
        if current.weekday() < 5 and current not in holidays:
            count += 1
        current += timedelta(days=1)

    return count
