from django.conf import settings
from django.db.models import Q

from .models import Notification


def notifications_context(request):
    if not request.user.is_authenticated:
        return {"notifications_count": 0, "notifications_count_label": ""}

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
