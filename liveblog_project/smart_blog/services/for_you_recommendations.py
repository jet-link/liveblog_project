"""MVP personalized recommendations for the For you feed."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from typing import TYPE_CHECKING

from django.db.models import Q
from django.utils import timezone

from smart_blog.models import Bookmark, Item, ItemView, Like, TrendingItem
from smart_blog.search_utils import apply_popular_filter

if TYPE_CHECKING:
    from django.contrib.auth.models import AbstractUser


CANDIDATE_DAYS = 90
FRESH_DAYS = 7
def _base_item_filter(since):
    return (
        Item.objects.filter(is_published=True, published_date__gte=since)
        .filter(Q(author__isnull=True) | Q(author__is_active=True))
        .exclude(author__profile__trust_banned=True)
    )


def _tag_ids_for_item_ids(item_ids):
    if not item_ids:
        return set()
    through = Item.tags.through
    return set(through.objects.filter(item_id__in=item_ids).values_list("tag_id", flat=True))


def _collect_interest_sets(user):
    liked_cat = set(
        c
        for c in Like.objects.filter(user=user).values_list("item__category_id", flat=True)
        if c
    )
    liked_item_ids = set(Like.objects.filter(user=user).values_list("item_id", flat=True))
    liked_tags = _tag_ids_for_item_ids(liked_item_ids)

    bm_cat = set(
        c
        for c in Bookmark.objects.filter(user=user).values_list("item__category_id", flat=True)
        if c
    )
    bm_item_ids = set(Bookmark.objects.filter(user=user).values_list("item_id", flat=True))
    bm_tags = _tag_ids_for_item_ids(bm_item_ids)

    return liked_cat, liked_tags, bm_cat, bm_tags


def score_item_for_user(item, *, liked_cat, liked_tags, bm_cat, bm_tags, trending_ids, read_ids, now):
    s = 0
    cid = item.category_id
    if cid and cid in liked_cat:
        s += 3
    if cid and cid in bm_cat:
        s += 3
    item_tag_ids = {t.pk for t in item.tags.all()}
    interest_tags = liked_tags | bm_tags
    if item_tag_ids and (item_tag_ids & interest_tags):
        s += 2
    if item.pk in trending_ids:
        s += 2
    if (now - item.published_date) <= timedelta(days=FRESH_DAYS):
        s += 1
    if item.pk in read_ids:
        s -= 5
    return s


@dataclass
class ForYouResult:
    items: list
    low_personal_signal: bool


MAX_POOL = 800


def for_you_items_for_authenticated_user(user: AbstractUser) -> ForYouResult:
    now = timezone.now()
    since = now - timedelta(days=CANDIDATE_DAYS)
    liked_cat, liked_tags, bm_cat, bm_tags = _collect_interest_sets(user)
    trending_ids = set(TrendingItem.objects.values_list("item_id", flat=True))
    read_ids = set(ItemView.objects.filter(user=user).values_list("item_id", flat=True))

    has_interaction = Like.objects.filter(user=user).exists() or Bookmark.objects.filter(
        user=user
    ).exists()

    qs = (
        _base_item_filter(since)
        .select_related("category", "author", "author__profile")
        .prefetch_related("images", "tags")
    )
    qs = qs.order_by("-published_date", "-pk")

    pool = list(qs[:MAX_POOL])

    scored = []
    for item in pool:
        sc = score_item_for_user(
            item,
            liked_cat=liked_cat,
            liked_tags=liked_tags,
            bm_cat=bm_cat,
            bm_tags=bm_tags,
            trending_ids=trending_ids,
            read_ids=read_ids,
            now=now,
        )
        scored.append((sc, item))

    scored.sort(key=lambda x: (-x[0], -x[1].published_date.timestamp(), -x[1].pk))
    ordered = [it for _, it in scored]

    top_score = scored[0][0] if scored else 0
    low_personal_signal = (not has_interaction) or (has_interaction and top_score < 2)

    return ForYouResult(items=ordered, low_personal_signal=low_personal_signal)


def for_you_items_guest() -> ForYouResult:
    """Trending + quality recent (popular heuristic), deduped (full list for pagination)."""
    trending_ids_ordered = list(
        TrendingItem.objects.select_related("item")
        .filter(item__is_published=True)
        .order_by("-trend_score")
        .values_list("item_id", flat=True)[:120]
    )
    seen = set()
    items_out = []

    def _append_valid(it: Item | None, pk: int) -> None:
        nonlocal items_out, seen
        if not it or pk in seen:
            return
        if it.author_id and (not it.author.is_active or getattr(
            getattr(it.author, "profile", None), "trust_banned", False
        )):
            return
        items_out.append(it)
        seen.add(pk)

    for pk in trending_ids_ordered:
        it = (
            Item.objects.filter(pk=pk, is_published=True)
            .select_related("category", "author", "author__profile")
            .prefetch_related("images", "tags")
            .first()
        )
        _append_valid(it, pk)

    since = timezone.now() - timedelta(days=CANDIDATE_DAYS)
    pop_qs = apply_popular_filter(
        Item.objects.filter(is_published=True, published_date__gte=since)
        .filter(Q(author__isnull=True) | Q(author__is_active=True))
        .exclude(author__profile__trust_banned=True)
    )
    pop_qs = pop_qs.select_related("category", "author", "author__profile").prefetch_related(
        "images", "tags"
    )
    for it in pop_qs[:200]:
        if it.pk not in seen:
            items_out.append(it)
            seen.add(it.pk)

    return ForYouResult(items=items_out, low_personal_signal=False)
