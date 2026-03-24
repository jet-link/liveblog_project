from django.core.management.base import BaseCommand

from smart_blog.services.trending_service import (
    calculate_trending,
    rollup_item_stats_hourly_for_hour,
)


class Command(BaseCommand):
    help = "Recalculate trending scores and optionally rollup last hour stats."

    def add_arguments(self, parser):
        parser.add_argument(
            "--rollup-hourly",
            action="store_true",
            help="Also run hourly rollup for the previous completed local hour.",
        )

    def handle(self, *args, **options):
        if options["rollup_hourly"]:
            n = rollup_item_stats_hourly_for_hour()
            self.stdout.write(self.style.SUCCESS(f"Hourly rollup rows upserted: {n}"))
        written = calculate_trending()
        self.stdout.write(self.style.SUCCESS(f"TrendingItem rows updated: {written}"))
