from django.db import models

# Import builder models so Django discovers them for migrations
from reports.builder_models import ReportDefinition, ScheduledReport, ReportExecution  # noqa: E402, F401
