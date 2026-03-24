from celery import shared_task

from smart_blog.services.trending_service import (
    calculate_trending,
    rollup_item_stats_hourly_for_hour,
)


@shared_task
def update_trending():
    """Recalculate TrendingItem rows (schedule Celery Beat every ~12 min)."""
    return calculate_trending()


@shared_task
def rollup_hourly_stats():
    """Fill ItemStatsHourly for the last completed local hour."""
    return rollup_item_stats_hourly_for_hour()
