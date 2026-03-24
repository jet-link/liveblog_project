"""Tests for trending velocity scoring."""

import math
import uuid
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from django.contrib.auth import get_user_model

from smart_blog.models import Item, ItemStatsHourly, ItemView, TrendingItem
from smart_blog.services import trending_service as ts

User = get_user_model()


class TrendingFormulaTests(TestCase):
    def test_trend_score_formula(self):
        """Matches (v + 2L + 3C) / (h+2)^1.5."""
        h = 10.0
        score = ts.trend_score_from_stats(100, 10, 5, h)
        expected = (100 + 20 + 15) / math.pow(h + 2, 1.5)
        self.assertAlmostEqual(score, expected, places=6)

    def test_growth_rate_division_by_zero_guard(self):
        self.assertEqual(ts.growth_rate_from_views(5, 0), 5.0)
        self.assertEqual(ts.growth_rate_from_views(0, 0), 0.0)


class TrendingTrustFilterTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("trend_u1", "t1@test.com", "pass")
        self.user.profile.trust_score = 2.0
        self.user.profile.save()
        self.item = Item.objects.create(
            author=self.user,
            title="Low trust post",
            text="Body",
            slug="low-trust-trend",
            is_published=True,
        )

    def test_low_trust_author_excluded_from_calculate(self):
        ts.calculate_trending()
        self.assertFalse(TrendingItem.objects.filter(item=self.item).exists())

    def test_ok_trust_included(self):
        self.user.profile.trust_score = 3.0
        self.user.profile.save()
        ts.calculate_trending()
        self.assertTrue(TrendingItem.objects.filter(item=self.item).exists())


class TrendingStaleCleanupTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("trend_u2", "t2@test.com", "pass")
        self.item = Item.objects.create(
            author=self.user,
            title="Old",
            text="Body",
            slug="old-trend",
            is_published=True,
            published_date=timezone.now() - timedelta(days=30),
        )
        TrendingItem.objects.create(
            item=self.item,
            trend_score=1.0,
            views_24h=1,
            likes_24h=0,
            comments_24h=0,
            growth_rate=1.0,
        )

    def test_stale_trending_row_removed_when_outside_window(self):
        """Items older than ACTIVE_DAYS are not recalculated; stale TrendingItem deleted."""
        ts.calculate_trending()
        self.assertFalse(TrendingItem.objects.filter(item=self.item).exists())


class TrendingSevenDayWindowTests(TestCase):
    """published_date within ACTIVE_DAYS is included."""

    def setUp(self):
        self.user = User.objects.create_user("trend_u3", "t3@test.com", "pass")

    def test_recent_within_window_gets_trending_row(self):
        item = Item.objects.create(
            author=self.user,
            title="Recent",
            text="Body",
            slug="recent-7d",
            is_published=True,
            published_date=timezone.now() - timedelta(days=ts.ACTIVE_DAYS - 1),
        )
        ts.calculate_trending()
        self.assertTrue(TrendingItem.objects.filter(item=item).exists())


class TrendingRollupTests(TestCase):
    """Hourly rollup writes ItemStatsHourly; growth uses it when available."""

    def setUp(self):
        self.user = User.objects.create_user("trend_u4", "t4@test.com", "pass")
        self.item = Item.objects.create(
            author=self.user,
            title="Rollup",
            text="Body",
            slug="rollup-test",
            is_published=True,
        )

    def test_rollup_hourly_creates_row_for_view_in_bucket(self):
        now = timezone.now()
        hour_start, hour_end = ts.previous_completed_hour_bounds(now)
        v = ItemView.objects.create(item=self.item, session_key=f"rollup_sess_{uuid.uuid4().hex}")
        ItemView.objects.filter(pk=v.pk).update(viewed_at=hour_start + timedelta(minutes=30))
        n = ts.rollup_item_stats_hourly_for_hour(hour_start_local=hour_start, now=now)
        self.assertGreaterEqual(n, 1)
        row = ItemStatsHourly.objects.get(item=self.item, hour_start=hour_start)
        self.assertEqual(row.views, 1)

    def test_growth_prefers_hourly_when_buckets_present(self):
        now = timezone.now()
        cur = ts.local_hour_floor(now)
        last_start = cur - timedelta(hours=1)
        prev_start = cur - timedelta(hours=2)
        ItemStatsHourly.objects.create(item=self.item, hour_start=prev_start, views=2, likes=0, comments=0)
        ItemStatsHourly.objects.create(item=self.item, hour_start=last_start, views=10, likes=0, comments=0)
        g = ts.growth_rate_from_hourly(self.item, now)
        self.assertIsNotNone(g)
        self.assertAlmostEqual(g, 10.0 / 2.0, places=5)


class TrendingOneHourStatsTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("trend_u5", "t5@test.com", "pass")
        self.item = Item.objects.create(
            author=self.user,
            title="1h",
            text="Body",
            slug="1h-stats",
            is_published=True,
        )

    def test_get_last_1h_stats_empty(self):
        s = ts.get_last_1h_stats(self.item, timezone.now())
        self.assertEqual(s["views"], 0)
        self.assertEqual(s["likes"], 0)
        self.assertEqual(s["comments"], 0)
