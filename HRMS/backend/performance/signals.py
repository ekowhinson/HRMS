"""
Signals for performance module.
Auto-creates training needs from completed appraisals.
"""

from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender='performance.Appraisal')
def auto_create_training_need(sender, instance, **kwargs):
    """
    When an appraisal is completed with training_recommended=True,
    auto-create a TrainingNeed record if one doesn't exist.
    """
    if instance.status != 'COMPLETED':
        return

    if not instance.training_recommended:
        return

    from performance.models import TrainingNeed

    # Check if a training need already exists for this appraisal
    existing = TrainingNeed.objects.filter(appraisal=instance).exists()
    if existing:
        return

    TrainingNeed.objects.create(
        employee=instance.employee,
        appraisal=instance,
        title=f'Training need from appraisal - {instance.appraisal_cycle}',
        description=f'Training recommended during {instance.appraisal_cycle} appraisal review. {instance.manager_comments[:200] if instance.manager_comments else ""}',
        training_type='TRAINING',
        priority='MEDIUM',
        status='IDENTIFIED',
        created_by=instance.created_by,
    )
