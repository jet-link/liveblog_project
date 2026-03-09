"""Analytics views."""
from django.shortcuts import render
from django.db.models import Sum

from admin_panel.decorators import admin_required
from admin_panel.services.analytics_service import (
    get_top_posts_by_popularity,
    get_views_growth,
    get_users_growth,
    get_comments_growth,
)


@admin_required
def analytics_view(request):
    """Analytics dashboard."""
    top_posts = get_top_posts_by_popularity(limit=20)
    views_growth = get_views_growth(days=30)
    users_growth = get_users_growth(days=30)
    comments_growth = get_comments_growth(days=30)

    context = {
        'top_posts': top_posts,
        'views_growth': views_growth,
        'users_growth': users_growth,
        'comments_growth': comments_growth,
    }
    return render(request, 'admin/analytics/analytics.html', context)
