"""User management views."""
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.core.paginator import Paginator
from django.db.models import Q, Count
from django.contrib.auth import get_user_model

from admin_panel.decorators import admin_required
from smart_blog.models import Item, Comment

User = get_user_model()


@admin_required
def users_list(request):
    """List users with search, pagination."""
    qs = User.objects.annotate(
        posts_count=Count('items', distinct=True),
        comments_count=Count('comments', distinct=True),
    ).order_by('-date_joined')

    search = request.GET.get('q', '').strip()
    if search:
        qs = qs.filter(
            Q(username__icontains=search) | Q(email__icontains=search)
        )

    status = request.GET.get('status')
    if status == 'active':
        qs = qs.filter(is_active=True)
    elif status == 'banned':
        qs = qs.filter(is_active=False)

    paginator = Paginator(qs, 25)
    page = request.GET.get('page', 1)
    users = paginator.get_page(page)

    context = {'users': users, 'search': search, 'current_status': status}
    return render(request, 'admin/users/users_list.html', context)


@admin_required
def banned_users_list(request):
    """List banned users only."""
    qs = User.objects.filter(is_active=False).annotate(
        posts_count=Count('items', distinct=True),
        comments_count=Count('comments', distinct=True),
    ).order_by('-date_joined')
    paginator = Paginator(qs, 25)
    page = request.GET.get('page', 1)
    users = paginator.get_page(page)
    return render(request, 'admin/users/banned_users_list.html', {'users': users})


@admin_required
def user_profile(request, pk):
    """View user profile (admin detail)."""
    user = get_object_or_404(User, pk=pk)
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
        return redirect('admin_panel:user_profile', pk=pk)
    if request.method == 'POST':
        if user == request.user:
            messages.error(request, 'You cannot ban yourself.')
        elif user.is_superuser:
            messages.error(request, 'Cannot ban superuser.')
        else:
            user.is_active = False
            user.save()
            messages.success(request, f'User {user.username} has been banned.')
        return redirect('admin_panel:users_list')
    return render(request, 'admin/users/user_confirm_ban.html', {'user_obj': user})


@admin_required
def user_unban(request, pk):
    """Unban user (set is_active=True)."""
    user = get_object_or_404(User, pk=pk)
    if user.is_staff:
        messages.error(request, 'Cannot unban admin users.')
        return redirect('admin_panel:user_profile', pk=pk)
    if request.method == 'POST':
        user.is_active = True
        user.save()
        messages.success(request, f'User {user.username} has been unbanned.')
        return redirect('admin_panel:users_list')
    return render(request, 'admin/users/user_confirm_unban.html', {'user_obj': user})


@admin_required
def user_delete(request, pk):
    """Delete user account."""
    user = get_object_or_404(User, pk=pk)
    if user.is_staff:
        messages.error(request, 'Cannot delete admin users.')
        return redirect('admin_panel:user_profile', pk=pk)
    if request.method == 'POST':
        if user == request.user:
            messages.error(request, 'You cannot delete yourself.')
        elif user.is_superuser:
            messages.error(request, 'Cannot delete superuser.')
        else:
            username = user.username
            user.delete()
            messages.success(request, f'User {username} has been deleted.')
        return redirect('admin_panel:users_list')
    return render(request, 'admin/users/user_confirm_delete.html', {'user_obj': user})
