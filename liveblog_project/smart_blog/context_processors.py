from django.conf import settings
from django.core.cache import cache
from django.db.models import Q

from .models import Notification

NOTIFICATIONS_CACHE_TIMEOUT = 30  # seconds
NOTIFICATIONS_CACHE_KEY = "notifications_count_{user_id}"


def invalidate_notifications_cache(user_id):
    """Call after creating/reading notifications to refresh count on next request."""
    cache.delete(NOTIFICATIONS_CACHE_KEY.format(user_id=user_id))


def notifications_context(request):
    if not request.user.is_authenticated:
        return {"notifications_count": 0, "notifications_count_label": ""}

    cache_key = NOTIFICATIONS_CACHE_KEY.format(user_id=request.user.pk)
    count = cache.get(cache_key)
    if count is None:
        count = (
            Notification.objects
            .filter(recipient=request.user, is_read=False)
            .exclude(item__isnull=True)
            .exclude(
                Q(notif_type=Notification.TYPE_REPLY, reply_comment__isnull=True) |
                Q(notif_type=Notification.TYPE_REPLY, parent_comment__isnull=True) |
                Q(notif_type=Notification.TYPE_COMMENT_LIKE, parent_comment__isnull=True, reply_comment__isnull=True)
            )
            .count()
        )
        cache.set(cache_key, count, timeout=NOTIFICATIONS_CACHE_TIMEOUT)
    label = ""
    if count > 0:
        label = "10+" if count >= 10 else str(count)
    return {
        "notifications_count": count,
        "notifications_count_label": label,
    }


def spellcheck_context(request):
    """Add spellcheck_lang for templates (used by data-spellcheck-lang)."""
    if request.path.startswith("/admin/"):
        return {"spellcheck_lang": "en"}
    return {"spellcheck_lang": getattr(settings, "SPELLCHECK_LANG", "ru")}
