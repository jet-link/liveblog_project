"""Content violations moderation views."""
from urllib.parse import urlencode
from django.shortcuts import render, get_object_or_404, redirect
from django.http import JsonResponse
from django.contrib import messages
from django.core.paginator import Paginator
from django.db import transaction
from django.db.models import Q
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.http import require_GET, require_POST

from admin_panel.decorators import admin_required
from admin_panel.models import ContentViolation
from smart_blog.models import Item, Comment


@admin_required
@require_GET
def content_violations_list(request):
    """List content violations with search and filters."""
    if not request.user.is_superuser:
        return redirect('admin_panel:dashboard')

    qs = ContentViolation.objects.select_related(
        'item', 'comment', 'analysis_run',
        'item__author', 'comment__author',
    )

    # Search (author username, detected word)
    search = request.GET.get('q', '').strip()
    if search:
        qs = qs.filter(
            Q(detected_word__icontains=search)
            | Q(item__author__username__icontains=search)
            | Q(comment__author__username__icontains=search)
        )

    # Type filter
    content_type = request.GET.get('type')
    if content_type == 'post':
        qs = qs.filter(content_type=ContentViolation.TYPE_POST)
    elif content_type == 'comment':
        qs = qs.filter(content_type=ContentViolation.TYPE_COMMENT)

    # Status filter
    status_filter = request.GET.get('status')
    if status_filter and status_filter in ('pending', 'checked', 'ignored'):
        qs = qs.filter(status=status_filter)

    # Analysis run filter
    analysis_id = request.GET.get('analysis_id')
    if analysis_id:
        try:
            qs = qs.filter(analysis_run_id=int(analysis_id))
        except (ValueError, TypeError):
            pass

    qs = qs.filter(deleted_at__isnull=True)
    qs = qs.order_by('-created_at')
    paginator = Paginator(qs, 30)
    page = request.GET.get('page', 1)
    violations = paginator.get_page(page)

    filter_params = {}
    if search:
        filter_params['q'] = search
    if content_type:
        filter_params['type'] = content_type
    if status_filter:
        filter_params['status'] = status_filter
    if analysis_id:
        filter_params['analysis_id'] = analysis_id
    page_num = request.GET.get('page')
    if page_num:
        filter_params['page'] = page_num
    filter_qs = urlencode(filter_params) if filter_params else ''

    context = {
        'violations': violations,
        'search': search,
        'current_type': content_type,
        'current_status': status_filter,
        'analysis_id': analysis_id,
        'filter_qs': filter_qs,
    }
    return render(request, 'admin/moderation/content_violations.html', context)


@admin_required
@require_POST
def content_violation_check(request, pk):
    """Mark violation as checked."""
    if not request.user.is_superuser:
        return JsonResponse({'success': False}, status=403)
    v = get_object_or_404(ContentViolation, pk=pk)
    v.status = ContentViolation.STATUS_CHECKED
    v.save(update_fields=['status'])
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return JsonResponse({
            'success': True,
            'new_status': v.status,
        })
    filter_qs = request.GET.urlencode()
    url = reverse('admin_panel:content_violations_list')
    if filter_qs:
        url += '?' + filter_qs
    return redirect(url)


@admin_required
@require_POST
def content_violation_ignore(request, pk):
    """Mark violation as ignored."""
    if not request.user.is_superuser:
        return JsonResponse({'success': False}, status=403)
    v = get_object_or_404(ContentViolation, pk=pk)
    v.status = ContentViolation.STATUS_IGNORED
    v.save(update_fields=['status'])
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return JsonResponse({
            'success': True,
            'new_status': v.status,
        })
    filter_qs = request.GET.urlencode()
    url = reverse('admin_panel:content_violations_list')
    if filter_qs:
        url += '?' + filter_qs
    return redirect(url)


@admin_required
@require_POST
def content_violation_clear(request, pk):
    """Move violation to Recent deleted (soft), do NOT delete post/comment."""
    if not request.user.is_superuser:
        return JsonResponse({'success': False}, status=403)
    v = get_object_or_404(ContentViolation, pk=pk)
    v.deleted_at = timezone.now()
    v.save(update_fields=['deleted_at'])
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return JsonResponse({'success': True, 'removed': True})
    messages.success(request, 'Violation moved to Recent deleted.')
    filter_qs = request.GET.urlencode()
    url = reverse('admin_panel:content_violations_list')
    if filter_qs:
        url += '?' + filter_qs
    return redirect(url)


@admin_required
@require_GET
def content_violation_confirm_delete(request, pk):
    """Show confirmation page before deleting post/comment."""
    if not request.user.is_superuser:
        return redirect('admin_panel:dashboard')
    v = get_object_or_404(ContentViolation, pk=pk)
    target_name = ''
    target_type = ''
    if v.item:
        target_name = v.item.title or '(no title)'
        target_type = 'post'
    elif v.comment:
        target_name = (v.comment.text or '')[:80]
        target_type = 'comment'
    filter_qs = request.GET.urlencode()
    return render(request, 'admin/moderation/content_violation_confirm_delete.html', {
        'violation': v,
        'target_name': target_name,
        'target_type': target_type,
        'filter_qs': filter_qs,
    })


@admin_required
@require_POST
def content_violation_delete_content(request, pk):
    """Delete the actual post or comment (with confirmation, usually from modal)."""
    if not request.user.is_superuser:
        return JsonResponse({'success': False}, status=403)
    v = get_object_or_404(ContentViolation, pk=pk)
    # Get author BEFORE deletion; Comment/Item are removed on delete, so post_delete signal cannot fetch them
    author = None
    if v.item_id and v.item:
        author = v.item.author
    elif v.comment_id and v.comment:
        author = v.comment.author
    if v.item_id:
        item = v.item
        if item:
            title = (item.title or '')[:50]
            item.delete()
            messages.success(request, f'Post "{title}..." deleted.')
    elif v.comment_id:
        comment = v.comment
        if comment:
            comment.delete()
            messages.success(request, 'Comment deleted.')
    else:
        v.delete()
    # Recalculate trust score after CASCADE; signal cannot get author when content is deleted
    if author:
        def _recalc():
            try:
                from admin_panel.services.trust_score_service import update_user_trust_score
                update_user_trust_score(author)
            except Exception:
                pass
        transaction.on_commit(_recalc)

    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return JsonResponse({'success': True, 'removed': True})
    filter_qs = request.GET.urlencode()
    url = reverse('admin_panel:content_violations_list')
    if filter_qs:
        url += '?' + filter_qs
    return redirect(url)


@admin_required
@require_POST
def content_violations_bulk_clear(request):
    """Bulk clear selected violations (remove from table, not delete content)."""
    if not request.user.is_superuser:
        return JsonResponse({'success': False}, status=403)
    ids = request.POST.getlist('ids[]') or request.POST.getlist('ids')
    valid_ids = []
    for x in ids:
        try:
            valid_ids.append(int(x))
        except (ValueError, TypeError):
            pass
    if valid_ids:
        n = ContentViolation.objects.filter(pk__in=valid_ids).update(deleted_at=timezone.now())
        messages.success(request, f'{n} violation(s) moved to Recent deleted.')
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return JsonResponse({'success': True})
    filter_qs = request.GET.urlencode()
    url = reverse('admin_panel:content_violations_list')
    if filter_qs:
        url += '?' + filter_qs
    return redirect(url)


@admin_required
@require_POST
def content_violations_bulk_delete_content(request):
    """Bulk delete actual posts/comments for selected violations."""
    if not request.user.is_superuser:
        return JsonResponse({'success': False}, status=403)
    ids = request.POST.getlist('ids[]') or request.POST.getlist('ids')
    valid_ids = []
    for x in ids:
        try:
            valid_ids.append(int(x))
        except (ValueError, TypeError):
            pass
    if valid_ids:
        viols = ContentViolation.objects.filter(pk__in=valid_ids).select_related('item', 'comment')
        authors_to_recalc = set()
        deleted_count = 0
        for v in viols:
            author = None
            if v.item_id and v.item:
                author = v.item.author_id
                v.item.delete()
                deleted_count += 1
            elif v.comment_id and v.comment:
                author = v.comment.author_id
                v.comment.delete()
                deleted_count += 1
            if author:
                authors_to_recalc.add(author)
        for uid in authors_to_recalc:
            if not uid:
                continue
            try:
                from django.contrib.auth import get_user_model
                User = get_user_model()
                u = User.objects.filter(pk=uid).first()
                if u:
                    def _recalc(usr=u):
                        try:
                            from admin_panel.services.trust_score_service import update_user_trust_score
                            update_user_trust_score(usr)
                        except Exception:
                            pass
                    transaction.on_commit(_recalc)
            except Exception:
                pass
        messages.success(request, f'{deleted_count} post(s)/comment(s) deleted.')
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return JsonResponse({'success': True})
    filter_qs = request.GET.urlencode()
    url = reverse('admin_panel:content_violations_list')
    if filter_qs:
        url += '?' + filter_qs
    return redirect(url)
