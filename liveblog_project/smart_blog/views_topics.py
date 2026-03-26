from datetime import timedelta
from urllib.parse import urlencode

from django.core.paginator import Paginator
from django.db.models import Count, OuterRef, Q, Subquery
from django.shortcuts import get_object_or_404, render
from django.urls import reverse
from django.utils import timezone

from smart_blog.models import Category, Item, TrendingItem
from smart_blog.utils import breadcrumb, build_breadcrumbs
from smart_blog.views import annotate_user_bookmarked, annotate_user_liked

LIST_PER_PAGE = 40
FEATURED_COUNT = 6


def _trending_category_ids(limit=40):
    return set(
        TrendingItem.objects.filter(item__category__isnull=False)
        .order_by("-trend_score")[:limit]
        .values_list("item__category_id", flat=True)
    )


def topics_list(request):
    trending_cat_ids = _trending_category_ids()

    latest_title = Subquery(
        Item.objects.filter(category_id=OuterRef("pk"), is_published=True)
        .order_by("-published_date")
        .values("title")[:1]
    )

    qs = (
        Category.objects.annotate(
            posts_count=Count("items", filter=Q(items__is_published=True)),
            recent_7d=Count(
                "items",
                filter=Q(
                    items__is_published=True,
                    items__published_date__gte=timezone.now() - timedelta(days=7),
                ),
            ),
            latest_post_title=latest_title,
        )
        .filter(posts_count__gt=0)
    )

    qs = qs.order_by("-posts_count", "-recent_7d", "name")
    all_topics = list(qs)

    featured = all_topics[:FEATURED_COUNT]

    breadcrumbs = build_breadcrumbs(
        breadcrumb("Topics", None),
    )

    return render(
        request,
        "smart_blog/topics_list.html",
        {
            "topics_featured": featured,
            "topics_all": all_topics,
            "trending_category_ids": trending_cat_ids,
            "breadcrumbs": breadcrumbs,
        },
    )


_VALID_TOPIC_SORT = frozenset({"latest", "liked", "discussed"})


def _topic_listing_source_url(request, category_slug, sort):
    path = reverse("smart_blog:topic_detail", kwargs={"slug": category_slug})
    q = {}
    if sort != "latest":
        q["sort"] = sort
    if q:
        path = f"{path}?{urlencode(q)}"
    return request.build_absolute_uri(path)


def _topic_extra_qs(sort):
    if sort != "latest":
        return f"sort={sort}&"
    return ""


def topic_detail(request, slug):
    category = get_object_or_404(Category, slug=slug)
    sort = (request.GET.get("sort") or "latest").lower()
    if sort not in _VALID_TOPIC_SORT:
        sort = "latest"

    qs = (
        Item.objects.filter(is_published=True, category=category)
        .with_counters()
        .select_related("category", "author", "author__profile")
        .prefetch_related("images", "tags")
    )
    qs = annotate_user_liked(qs, request.user)
    qs = annotate_user_bookmarked(qs, request.user)

    if sort == "liked":
        qs = qs.order_by("-likes_count", "-published_date", "-pk")
    elif sort == "discussed":
        qs = qs.order_by("-comments_count", "-published_date", "-pk")
    else:
        qs = qs.order_by("-published_date", "-pk")

    paginator = Paginator(qs, LIST_PER_PAGE)
    page_obj = paginator.get_page(request.GET.get("page"))
    page_range = paginator.get_elided_page_range(
        number=page_obj.number,
        on_each_side=1,
        on_ends=1,
    )

    breadcrumbs = build_breadcrumbs(
        breadcrumb("Topics", reverse("smart_blog:topics_list")),
        breadcrumb(category.name, None),
    )

    ctx = {
        "category": category,
        "topic_sort": sort,
        "page_obj": page_obj,
        "page_range": page_range,
        "items": page_obj.object_list,
        "breadcrumbs": breadcrumbs,
        "listing_source_url": _topic_listing_source_url(request, category.slug, sort),
        "topic_extra_qs": _topic_extra_qs(sort),
    }

    if request.GET.get("partial") == "1":
        return render(request, "smart_blog/includes/topic_hub_feed.html", ctx)

    return render(request, "smart_blog/topic_hub.html", ctx)
