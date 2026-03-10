"""Report moderation views."""
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.core.paginator import Paginator
from django.db.models import Count, Q

from admin_panel.decorators import admin_required
from smart_blog.models import ContentReport, Item, Comment
from django.contrib.auth import get_user_model

User = get_user_model()


@admin_required
def reports_list(request):
    """List content reports."""
    qs = ContentReport.objects.select_related('reporter', 'item', 'comment').filter(
        status=ContentReport.STATUS_OPEN
    ).order_by('-created_at')
    qs = qs.exclude(item__is_published=False).exclude(comment__is_draft=True)

    target = request.GET.get('target')
    if target == 'item':
        qs = qs.filter(item__isnull=False)
    elif target == 'comment':
        qs = qs.filter(comment__isnull=False)

    reason = request.GET.get('reason')
    if reason:
        qs = qs.filter(reason=reason)

    paginator = Paginator(qs, 25)
    page = request.GET.get('page', 1)
    reports = paginator.get_page(page)

    context = {
        'reports': reports,
        'current_target': target,
        'current_reason': reason,
    }
    return render(request, 'admin/reports/reports_list.html', context)


@admin_required
def report_dismiss(request, pk):
    """Dismiss report (mark resolved)."""
    report = get_object_or_404(ContentReport, pk=pk)
    if request.method == 'POST':
        report.status = ContentReport.STATUS_RESOLVED
        report.save()
        messages.success(request, 'Report dismissed.')
        return redirect('admin_panel:reports_list')
    return redirect('admin_panel:reports_list')


@admin_required
def report_delete_content(request, pk):
    """Delete reported content (item or comment)."""
    report = get_object_or_404(ContentReport, pk=pk)
    if request.method == 'POST':
        if report.item:
            report.item.delete()
            messages.success(request, 'Reported post deleted.')
        elif report.comment:
            report.comment.delete()
            messages.success(request, 'Reported comment deleted.')
        report.status = ContentReport.STATUS_RESOLVED
        report.save()
        return redirect('admin_panel:reports_list')
    return render(request, 'admin/reports/report_confirm_delete_content.html', {'report': report})


@admin_required
def report_ban_user(request, pk):
    """Ban user from report (reported content author)."""
    report = get_object_or_404(ContentReport, pk=pk)
    user = None
    if report.item and report.item.author:
        user = report.item.author
    elif report.comment and report.comment.author:
        user = report.comment.author
    if not user:
        messages.error(request, 'No user to ban.')
        return redirect('admin_panel:reports_list')
    if request.method == 'POST':
        if user == request.user:
            messages.error(request, 'You cannot ban yourself.')
        elif user.is_superuser:
            messages.error(request, 'Cannot ban superuser.')
        else:
            user.is_active = False
            user.save()
            messages.success(request, f'User {user.username} has been banned.')
        report.status = ContentReport.STATUS_RESOLVED
        report.save()
        return redirect('admin_panel:reports_list')
    return render(request, 'admin/reports/report_confirm_ban.html', {'report': report, 'user_obj': user})
