"""Celery tasks for project management."""

import logging
from datetime import date, timedelta
from decimal import Decimal

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task
def check_project_deadlines():
    """
    Check for overdue projects and tasks.
    Marks overdue milestones and sends notifications to project managers.
    Should be run daily via Celery Beat.
    """
    from projects.models import Project, ProjectTask, Milestone
    from core.models import Notification

    today = date.today()
    results = {
        'overdue_projects': 0,
        'overdue_tasks': 0,
        'overdue_milestones': 0,
        'notifications_sent': 0,
    }

    try:
        # --- Overdue Projects ---
        overdue_projects = Project.objects.filter(
            status=Project.Status.ACTIVE,
            end_date__lt=today,
        ).select_related('project_manager')

        results['overdue_projects'] = overdue_projects.count()

        for project in overdue_projects:
            days_overdue = (today - project.end_date).days

            if project.project_manager and hasattr(project.project_manager, 'user') and project.project_manager.user:
                user = project.project_manager.user
                # Avoid duplicate notifications (check last 7 days)
                existing = Notification.objects.filter(
                    user=user,
                    extra_data__contains={'project_id': str(project.id), 'type': 'project_overdue'},
                    created_at__date__gte=today - timedelta(days=7),
                ).exists()

                if not existing:
                    Notification.objects.create(
                        user=user,
                        title=f'Project Overdue: {project.code}',
                        message=(
                            f'Project "{project.name}" ({project.code}) is {days_overdue} day(s) '
                            f'past its end date ({project.end_date.strftime("%d %b %Y")}). '
                            f'Current completion: {project.completion_percentage}%.'
                        ),
                        notification_type='WARNING',
                        link='/projects/',
                        extra_data={
                            'project_id': str(project.id),
                            'type': 'project_overdue',
                            'days_overdue': days_overdue,
                        },
                    )
                    results['notifications_sent'] += 1

        # --- Overdue Tasks ---
        overdue_tasks = ProjectTask.objects.filter(
            status__in=[ProjectTask.Status.NOT_STARTED, ProjectTask.Status.IN_PROGRESS],
            end_date__lt=today,
            project__status=Project.Status.ACTIVE,
        ).select_related('assigned_to', 'project')

        results['overdue_tasks'] = overdue_tasks.count()

        for task in overdue_tasks:
            if task.assigned_to and hasattr(task.assigned_to, 'user') and task.assigned_to.user:
                user = task.assigned_to.user
                existing = Notification.objects.filter(
                    user=user,
                    extra_data__contains={'task_id': str(task.id), 'type': 'task_overdue'},
                    created_at__date__gte=today - timedelta(days=7),
                ).exists()

                if not existing:
                    days_overdue = (today - task.end_date).days
                    Notification.objects.create(
                        user=user,
                        title=f'Task Overdue: {task.name}',
                        message=(
                            f'Task "{task.name}" on project {task.project.code} is '
                            f'{days_overdue} day(s) past its due date '
                            f'({task.end_date.strftime("%d %b %Y")}).'
                        ),
                        notification_type='WARNING',
                        link='/projects/',
                        extra_data={
                            'task_id': str(task.id),
                            'project_id': str(task.project.id),
                            'type': 'task_overdue',
                            'days_overdue': days_overdue,
                        },
                    )
                    results['notifications_sent'] += 1

        # --- Overdue Milestones ---
        overdue_milestones = Milestone.objects.filter(
            status__in=[Milestone.Status.PENDING, Milestone.Status.IN_PROGRESS],
            due_date__lt=today,
            project__status=Project.Status.ACTIVE,
        ).select_related('project', 'project__project_manager')

        for milestone in overdue_milestones:
            milestone.status = Milestone.Status.OVERDUE
            milestone.save(update_fields=['status', 'updated_at'])
            results['overdue_milestones'] += 1

        logger.info(
            "Project deadline check complete: %d overdue projects, %d overdue tasks, "
            "%d milestones marked overdue, %d notifications sent",
            results['overdue_projects'],
            results['overdue_tasks'],
            results['overdue_milestones'],
            results['notifications_sent'],
        )
        return {'status': 'success', **results}

    except Exception as e:
        logger.exception("Project deadline check failed: %s", e)
        return {'status': 'error', 'message': str(e)}


@shared_task
def calculate_project_costs(project_id):
    """
    Recalculate actual costs for a project from approved timesheets and resource rates.

    Computes:
    - Total cost from approved timesheets using resource hourly rates.
    - Updates project.actual_cost.
    - Updates each task's actual_hours from approved timesheets.

    Args:
        project_id: UUID (string) of the project.
    """
    from projects.models import Project, Timesheet, Resource

    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        logger.error("calculate_project_costs: Project %s not found", project_id)
        return {'status': 'error', 'message': f'Project {project_id} not found'}

    try:
        # Build a lookup of hourly rates by employee from Resource allocations
        resource_rates = {}
        for resource in project.resources.all():
            resource_rates[resource.employee_id] = resource.hourly_rate or Decimal('0')

        # Get all approved timesheets for this project
        approved_timesheets = Timesheet.objects.filter(
            project=project,
            status=Timesheet.Status.APPROVED,
        ).select_related('task')

        total_cost = Decimal('0')
        task_hours = {}  # task_id -> total hours

        for ts in approved_timesheets:
            rate = resource_rates.get(ts.employee_id, Decimal('0'))
            total_cost += ts.hours * rate

            # Accumulate hours per task
            if ts.task_id:
                task_hours[ts.task_id] = task_hours.get(ts.task_id, Decimal('0')) + ts.hours

        # Update project actual cost
        project.actual_cost = total_cost
        project.save(update_fields=['actual_cost', 'updated_at'])

        # Update actual hours on each task
        if task_hours:
            from projects.models import ProjectTask
            for task_id, hours in task_hours.items():
                ProjectTask.objects.filter(pk=task_id).update(actual_hours=hours)

        logger.info(
            "Project cost calculation complete for %s: actual_cost=%s, tasks_updated=%d",
            project.code, total_cost, len(task_hours),
        )
        return {
            'status': 'success',
            'project_id': str(project.id),
            'project_code': project.code,
            'actual_cost': str(total_cost),
            'tasks_updated': len(task_hours),
        }

    except Exception as e:
        logger.exception("Project cost calculation failed for %s: %s", project_id, e)
        return {'status': 'error', 'message': str(e)}
