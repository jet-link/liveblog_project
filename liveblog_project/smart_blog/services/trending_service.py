"""
Velocity-based trending for published Items (rolling 24h / 1h metrics, last ACTIVE_DAYS by published_date).

Score: (views + 2·likes + 3·comments) / (hours_since_post + 2)^1.5.
Growth: last two completed local hours from ItemStatsHourly when present, else live ItemView counts.
Trust: authors with profile.trust_score < TRUST_SCORE_MIN are skipped.
"""
from __future__ import annotations

import math
from datetime import timedelta

from django.core.cache import cache
from django.utils import timezone

from smart_blog.models import Comment, Item, ItemStatsHourly, ItemView, Like, TrendingItem

TRENDING_API_CACHE_KEY = "trending:api_snapshot"

TRUST_SCORE_MIN = 3.0
ACTIVE_DAYS = 7
HOURS_24 = 24


def _author_trust_ok(item: Item) -> bool:
    author = item.author
    if author is None:
        return True
    score = float(getattr(getattr(author, "profile", None), "trust_score", 10.0))
    return score >= TRUST_SCORE_MIN


def _published_anchor(item: Item):
    return item.published_date or item.created


def get_last_24h_stats(item: Item, now=None) -> dict:
    """Raw counts from ItemView / Like / Comment in the last 24 hours."""
    now = now or timezone.now()
    since = now - timedelta(hours=HOURS_24)
    views = ItemView.objects.filter(item=item, viewed_at__gte=since, viewed_at__lte=now).count()
    likes = Like.objects.filter(item=item, created_at__gte=since, created_at__lte=now).count()
    comments = Comment.objects.filter(
        item=item,
        is_draft=False,
        created__gte=since,
        created__lte=now,
    ).count()
    return {"views": views, "likes": likes, "comments": comments}


def _window_counts(item: Item, start, end) -> dict:
    """Counts strictly in [start, end)."""
    views = ItemView.objects.filter(item=item, viewed_at__gte=start, viewed_at__lt=end).count()
    likes = Like.objects.filter(item=item, created_at__gte=start, created_at__lt=end).count()
    comments = Comment.objects.filter(
        item=item, is_draft=False, created__gte=start, created__lt=end
    ).count()
    return {"views": views, "likes": likes, "comments": comments}


def local_hour_floor(dt):
    """Start of calendar hour in TIME_ZONE as aware datetime."""
    tz = timezone.get_current_timezone()
    local = timezone.localtime(dt, tz)
    return local.replace(minute=0, second=0, microsecond=0)


def previous_completed_hour_bounds(now=None):
    """Return (hour_start, hour_end) for the last fully closed local hour."""
    now = now or timezone.now()
    cur_floor = local_hour_floor(now)
    hour_start = cur_floor - timedelta(hours=1)
    hour_end = cur_floor
    return hour_start, hour_end


def get_views_last_and_prev_hour(item: Item, now=None) -> tuple[int, int]:
    """Views in last closed hour vs previous closed hour (local TZ), from live ItemView."""
    now = now or timezone.now()
    cur_floor = local_hour_floor(now)
    last_start = cur_floor - timedelta(hours=1)
    last_end = cur_floor
    prev_start = cur_floor - timedelta(hours=2)
    prev_end = cur_floor - timedelta(hours=1)
    v_last = ItemView.objects.filter(item=item, viewed_at__gte=last_start, viewed_at__lt=last_end).count()
    v_prev = ItemView.objects.filter(item=item, viewed_at__gte=prev_start, viewed_at__lt=prev_end).count()
    return v_last, v_prev


def trend_score_from_stats(views: int, likes: int, comments: int, hours_since_post: float) -> float:
    numerator = views * 1.0 + likes * 2.0 + comments * 3.0
    denom = math.pow(max(hours_since_post, 0.0) + 2.0, 1.5)
    if denom <= 0:
        return 0.0
    return numerator / denom


def growth_rate_from_views(v_last: int, v_prev: int) -> float:
    return float(v_last) / float(max(v_prev, 1))


def calculate_trending(now=None) -> int:
    """
    Recompute TrendingItem for all eligible posts. Deletes stale rows.
    Returns number of TrendingItem rows written.
    """
    now = now or timezone.now()
    since = now - timedelta(days=ACTIVE_DAYS)
    qs = (
        Item.objects.filter(is_published=True, published_date__gte=since)
        .select_related("author", "author__profile")
        .order_by("pk")
    )

    written = 0
    seen_ids: list[int] = []

    for item in qs.iterator(chunk_size=200):
        if not _author_trust_ok(item):
            continue
        stats = get_last_24h_stats(item, now)
        stats_1h = get_last_1h_stats(item, now)
        growth = _growth_for_item(item, now)

        anchor = _published_anchor(item)
        hours = (now - anchor).total_seconds() / 3600.0
        score = trend_score_from_stats(
            stats["views"], stats["likes"], stats["comments"], hours
        )

        TrendingItem.objects.update_or_create(
            item=item,
            defaults={
                "trend_score": score,
                "views_24h": stats["views"],
                "likes_24h": stats["likes"],
                "comments_24h": stats["comments"],
                "growth_rate": growth,
                "views_last_hour": stats_1h["views"],
                "likes_1h": stats_1h["likes"],
                "comments_1h": stats_1h["comments"],
            },
        )
        written += 1
        seen_ids.append(item.pk)

    if seen_ids:
        TrendingItem.objects.exclude(item_id__in=seen_ids).delete()
    else:
        TrendingItem.objects.all().delete()

    cache.delete(TRENDING_API_CACHE_KEY)
    return written


def rollup_item_stats_hourly_for_hour(hour_start_local=None, now=None) -> int:
    """
    Fill ItemStatsHourly for one hour bucket [hour_start, hour_start+1h) in local TZ.
    If hour_start_local is None, uses the previous completed hour.
    Returns number of rows upserted.
    """
    now = now or timezone.now()
    if hour_start_local is None:
        hour_start_local, hour_end_local = previous_completed_hour_bounds(now)
    else:
        hour_end_local = hour_start_local + timedelta(hours=1)

    # Aggregate distinct items with any activity in window
    item_ids = set(
        ItemView.objects.filter(viewed_at__gte=hour_start_local, viewed_at__lt=hour_end_local).values_list(
            "item_id", flat=True
        )
    )
    item_ids.update(
        Like.objects.filter(created_at__gte=hour_start_local, created_at__lt=hour_end_local).values_list(
            "item_id", flat=True
        )
    )
    item_ids.update(
        Comment.objects.filter(
            created__gte=hour_start_local,
            created__lt=hour_end_local,
            is_draft=False,
        ).values_list("item_id", flat=True)
    )

    count = 0
    for iid in item_ids:
        cts = _window_counts(Item(pk=iid), hour_start_local, hour_end_local)
        ItemStatsHourly.objects.update_or_create(
            item_id=iid,
            hour_start=hour_start_local,
            defaults={
                "views": cts["views"],
                "likes": cts["likes"],
                "comments": cts["comments"],
            },
        )
        count += 1
    return count


def get_views_from_hourly(item: Item, hour_start_local) -> int:
    row = ItemStatsHourly.objects.filter(item=item, hour_start=hour_start_local).first()
    return row.views if row else 0


def get_last_1h_stats(item: Item, now=None) -> dict:
    """Rolling last 60 minutes (wall clock); mirrors get_last_24h_stats window shape."""
    now = now or timezone.now()
    since = now - timedelta(hours=1)
    views = ItemView.objects.filter(item=item, viewed_at__gte=since, viewed_at__lte=now).count()
    likes = Like.objects.filter(item=item, created_at__gte=since, created_at__lte=now).count()
    comments = Comment.objects.filter(
        item=item,
        is_draft=False,
        created__gte=since,
        created__lte=now,
    ).count()
    return {"views": views, "likes": likes, "comments": comments}


def live_display_metrics_for_item(item: Item, now=None) -> dict:
    """Live rolling counts for API and templates (avoids stale TrendingItem snapshots)."""
    s24 = get_last_24h_stats(item, now)
    s1 = get_last_1h_stats(item, now)
    return {
        "views_24h": s24["views"],
        "likes_24h": s24["likes"],
        "comments_24h": s24["comments"],
        "views_last_hour": s1["views"],
        "likes_1h": s1["likes"],
        "comments_1h": s1["comments"],
    }


def growth_rate_from_hourly(item: Item, now=None) -> float | None:
    """Growth from last two completed hourly buckets in ItemStatsHourly (if any data)."""
    now = now or timezone.now()
    cur_floor = local_hour_floor(now)
    last_start = cur_floor - timedelta(hours=1)
    prev_start = cur_floor - timedelta(hours=2)
    v_last = get_views_from_hourly(item, last_start)
    v_prev = get_views_from_hourly(item, prev_start)
    if v_last == 0 and v_prev == 0:
        return None
    return growth_rate_from_views(v_last, v_prev)


def _growth_for_item(item: Item, now) -> float:
    gh = growth_rate_from_hourly(item, now)
    if gh is not None:
        return gh
    v_last, v_prev = get_views_last_and_prev_hour(item, now)
    return growth_rate_from_views(v_last, v_prev)
