"""Bulk delete views for admin tables."""
from pathlib import Path

from django.shortcuts import redirect
from django.urls import reverse
from django.contrib import messages
from django.contrib.auth import get_user_model

from admin_panel.decorators import admin_required

User = get_user_model()


def _redirect_with_qs(url_name, request, **kwargs):
    url = reverse(f'admin_panel:{url_name}', kwargs=kwargs)
    qs = request.GET.urlencode()
    if qs:
        url += '?' + qs
    return redirect(url)


def _get_ids(request):
    ids = request.POST.getlist('ids')
    if not ids:
        raw = request.POST.get('ids', '').strip()
        ids = [x.strip() for x in raw.split(',') if x.strip()]
    return ids


@admin_required
def posts_bulk_delete(request):
    """Bulk delete posts. POST ids=slug1,slug2 (slugs)."""
    if request.method != 'POST':
        return redirect('admin_panel:posts_list')
    from smart_blog.models import Item
    slugs = _get_ids(request)
    deleted = 0
    for slug in slugs:
        item = Item.objects.filter(slug=slug).first()
        if item:
            item.delete()
            deleted += 1
    if deleted:
        messages.success(request, f'{deleted} post(s) deleted.')
    return _redirect_with_qs('posts_list', request)


@admin_required
def comments_bulk_delete(request):
    """Bulk delete comments. POST ids=1,2,3."""
    if request.method != 'POST':
        return redirect('admin_panel:comments_list')
    from smart_blog.models import Comment
    ids = _get_ids(request)
    deleted = 0
    for pk in ids:
        try:
            pk_int = int(pk)
            comment = Comment.objects.filter(pk=pk_int).first()
            if comment:
                comment.delete()
                deleted += 1
        except (ValueError, TypeError):
            pass
    if deleted:
        messages.success(request, f'{deleted} comment(s) deleted.')
    return _redirect_with_qs('comments_list', request)


@admin_required
def users_bulk_delete(request):
    """Bulk delete users. Skips staff, superuser, self. POST ids=1,2,3."""
    if request.method != 'POST':
        return redirect('admin_panel:users_list')
    ids = _get_ids(request)
    deleted = 0
    for pk in ids:
        try:
            pk_int = int(pk)
            user = User.objects.filter(pk=pk_int).first()
            if user and not user.is_staff and not user.is_superuser and user != request.user:
                user.delete()
                deleted += 1
        except (ValueError, TypeError):
            pass
    if deleted:
        messages.success(request, f'{deleted} user(s) deleted.')
    return _redirect_with_qs('users_list', request)


@admin_required
def banned_users_bulk_delete(request):
    """Bulk delete banned users. Same logic as users_bulk_delete."""
    if request.method != 'POST':
        return redirect('admin_panel:banned_users')
    ids = _get_ids(request)
    deleted = 0
    for pk in ids:
        try:
            pk_int = int(pk)
            user = User.objects.filter(pk=pk_int).first()
            if user and not user.is_staff and not user.is_superuser and user != request.user:
                user.delete()
                deleted += 1
        except (ValueError, TypeError):
            pass
    if deleted:
        messages.success(request, f'{deleted} user(s) deleted.')
    return redirect('admin_panel:banned_users')


@admin_required
def tags_bulk_delete(request):
    """Bulk delete tags. POST ids=1,2,3."""
    if request.method != 'POST':
        return redirect('admin_panel:tags_list')
    from smart_blog.models import Tag
    ids = _get_ids(request)
    deleted = 0
    for pk in ids:
        try:
            pk_int = int(pk)
            tag = Tag.objects.filter(pk=pk_int).first()
            if tag:
                tag.delete()
                deleted += 1
        except (ValueError, TypeError):
            pass
    if deleted:
        messages.success(request, f'{deleted} tag(s) deleted.')
    return _redirect_with_qs('tags_list', request)


@admin_required
def categories_bulk_delete(request):
    """Bulk delete categories. POST ids=1,2,3."""
    if request.method != 'POST':
        return redirect('admin_panel:categories_list')
    from smart_blog.models import Category
    ids = _get_ids(request)
    deleted = 0
    for pk in ids:
        try:
            pk_int = int(pk)
            cat = Category.objects.filter(pk=pk_int).first()
            if cat:
                cat.delete()
                deleted += 1
        except (ValueError, TypeError):
            pass
    if deleted:
        messages.success(request, f'{deleted} categor(y/ies) deleted.')
    return _redirect_with_qs('categories_list', request)


@admin_required
def reports_bulk_clear(request):
    """Bulk clear: hide reports from admin list (admin_hidden=True), do NOT delete. Records stay for "Already reported". POST ids=1,2,3."""
    if request.method != 'POST':
        return redirect('admin_panel:reports_list')
    from smart_blog.models import ContentReport
    ids = _get_ids(request)
    cleared = 0
    for pk in ids:
        try:
            pk_int = int(pk)
            report = ContentReport.objects.filter(pk=pk_int).first()
            if report:
                report.admin_hidden = True
                report.save(update_fields=['admin_hidden'])
                cleared += 1
        except (ValueError, TypeError):
            pass
    if cleared:
        messages.success(request, f'{cleared} report(s) cleared.')
    return _redirect_with_qs('reports_list', request)


@admin_required
def reports_bulk_delete(request):
    """Bulk delete reported content (item or comment). POST ids=1,2,3."""
    if request.method != 'POST':
        return redirect('admin_panel:reports_list')
    from smart_blog.models import ContentReport
    ids = _get_ids(request)
    deleted = 0
    for pk in ids:
        try:
            pk_int = int(pk)
            report = ContentReport.objects.filter(pk=pk_int).first()
            if report:
                if report.item:
                    report.item.delete()
                    deleted += 1
                elif report.comment:
                    report.comment.delete()
                    deleted += 1
        except (ValueError, TypeError):
            pass
    if deleted:
        messages.success(request, f'{deleted} content item(s) deleted.')
    return _redirect_with_qs('reports_list', request)


@admin_required
def faq_bulk_delete(request):
    """Bulk delete FAQ items. POST ids=1,2,3."""
    if request.method != 'POST':
        return redirect('admin_panel:faq_list')
    from pages.models import FAQItem
    ids = _get_ids(request)
    deleted = 0
    for pk in ids:
        try:
            pk_int = int(pk)
            item = FAQItem.objects.filter(pk=pk_int).first()
            if item:
                item.delete()
                deleted += 1
        except (ValueError, TypeError):
            pass
    if deleted:
        messages.success(request, f'{deleted} FAQ item(s) deleted.')
    return _redirect_with_qs('faq_list', request)


@admin_required
def backups_bulk_delete(request):
    """Bulk delete backups. Superuser only. POST ids=1,2,3."""
    if request.method != 'POST':
        return redirect('admin_panel:backups_list')
    if not request.user.is_superuser:
        from django.http import Http404
        raise Http404
    from backups.models import Backup
    ids = _get_ids(request)
    deleted = 0
    for pk in ids:
        try:
            pk_int = int(pk)
            backup = Backup.objects.filter(pk=pk_int).first()
            if backup:
                if backup.file_path and Path(backup.file_path).exists():
                    try:
                        Path(backup.file_path).unlink()
                    except OSError:
                        pass
                backup.delete()
                deleted += 1
        except (ValueError, TypeError):
            pass
    if deleted:
        messages.success(request, f'{deleted} backup(s) deleted.')
    return redirect('admin_panel:backups_list')
