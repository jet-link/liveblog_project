"""User management views."""
from django.shortcuts import render, redirect, get_object_or_404
from django.urls import reverse
from django.contrib import messages
from django.core.paginator import Paginator
from django.db.models import Q, Count
from django.contrib.auth import get_user_model

from admin_panel.decorators import admin_required
from admin_panel.models import DeletedUserLog
from smart_blog.models import Item, Comment

User = get_user_model()


@admin_required
def users_list(request):
    """List users with search, pagination."""
    qs = User.objects.select_related('profile').annotate(
        posts_count=Count('items', distinct=True),
        comments_count=Count('comments', distinct=True),
    )
    qs = qs.order_by('-date_joined')

    search = request.GET.get('q', '').strip()
    if search:
        qs = qs.filter(
            Q(username__icontains=search) | Q(email__icontains=search)
        )

    status = request.GET.get('status')
    if status == 'banned':
        qs = qs.filter(is_active=False)
    else:
        qs = qs.filter(is_active=True)

    paginator = Paginator(qs, 25)
    page = request.GET.get('page', 1)
    users = paginator.get_page(page)

    context = {'users': users, 'search': search, 'current_status': status}
    return render(request, 'admin/users/users_list.html', context)


@admin_required
def banned_users_list(request):
    """List banned users only. Search + bulk Unban."""
    qs = User.objects.filter(is_active=False).annotate(
        posts_count=Count('items', distinct=True),
        comments_count=Count('comments', distinct=True),
    ).order_by('-date_joined')

    search = request.GET.get('q', '').strip()
    if search:
        qs = qs.filter(
            Q(username__icontains=search) | Q(email__icontains=search)
        )

    paginator = Paginator(qs, 25)
    page = request.GET.get('page', 1)
    users = paginator.get_page(page)
    return render(request, 'admin/users/banned_users_list.html', {'users': users, 'search': search})


@admin_required
def user_profile(request, pk):
    """View user profile (admin detail)."""
    user = get_object_or_404(User.objects.select_related('profile'), pk=pk)
    posts = Item.objects.filter(author=user, is_published=True).order_by('-published_date')[:10]
    comments = Comment.objects.filter(author=user, item__is_published=True, is_draft=False).order_by('-created')[:10]
    context = {'user_obj': user, 'posts': posts, 'comments': comments}
    return render(request, 'admin/users/user_profile.html', context)


@admin_required
def user_ban(request, pk):
    """Ban user (set is_active=False)."""
    user = get_object_or_404(User, pk=pk)
    if user.is_staff:
        messages.error(request, 'Cannot ban admin users.')
        url = reverse('admin_panel:users_list')
        qs = request.GET.urlencode()
        if qs:
            url += '?' + qs
        return redirect(url)
    if request.method == 'POST':
        if user == request.user:
            messages.error(request, 'You cannot ban yourself.')
        elif user.is_superuser:
            messages.error(request, 'Cannot ban superuser.')
        else:
            user.is_active = False
            user.save()
            messages.success(request, f'User {user.username} has been banned.')
        url = reverse('admin_panel:users_list')
        qs = request.GET.copy()
        qs['status'] = 'active'
        return redirect(url + '?' + qs.urlencode())
    return render(request, 'admin/users/user_confirm_ban.html', {'user_obj': user})


@admin_required
def user_unban(request, pk):
    """Unban user (set is_active=True)."""
    user = get_object_or_404(User, pk=pk)
    if user.is_staff:
        messages.error(request, 'Cannot unban admin users.')
        url = reverse('admin_panel:banned_users') if request.GET.get('from') == 'banned' else reverse('admin_panel:users_list')
        qs = request.GET.copy()
        qs.pop('from', None)
        qs = qs.urlencode()
        if qs:
            url += '?' + qs
        return redirect(url)
    if request.method == 'POST':
        user.is_active = True
        user.save()
        messages.success(request, f'User {user.username} has been unbanned.')
        if request.GET.get('from') == 'banned':
            url = reverse('admin_panel:banned_users')
            qs = request.GET.copy()
            qs.pop('from', None)
            qs = qs.urlencode()
            if qs:
                url += '?' + qs
            return redirect(url)
        url = reverse('admin_panel:users_list')
        qs = request.GET.copy()
        qs.pop('from', None)
        qs['status'] = 'active'
        return redirect(url + '?' + qs.urlencode())
    from_banned = request.GET.get('from') == 'banned'
    qs = request.GET.copy()
    qs.pop('from', None)
    qs = qs.urlencode()
    if from_banned:
        cancel_url = reverse('admin_panel:banned_users') + ('?' + qs if qs else '')
    else:
        cancel_url = reverse('admin_panel:users_list') + ('?' + qs if qs else '')
    return render(request, 'admin/users/user_confirm_unban.html', {
        'user_obj': user,
        'cancel_url': cancel_url,
    })


@admin_required
def user_delete(request, pk):
    """Delete user account."""
    user = get_object_or_404(User, pk=pk)
    if user.is_staff:
        messages.error(request, 'Cannot delete admin users.')
        url = reverse('admin_panel:users_list')
        qs = request.GET.urlencode()
        if qs:
            url += '?' + qs
        return redirect(url)
    if request.method == 'POST':
        if user == request.user:
            messages.error(request, 'You cannot delete yourself.')
        elif user.is_superuser:
            messages.error(request, 'Cannot delete superuser.')
        else:
            username = user.username
            DeletedUserLog.objects.create(username=username, deleted_by=request.user)
            user.delete()
            messages.success(request, f'User {username} has been deleted.')
        url = reverse('admin_panel:users_list')
        qs = request.GET.urlencode()
        if qs:
            url += '?' + qs
        return redirect(url)
    return render(request, 'admin/users/user_confirm_delete.html', {'user_obj': user})


@admin_required
def recently_deleted_list(request):
    """List recently deleted users (from DeletedUserLog)."""
    qs = DeletedUserLog.objects.select_related('deleted_by').order_by('-deleted_at')

    search = request.GET.get('q', '').strip()
    if search:
        qs = qs.filter(username__icontains=search)

    paginator = Paginator(qs, 25)
    page = request.GET.get('page', 1)
    logs = paginator.get_page(page)
    return render(request, 'admin/users/recently_deleted_list.html', {
        'logs': logs,
        'search': search,
    })
