"""Dashboard view for admin panel."""
import json
from django.shortcuts import render
from django.utils import timezone
from django.contrib.auth import get_user_model

from admin_panel.decorators import admin_required
from admin_panel.services.analytics_service import get_activity_chart_data

User = get_user_model()


@admin_required
def dashboard_view(request):
    """Main dashboard at /admin."""
    today = timezone.localdate()

    # Main stats
    from smart_blog.models import Item, Comment, ContentReport, Like, Bookmark
    from backups.models import Backup
    total_posts = Item.objects.count()
    total_users = User.objects.count()
    total_comments = Comment.objects.filter(parent__isnull=True).count()
    total_likes = Like.objects.count()
    total_bookmarks = Bookmark.objects.count()
    total_replies = Comment.objects.filter(parent__isnull=False).count()
    total_backups = Backup.objects.count()
    total_views = sum(Item.objects.values_list('views_count', flat=True))
    total_reposts = sum(Item.objects.values_list('reposts_count', flat=True))

    # Today stats
    posts_today = Item.objects.filter(published_date__date=today).count()
    users_today = User._base_manager.filter(date_joined__date=today).count()
    comments_today = Comment.objects.filter(created__date=today).count()
    reports_today = ContentReport.objects.filter(created_at__date=today).count()

    activity_data = get_activity_chart_data(days=14)
    activity_json = json.dumps(activity_data)

    context = {
        'total_posts': total_posts,
        'total_users': total_users,
        'total_comments': total_comments,
        'total_likes': total_likes,
        'total_bookmarks': total_bookmarks,
        'total_replies': total_replies,
        'total_backups': total_backups,
        'total_views': total_views,
        'total_reposts': total_reposts,
        'posts_today': posts_today,
        'users_today': users_today,
        'comments_today': comments_today,
        'reports_today': reports_today,
        'activity_data': activity_data,
        'activity_json': activity_json,
    }
    return render(request, 'admin/dashboard/dashboard.html', context)
