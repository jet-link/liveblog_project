# admin_ui/templatetags/admin_ui_tags.py
from django import template
from django.contrib.auth import get_user_model
from django.db.models import Count
from django.utils import timezone

register = template.Library()
User = get_user_model()


@register.inclusion_tag('admin/dashboard_stats.html')
def get_dashboard_stats():
    """Dashboard statistics for admin panel."""
    from smart_blog.models import Item, Comment, ContentReport, Like
    return {
        'users_count': User.objects.count(),
        'posts_count': Item.objects.count(),
        'comments_count': Comment.objects.count(),
        'reports_count': ContentReport.objects.count(),
        'likes_count': Like.objects.count(),
    }


@register.inclusion_tag('admin/dashboard_latest.html')
def get_dashboard_latest():
    """Latest items for dashboard."""
    from smart_blog.models import Item, Comment, ContentReport
    return {
        'latest_users': User.objects.order_by('-date_joined')[:5],
        'latest_posts': Item.objects.select_related('author').order_by('-created')[:5],
        'latest_comments': Comment.objects.select_related('author', 'item').order_by('-created')[:5],
        'latest_reports': ContentReport.objects.select_related('reporter', 'item', 'comment').order_by('-created_at')[:5],
    }
