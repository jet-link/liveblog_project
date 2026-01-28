from django.shortcuts import render
from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from login.forms import CustomUserCreationForm, LoginForm, UserEditForm, PasswordChangeSimpleForm
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from django.urls import reverse
from smart_blog.models import Item
from login.models import Profile
from django.views.decorators.http import require_POST
from django.templatetags.static import static
from django.http import JsonResponse, Http404
from django.db.models import Count, Q, Max
from smart_blog.utils import count_convert, build_breadcrumbs, breadcrumb, strip_mention_tokens
from smart_blog.models import Notification
from django.core.exceptions import PermissionDenied

# Авторизация пользователя
def login_view(request):
    if request.user.is_authenticated:
        return redirect('login_app:profile', username=request.user.username)

    if request.method == 'POST':
        form = LoginForm(request.POST or None)
        if form.is_valid():
            username = form.cleaned_data['username']
            password = form.cleaned_data['password']
            remember = form.cleaned_data.get('remember')

            user = authenticate(request, username=username, password=password)
            if user is not None:
                login(request, user)
                # сессия
                if remember:
                    request.session.set_expiry(1209600)  # 2 weeks
                else:
                    request.session.set_expiry(0)  # until browser close

                messages.success(request, f'Welcome back, {user.username}!')
                # return redirect('/', username=user.username)
                return redirect('login_app:profile', username=user.username)
            else:
                # неверный логин/пароль — добавим ошибку не к конкретному полю, а к форме
                form.add_error(None, "Username or password incorrect")
        # если form.is_valid() == False — будут показаны ошибки required и т.д.
    else:
        form = LoginForm()

    return render(request, 'accounts/login.html', {'form': form})


# Регистация пользователя
def register_view(request):
    if request.user.is_authenticated:
        return redirect('login_app:profile', username=request.user.username)

    if request.method == 'POST':
        form = CustomUserCreationForm(request.POST)
        if form.is_valid():
            user = form.save()  # сохраняем User

            # optional avatar
            avatar = form.cleaned_data.get('avatar_url', '') or ''

            # гарантированно получить или создать профиль
            profile, created = Profile.objects.get_or_create(user=user)

            if avatar:
                profile.avatar_url = avatar
                profile.save()

            messages.success(request, 'Registration successful. You can log in now.')
            return redirect('login_app:login')
        else:
            messages.error(request, 'Please fix the errors below.')
    else:
        form = CustomUserCreationForm()

    return render(request, 'accounts/register.html', {'form': form})


# Просмотр пользователя
try:
    from smart_blog.models import Bookmark
except Exception:
    Bookmark = None

MAIN_COMMENTS_ANNOTATION = {
    'main_comments_count': Count(
        'comments',
        filter=Q(comments__parent__isnull=True)
    )
}

# detail profile view
def profile_view(request, username):
    user_obj = get_object_or_404(User, username=username)


    # --- базовые queryset'ы ---
    user_items_qs = (
        Item.objects
        .with_counters()
        .filter(author=user_obj)
        .order_by('-published_date')
    )

    liked_items_qs = (
        Item.objects
        .with_counters()
        .filter(likes__user=user_obj)
        .annotate(
            liked_at=Max(
                'likes__created_at',
                filter=Q(likes__user=user_obj)
            )
        )
        .order_by('-liked_at')
        .distinct()
    )

    if Bookmark is not None:
        bookmarked_items_qs = (
            Item.objects
            .with_counters()
            .filter(bookmarked_by__user=user_obj)
            .annotate(
                bookmarked_at=Max(
                    'bookmarked_by__created_at',
                    filter=Q(bookmarked_by__user=user_obj)
                )
            )
            .order_by('-bookmarked_at')
            .distinct()
        )
    else:
        try:
            bookmarked_items_qs = (
                Item.objects
                .filter(bookmarked_by=user_obj)
                .order_by('-published_date')
                .select_related('author')
                .prefetch_related('images')
            )
        except Exception:
            bookmarked_items_qs = Item.objects.none()

    def apply_human_counts(items):
        for item in items:
            item.views_count_human = count_convert(item.views_count)
            item.likes_count_human = count_convert(item.likes_count)
            item.bookmarks_count_human = count_convert(item.bookmarks_count)
            item.comments_count_human = count_convert(item.comments_count)

    SECTION_LIMIT = 10
    created_items = list(user_items_qs[:SECTION_LIMIT])
    apply_human_counts(created_items)

    is_owner = request.user.is_authenticated and request.user == user_obj
    liked_items = []
    bookmarked_items = []
    if is_owner:
        liked_items = list(liked_items_qs[:SECTION_LIMIT])
        bookmarked_items = list(bookmarked_items_qs[:SECTION_LIMIT])
        apply_human_counts(liked_items)
        apply_human_counts(bookmarked_items)

    counts = {
        'all_count': user_items_qs.count(),
        'liked_count': liked_items_qs.count(),
        'bookmarked_count': bookmarked_items_qs.count(),
    }
    # ----------------------------
    # ПЕРСОНАЛЬНЫЕ ДАННЫЕ (CLEAN)
    # ----------------------------
    fields = {
        "Username": {
            "value": user_obj.username,
            "type": "text",
        },
        "First name": {
            "value": user_obj.first_name,
            "type": "text",
        },
        "Last name": {
            "value": user_obj.last_name,
            "type": "text",
        },
    }

    # Email
    if user_obj.email:
        fields["Email"] = {
            "value": user_obj.email,
            "type": "email",
            "is_owner": request.user == user_obj,
        }

    # убрать пустые значения
    filtered_fields = {
        label: data
        for label, data in fields.items()
        if data.get("value") and str(data["value"]).strip()
    }

    context = {
        'fields': filtered_fields,
        'user_obj': user_obj,
        'created_items': created_items,
        'liked_items': liked_items,
        'bookmarked_items': bookmarked_items,
        'is_owner': is_owner,
        **counts,
    }
    return render(request, 'accounts/profile.html', context)


def profile_section_view(request, username, section):
    user_obj = get_object_or_404(User, username=username)

    user_items_qs = (
        Item.objects
        .with_counters()
        .filter(author=user_obj)
        .order_by('-published_date')
    )

    liked_items_qs = (
        Item.objects
        .with_counters()
        .filter(likes__user=user_obj)
        .annotate(
            liked_at=Max(
                'likes__created_at',
                filter=Q(likes__user=user_obj)
            )
        )
        .order_by('-liked_at')
        .distinct()
    )

    if Bookmark is not None:
        bookmarked_items_qs = (
            Item.objects
            .with_counters()
            .filter(bookmarked_by__user=user_obj)
            .annotate(
                bookmarked_at=Max(
                    'bookmarked_by__created_at',
                    filter=Q(bookmarked_by__user=user_obj)
                )
            )
            .order_by('-bookmarked_at')
            .distinct()
        )
    else:
        try:
            bookmarked_items_qs = (
                Item.objects
                .filter(bookmarked_by=user_obj)
                .order_by('-published_date')
                .select_related('author')
                .prefetch_related('images')
            )
        except Exception:
            bookmarked_items_qs = Item.objects.none()

    section = (section or '').lower()
    if section not in {'created', 'liked', 'bookmarked'}:
        raise Http404

    is_owner = request.user.is_authenticated and request.user == user_obj
    if section in {'liked', 'bookmarked'} and not is_owner:
        raise PermissionDenied

    if section == 'liked':
        qs_to_page = liked_items_qs
        section_title = 'Liked'
        section_count = liked_items_qs.count()
    elif section == 'bookmarked':
        qs_to_page = bookmarked_items_qs
        section_title = 'Bookmarked'
        section_count = bookmarked_items_qs.count()
    else:
        qs_to_page = user_items_qs
        section_title = 'Created'
        section_count = user_items_qs.count()

    paginator = Paginator(qs_to_page, 10)
    page_number = request.GET.get('page', 1)
    page_obj = paginator.get_page(page_number)
    page_range = paginator.get_elided_page_range(
        number=page_obj.number,
        on_each_side=1,
        on_ends=1
    )

    for item in page_obj:
        item.views_count_human = count_convert(item.views_count)
        item.likes_count_human = count_convert(item.likes_count)
        item.bookmarks_count_human = count_convert(item.bookmarks_count)
        item.comments_count_human = count_convert(item.comments_count)

    counts = {
        'all_count': user_items_qs.count(),
        'liked_count': liked_items_qs.count(),
        'bookmarked_count': bookmarked_items_qs.count(),
    }

    fields = {
        "Username": {
            "value": user_obj.username,
            "type": "text",
        },
        "First name": {
            "value": user_obj.first_name,
            "type": "text",
        },
        "Last name": {
            "value": user_obj.last_name,
            "type": "text",
        },
    }

    if user_obj.email:
        fields["Email"] = {
            "value": user_obj.email,
            "type": "email",
            "is_owner": request.user == user_obj,
        }

    filtered_fields = {
        label: data
        for label, data in fields.items()
        if data.get("value") and str(data["value"]).strip()
    }

    breadcrumbs = build_breadcrumbs(
        breadcrumb(user_obj.username, reverse("login_app:profile", kwargs={"username": user_obj.username})),
        breadcrumb(section_title, None),
    )

    context = {
        'fields': filtered_fields,
        'user_obj': user_obj,
        'items': page_obj,
        'page_obj': page_obj,
        'page_range': page_range,
        'section': section,
        'section_title': section_title,
        'section_count': section_count,
        'is_owner': is_owner,
        'breadcrumbs': breadcrumbs,
        **counts,
    }
    return render(request, 'accounts/profile_section.html', context)


# Выход из профиля
def logout_view(request):
    logout(request)
    #messages.info(request, 'You were logged out.')
    return redirect('login_app:login')


@login_required
def notifications_view(request, username):
    if request.user.username != username and not request.user.is_staff:
        raise PermissionDenied

    notifications = (
        Notification.objects
        .filter(recipient=request.user)
        .select_related("item", "reply_comment", "parent_comment", "reply_comment__author")
        .order_by("-created_at")
    )
    for notif in notifications:
        notif.preview_text = strip_mention_tokens(getattr(notif.reply_comment, "text", ""))
    unread_count = notifications.filter(is_read=False).count()
    return render(request, "smart_blog/notifications.html", {
        "notifications": notifications,
        "unread_count": unread_count,
    })



@login_required
def profile_edit(request, username):
    user_obj = get_object_or_404(User, username=username)

    if request.user != user_obj:
        raise PermissionDenied

    if request.method == "POST":
        if 'profile_submit' in request.POST:
            form = UserEditForm(request.POST, request.FILES, instance=user_obj)
            password_form = PasswordChangeSimpleForm()

            if form.is_valid():
                form.save()  # ← ВСЁ. АВАТАР ТУТ.
                new_username = form.cleaned_data.get('username') or user_obj.username
                return redirect('login_app:profile', username=new_username)

        elif 'password_submit' in request.POST:
            form = UserEditForm(instance=user_obj)
            password_form = PasswordChangeSimpleForm(request.POST)
            if password_form.is_valid():
                new_password = password_form.cleaned_data['new_password1']
                user_obj.set_password(new_password)
                user_obj.save()
                update_session_auth_hash(request, user_obj)
                return redirect('login_app:profile', username=user_obj.username)

    else:
        form = UserEditForm(instance=user_obj)
        password_form = PasswordChangeSimpleForm()

    return render(request, 'accounts/profile_edit.html', {
        'form': form,
        'password_form': password_form,
        'user_obj': user_obj,
    })


@login_required
@require_POST
def remove_avatar(request):
    profile = request.user.profile

    if profile.avatar_file:
        profile.avatar_file.delete(save=False)
        profile.avatar_file = None

    profile.avatar_url = None
    profile.save()

    return JsonResponse({
        'success': True,
        'default_avatar': static('img/no_avatar.svg')
    })
