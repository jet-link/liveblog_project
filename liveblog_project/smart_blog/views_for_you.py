from django.core.paginator import Paginator
from django.shortcuts import render

from smart_blog.services.for_you_recommendations import (
    for_you_items_for_authenticated_user,
    for_you_items_guest,
)
from smart_blog.utils import breadcrumb, build_breadcrumbs
from smart_blog.views import annotate_user_bookmarked, annotate_user_liked
from smart_blog.models import Item

LIST_PER_PAGE = 40


def _annotate_page_items(user, page_obj):
    """Re-fetch current page items with counters + user liked/bookmarked flags."""
    pks = [obj.pk for obj in page_obj.object_list]
    if not pks:
        return []
    qs = (
        Item.objects.filter(pk__in=pks)
        .with_counters()
        .select_related("category", "author", "author__profile")
        .prefetch_related("images", "tags")
    )
    qs = annotate_user_liked(qs, user)
    qs = annotate_user_bookmarked(qs, user)
    by_pk = {obj.pk: obj for obj in qs}
    return [by_pk[pk] for pk in pks if pk in by_pk]


def for_you_list(request):
    if request.user.is_authenticated:
        result = for_you_items_for_authenticated_user(request.user)
    else:
        result = for_you_items_guest()

    paginator = Paginator(result.items, LIST_PER_PAGE)
    page_obj = paginator.get_page(request.GET.get("page"))
    page_range = paginator.get_elided_page_range(
        number=page_obj.number,
        on_each_side=1,
        on_ends=1,
    )

    items = _annotate_page_items(request.user, page_obj)

    breadcrumbs = build_breadcrumbs(
        breadcrumb("For you", None),
    )

    return render(
        request,
        "smart_blog/for_you_list.html",
        {
            "page_obj": page_obj,
            "page_range": page_range,
            "items": items,
            "low_personal_signal": result.low_personal_signal,
            "breadcrumbs": breadcrumbs,
        },
    )
