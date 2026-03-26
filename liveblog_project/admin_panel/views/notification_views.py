"""Admin: all user notifications (moderation)."""
from django.contrib import messages
from django.core.paginator import Paginator
from django.db.models import Q
from django.shortcuts import redirect, render
from django.urls import reverse

from admin_panel.decorators import admin_required
from smart_blog.models import Notification


@admin_required
def notifications_list(request):
    qs = (
        Notification.objects.select_related(
            "recipient", "actor", "item", "parent_comment", "reply_comment"
        )
        .order_by("-created_at")
    )
    search = request.GET.get("q", "").strip()
    if search:
        qs = qs.filter(
            Q(recipient__username__icontains=search)
            | Q(actor__username__icontains=search)
            | Q(item__title__icontains=search)
        )
    paginator = Paginator(qs, 30)
    page = request.GET.get("page", 1)
    rows = paginator.get_page(page)
    return render(
        request,
        "admin/moderation/notifications_list.html",
        {"rows": rows, "search": search},
    )


@admin_required
def notifications_bulk_clear(request):
    if request.method != "POST":
        return redirect("admin_panel:notifications_list")
    from admin_panel.views.bulk_views import _get_ids

    ids = _get_ids(request)
    valid = []
    for x in ids:
        try:
            valid.append(int(x))
        except (TypeError, ValueError):
            pass
    if valid:
        Notification.objects.filter(pk__in=valid).update(cleared_from_inbox=True)
        messages.success(request, f"{len(valid)} notification(s) cleared from inbox flags.")
    return redirect(_notifications_redirect(request))


@admin_required
def notifications_bulk_delete(request):
    if request.method != "POST":
        return redirect("admin_panel:notifications_list")
    from admin_panel.views.bulk_views import _get_ids

    ids = _get_ids(request)
    valid = []
    for x in ids:
        try:
            valid.append(int(x))
        except (TypeError, ValueError):
            pass
    if valid:
        n, _ = Notification.objects.filter(pk__in=valid).delete()
        messages.success(request, f"{n} notification row(s) removed from database.")
    return redirect(_notifications_redirect(request))


def _notifications_redirect(request):
    url = reverse("admin_panel:notifications_list")
    qs = request.GET.urlencode()
    return f"{url}?{qs}" if qs else url
