"""Comment moderation views."""
from django.shortcuts import render, redirect, get_object_or_404
from django.urls import reverse
from django.contrib import messages
from django.core.paginator import Paginator
from django.db.models import Q
from django.http import JsonResponse

from admin_panel.decorators import admin_required
from smart_blog.models import Comment
from django.contrib.auth import get_user_model

User = get_user_model()


@admin_required
def comments_list(request):
    """List comments with search, filter, pagination."""
    qs = Comment.objects.select_related('item', 'author', 'parent').order_by('-created')

    search = request.GET.get('q', '').strip()
    if search:
        qs = qs.filter(Q(text__icontains=search) | Q(author__username__icontains=search))

    item_slug = request.GET.get('item')
    if item_slug:
        qs = qs.filter(item__slug=item_slug)

    filter_type = request.GET.get('filter', 'all')
    if filter_type == 'root':
        qs = qs.filter(parent__isnull=True)
    elif filter_type == 'child':
        qs = qs.filter(parent__isnull=False)

    paginator = Paginator(qs, 30)
    page = request.GET.get('page', 1)
    comments = paginator.get_page(page)

    context = {'comments': comments, 'search': search, 'filter_type': filter_type}
    return render(request, 'admin/comments/comments_list.html', context)


@admin_required
def comment_delete(request, pk):
    """Delete comment."""
    comment = get_object_or_404(Comment, pk=pk)
    if request.method == 'POST':
        comment.delete()
        messages.success(request, 'Comment deleted.')
        url = reverse('admin_panel:comments_list')
        qs = request.GET.urlencode()
        if qs:
            url += '?' + qs
        return redirect(url)
    return render(request, 'admin/comments/comment_confirm_delete.html', {'comment': comment})


@admin_required
def comment_confirm_draft(request, pk):
    """Confirmation page to set comment as draft."""
    comment = get_object_or_404(Comment, pk=pk)
    if request.method == 'POST':
        comment.is_draft = True
        comment.save()
        messages.success(request, 'Comment set as Draft.')
        url = reverse('admin_panel:comments_list')
        qs = request.GET.urlencode()
        if qs:
            url += '?' + qs
        return redirect(url)
    return render(request, 'admin/comments/comment_confirm_draft.html', {'comment': comment})


@admin_required
def comment_confirm_activate(request, pk):
    """Confirmation page to set comment as active."""
    comment = get_object_or_404(Comment, pk=pk)
    if request.method == 'POST':
        comment.is_draft = False
        comment.save()
        messages.success(request, 'Comment set as Active.')
        url = reverse('admin_panel:comments_list')
        qs = request.GET.urlencode()
        if qs:
            url += '?' + qs
        return redirect(url)
    return render(request, 'admin/comments/comment_confirm_activate.html', {'comment': comment})
