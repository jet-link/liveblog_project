"""
Content moderation analysis (for cron or manual run).

Usage:
  python manage.py content_analyze              # Check now (all content)
  python manage.py content_analyze --schedule hourly
  python manage.py content_analyze --schedule daily

Cron examples:
  0 * * * * cd /path && python manage.py content_analyze --schedule hourly
  0 2 * * * cd /path && python manage.py content_analyze --schedule daily
"""
from django.core.management.base import BaseCommand

from admin_panel.services.content_analyzer import run_content_analysis


class Command(BaseCommand):
    help = 'Run content moderation analysis. --schedule hourly|daily for time-filtered runs.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--schedule',
            type=str,
            choices=['now', 'hourly', 'daily'],
            default='now',
            help='Schedule: now (all), hourly (last 1h), daily (last 24h)',
        )

    def handle(self, *args, **options):
        schedule = options.get('schedule', 'now')

        def log(msg):
            self.stdout.write(msg)

        run = run_content_analysis(schedule=schedule, log_callback=log)
        self.stdout.write(
            self.style.SUCCESS(f'Analysis {run.status}: {run.progress}%')
        )
