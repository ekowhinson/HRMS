"""
Django settings package for NHIA HRMS.

Routes to the correct settings module based on the DJANGO_ENV environment variable:
  - "production"  -> config.settings.production
  - "staging"     -> config.settings.staging
  - default       -> config.settings.development
"""

import os

env = os.getenv("DJANGO_ENV", "development").lower()

if env == "production":
    from config.settings.production import *  # noqa: F401,F403
elif env == "staging":
    from config.settings.staging import *  # noqa: F401,F403
else:
    from config.settings.development import *  # noqa: F401,F403
