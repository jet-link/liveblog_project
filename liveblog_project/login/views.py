from django.shortcuts import render
from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from login.forms import CustomUserCreationForm, LoginForm, UserEditForm, PasswordChangeSimpleForm
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from urllib.parse import urlparse, parse_qs

from django.urls import reverse, resolve, Resolver404
from smart_blog.models import Comment, Item, Like
from login.models import Profile
from django.views.decorators.http import require_POST
from django.templatetags.static import static
from django.http import JsonResponse, Http404
from django.utils.http import url_has_allowed_host_and_scheme
from django.db.models import Count, Q, Max, Exists, OuterRef
from smart_blog.utils import count_convert, build_breadcrumbs, breadcrumb, strip_mention_tokens
from smart_blog.models import Notification
from django.core.exceptions import PermissionDenied
from login.middleware import is_user_online, clear_user_online
import random
from collections import OrderedDict

FUNNY_NAMES = [
    "Bobby McWobble",
    "Lars von Pickle",
    "Giuseppe Spaghettini",
    "Hiroshi Banana",
    "Pierre Baguettino",
    "Olga Vodkanova",
    "Sven Snowbeard",
    "Carlos Jalapeno",
    "Nigel Wiggletop",
    "Fatima Moonshine",
    "Dmitri Thunderpants",
    "Ahmed Falafelson",
    "Hans Pretzelberg",
    "Juan Burritowski",
    "Luca Mozzarelli",
    "Ivan Gigglevich",
    "Akira Sushiroll",
    "Pedro Mangopez",
    "Tariq Sandstorm",
    "Bruno Pastaferro",
    "Yuki Bubbletea",
    "Boris Pickleman",
    "Ali Kebabzade",
    "Marco Pizzaio",
    "Satoshi Pixelman",
    "Enzo Raviolini",
    "Abdul Giggleton",
    "Diego Nachozilla",
    "Gustav Schnitzelmann",
    "Vladimir Chucklev",
]


def _random_vanished_name():
    """Return a random funny name for vanished user display."""
    return random.choice(FUNNY_NAMES)


def _safe_referer_url(request):
    """Возвращает валидный referer или None."""
    referer = request.META.get("HTTP_REFERER")
    if referer and url_has_allowed_host_and_scheme(
        url=referer,
        allowed_hosts={request.get_host()},
        require_https=request.is_secure()
    ):
        return referer
    return None


def _referer_breadcrumb_info(request, referer_url):
    """
    Возвращает (title, url) для хлебной крошки на основе referer.
    title — заголовок страницы, url — валидный URL для ссылки.
    """
    fallback_url = reverse("smart_blog:items_list")
    if not referer_url:
        return "BraiNews", fallback_url

    parsed = urlparse(referer_url)
    path = parsed.path or "/"
    query = parse_qs(parsed.query)

    try:
        match = resolve(path)
        url_name = match.url_name or ""
        kwargs = match.kwargs or {}

        if url_name == "item_detail" and kwargs.get("slug"):
            item = Item.objects.filter(slug=kwargs["slug"]).values("title").first()
            if item:
                return item["title"], referer_url
        elif url_name == "tag_list" and kwargs.get("slug"):
            from smart_blog.models import Tag

            tag = Tag.objects.filter(slug=kwargs["slug"]).values("tag_name").first()
            if tag:
                return tag["tag_name"], referer_url
        elif url_name == "items_popular":
            return "For you", referer_url
        elif url_name == "for_you_list":
            return "For you", referer_url
        elif url_name == "topics_list":
            return "Topics", referer_url
        elif url_name == "topic_detail" and kwargs.get("slug"):
            from smart_blog.models import Category

            cat = Category.objects.filter(slug=kwargs["slug"]).values("name").first()
            if cat:
                return cat["name"], referer_url
            return "Topics", referer_url
        elif url_name == "trending_list":
            return "In trend", referer_url
        elif url_name == "items_list":
            return "BraiNews", referer_url
        elif url_name == "global_search":
            q = (query.get("q") or [""])[0]
            return (f"Found - {q}" if q else "Search"), referer_url
        elif url_name == "profile" and kwargs.get("username"):
            return kwargs["username"], referer_url
        elif url_name == "profile-section" and kwargs.get("username"):
            sections = {"created": "Created", "liked": "Liked", "bookmarked": "Bookmarked"}
            section_title = sections.get(kwargs.get("section", ""), kwargs.get("section", "Section"))
            return f"{kwargs['username']} - {section_title}", referer_url
        elif url_name == "home":
            return "brainstorm.org", referer_url
        elif url_name == "comment_thread" and kwargs.get("pk"):
            comment = (
                Comment.objects.filter(is_draft=False)
                .select_related("item")
                .filter(pk=kwargs["pk"])
                .values("item__title")
                .first()
            )
            if comment and comment.get("item__title"):
                return f"{comment['item__title']} - Replies", referer_url
            return "Replies", referer_url
    except Resolver404:
        pass

    return "BraiNews", referer_url


def annotate_user_liked(qs, user):
    if user.is_authenticated:
        likes_subq = Like.objects.filter(item=OuterRef('pk'), user=user)
        return qs.annotate(user_liked=Exists(likes_subq))
    return qs


def build_profile_field(value, field_type, is_owner=False):
    is_empty = not value or not str(value).strip()
    return {
        "value": value if not is_empty else "not specified",
        "type": field_type,
        "is_owner": is_owner,
        "is_empty": is_empty,
    }


def build_trust_rating_field(score):
    s = float(score)
    if s >= 8:
        zone = "Trusted"
        zone_class = "badge_success"
    elif s >= 5:
        zone = "Normal"
        zone_class = "badge_muted"
    elif s >= 3:
        zone = "Risk"
        zone_class = "badge_warning"
    else:
        zone = "Dangerous"
        zone_class = "rating_badge_danger"
    return {
        "type": "trust_rating",
        "score": s,
        "zone": zone,
        "zone_class": zone_class,
        "is_empty": False,
    }


def _vanished_items_qs():
    """Публикации удалённого пользователя (author=None)."""
    return (
        Item.objects
        .filter(is_published=True, author__isnull=True)
        .with_counters()
        .order_by('-published_date')
        .prefetch_related("images")
    )


def vanished_generic_view(request):
    """Страница для author=None: аватар, Deleted user, карточки публикаций."""
    qs = _vanished_items_qs()
    qs = annotate_user_liked(qs, request.user)
    SECTION_LIMIT = 10
    created_items = list(qs[:SECTION_LIMIT])
    all_count = qs.count()

    def apply_human_counts(items):
        for item in items:
            item.views_count_human = count_convert(item.views_count)
            item.likes_count_human = count_convert(item.likes_count)
            item.bookmarks_count_human = count_convert(item.bookmarks_count)
            item.comments_count_human = count_convert(item.comments_count)

    apply_human_counts(created_items)

    vanished_name = _random_vanished_name()
    referer = _safe_referer_url(request)
    crumb_title, crumb_url = _referer_breadcrumb_info(request, referer)
    breadcrumbs = build_breadcrumbs(
        breadcrumb(crumb_title, crumb_url),
        breadcrumb(vanished_name, None),
    )
    context = {
        "created_items": created_items,
        "all_count": all_count,
        "view_all_url": reverse("login_app:vanished-created"),
        "listing_source": "vanished",
        "breadcrumbs": breadcrumbs,
        "vanished_display_name": vanished_name,
        "vanished_status": "deleted",
    }
    return render(request, "includes/vanished.html", context)


def vanished_created_view(request):
    """Полный список публикаций с author=None."""
    qs = _vanished_items_qs()
    qs = annotate_user_liked(qs, request.user)
    paginator = Paginator(qs, 50)
    page_obj = paginator.get_page(request.GET.get('page', 1))
    page_range = paginator.get_elided_page_range(page_obj.number, on_each_side=1, on_ends=1)
    for item in page_obj:
        item.views_count_human = count_convert(item.views_count)
        item.likes_count_human = count_convert(item.likes_count)
        item.bookmarks_count_human = count_convert(item.bookmarks_count)
        item.comments_count_human = count_convert(item.comments_count)

    referer = _safe_referer_url(request)
    crumb_title, crumb_url = _referer_breadcrumb_info(request, referer)
    breadcrumbs = build_breadcrumbs(
        breadcrumb(crumb_title, crumb_url),
        breadcrumb("Deleted user", reverse("login_app:vanished")),
        breadcrumb("Created", None),
    )
    return render(request, "includes/vanished_created.html", {
        "items": page_obj,
        "page_obj": page_obj,
        "page_range": page_range,
        "breadcrumbs": breadcrumbs,
    })


def user_not_found_view(request, user_obj, vanished_status="banned"):
    """Inactive user public page: banned or deleted-in-queue (vanished_status)."""
    user_items_qs = (
        Item.objects
        .filter(is_published=True, author=user_obj)
        .with_counters()
        .order_by('-published_date')
        .prefetch_related("images")
    )
    user_items_qs = annotate_user_liked(user_items_qs, request.user)

    SECTION_LIMIT = 10
    created_items = list(user_items_qs[:SECTION_LIMIT])
    all_count = user_items_qs.count()

    def apply_human_counts(items):
        for item in items:
            item.views_count_human = count_convert(item.views_count)
            item.likes_count_human = count_convert(item.likes_count)
            item.bookmarks_count_human = count_convert(item.bookmarks_count)
            item.comments_count_human = count_convert(item.comments_count)

    apply_human_counts(created_items)

    view_all_url = reverse("login_app:profile-section", kwargs={
        "username": user_obj.username,
        "section": "created",
    })

    vanished_name = _random_vanished_name()
    referer = _safe_referer_url(request)
    crumb_title, crumb_url = _referer_breadcrumb_info(request, referer)
    breadcrumbs = build_breadcrumbs(
        breadcrumb(crumb_title, crumb_url),
        breadcrumb(vanished_name, None),
    )

    context = {
        "created_items": created_items,
        "all_count": all_count,
        "view_all_url": view_all_url,
        "listing_source": "profile",
        "listing_user": user_obj.username,
        "listing_section": "created",
        "breadcrumbs": breadcrumbs,
        "vanished_display_name": vanished_name,
        "vanished_status": vanished_status,
    }
    return render(request, "includes/vanished.html", context)


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

            # Exact username match only (case-sensitive; "daddy" ≠ "Daddy")
            lookup = User.objects.select_related('profile').filter(username=username).first()
            user = authenticate(request, username=username, password=password)
            if user is not None:
                if is_user_online(user):
                    form.add_error(None, "User already online")
                else:
                    login(request, user)
                    if remember:
                        request.session.set_expiry(1209600)  # 2 weeks
                    else:
                        request.session.set_expiry(0)  # until browser close
                    messages.success(request, f'Welcome back, {user.username}!')
                    next_url = request.GET.get('next', '')
                    if next_url and url_has_allowed_host_and_scheme(next_url, allowed_hosts={request.get_host()}):
                        return redirect(next_url)
                    return redirect('login_app:profile', username=user.username)
            else:
                if not lookup:
                    form.add_error(None, "User not found")
                elif not lookup.check_password(password):
                    form.add_error(None, "Incorrect password")
                elif not lookup.is_active:
                    try:
                        if lookup.profile.trust_banned:
                            from admin_panel.services.trust_score_service import format_trust_ban_login_message
                            form.add_error(None, format_trust_ban_login_message(lookup))
                        else:
                            form.add_error(None, "Your account has been disabled.")
                    except Exception:
                        form.add_error(None, "Your account has been disabled.")
                else:
                    form.add_error(None, "Incorrect password")
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
            # messages.error(request, 'Please fix the errors below.')
            pass
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
    user_obj = User._base_manager.select_related("profile", "deleted_queue_entry").filter(username=username).first()
    if not user_obj:
        raise Http404
    if not user_obj.is_active:
        status = "deleted" if getattr(user_obj, "deleted_queue_entry", None) else "banned"
        return user_not_found_view(request, user_obj, vanished_status=status)

    is_owner = request.user.is_authenticated and request.user == user_obj

    # --- базовые queryset'ы ---
    user_items_qs = (
        Item.objects
        .filter(is_published=True, author=user_obj)
        .with_counters()
        .order_by('-published_date')
    )
    user_items_qs = annotate_user_liked(user_items_qs, request.user)


    def apply_human_counts(items):
        for item in items:
            item.views_count_human = count_convert(item.views_count)
            item.likes_count_human = count_convert(item.likes_count)
            item.bookmarks_count_human = count_convert(item.bookmarks_count)
            item.comments_count_human = count_convert(item.comments_count)

    SECTION_LIMIT = 10
    created_items = list(user_items_qs[:SECTION_LIMIT])
    apply_human_counts(created_items)

    counts = {
        'all_count': user_items_qs.count(),
    }
    # ----------------------------
    # ПЕРСОНАЛЬНЫЕ ДАННЫЕ (CLEAN)
    # ----------------------------
    profile = getattr(user_obj, 'profile', None)
    if profile is None:
        profile, _ = Profile.objects.get_or_create(user=user_obj)

    trust_score = 10.0
    if user_obj:
        try:
            trust_score = float(getattr(user_obj.profile, 'trust_score', 10.0))
        except Exception:
            pass

    def _non_empty(value):
        return bool(value and str(value).strip())

    personal_fields = {}
    if is_owner:
        personal_fields["Username"] = build_profile_field(user_obj.username, "text")
    elif profile.public_username and _non_empty(user_obj.username):
        personal_fields["Username"] = build_profile_field(user_obj.username, "text")

    if is_owner:
        personal_fields["First name"] = build_profile_field(user_obj.first_name, "text")
    elif profile.public_first_name and _non_empty(user_obj.first_name):
        personal_fields["First name"] = build_profile_field(user_obj.first_name, "text")

    if is_owner:
        personal_fields["Last name"] = build_profile_field(user_obj.last_name, "text")
    elif profile.public_last_name and _non_empty(user_obj.last_name):
        personal_fields["Last name"] = build_profile_field(user_obj.last_name, "text")

    if is_owner:
        personal_fields["Email"] = build_profile_field(
            user_obj.email,
            "email",
            is_owner=request.user == user_obj,
        )
    elif profile.public_email and _non_empty(user_obj.email):
        personal_fields["Email"] = build_profile_field(
            user_obj.email,
            "email",
            is_owner=False,
        )

    fields = OrderedDict()
    fields["Trust rating"] = build_trust_rating_field(trust_score)
    fields.update(personal_fields)

    show_no_public_details = (not is_owner) and len(personal_fields) == 0

    # Mobile header thumb only when user has a real avatar (not default placeholder).
    has_uploaded_avatar = bool(profile.avatar_file or profile.avatar_url)

    is_online = is_user_online(user_obj) if user_obj else False

    context = {
        'fields': fields,
        'show_no_public_details': show_no_public_details,
        'show_profile_avatar_thumbs': has_uploaded_avatar,
        'user_obj': user_obj,
        'created_items': created_items,
        'is_owner': is_owner,
        'is_online': is_online,
        'trust_score': trust_score,
        **counts,
    }
    return render(request, 'accounts/profile.html', context)


def profile_online_status(request, username):
    """API: возвращает online статус пользователя для polling."""
    user_obj = User._base_manager.filter(username=username).first()
    if not user_obj:
        return JsonResponse({"online": False})
    return JsonResponse({"online": is_user_online(user_obj)})


def profile_section_view(request, username, section):
    user_obj = User._base_manager.select_related("deleted_queue_entry").filter(username=username).first()
    if not user_obj:
        raise Http404
    if not user_obj.is_active:
        pass
    user_items_qs = (
        Item.objects
        .filter(is_published=True, author=user_obj)
        .with_counters()
        .order_by('-published_date')
    )
    user_items_qs = annotate_user_liked(user_items_qs, request.user)

    section = (section or '').lower()
    if section != 'created':
        raise Http404

    qs_to_page = user_items_qs
    section_title = 'Created'
    section_count = user_items_qs.count()

    paginator = Paginator(qs_to_page, 50)
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

    if not user_obj.is_active:
        if getattr(user_obj, "deleted_queue_entry", None):
            crumb_user_label = "Deleted user"
        else:
            crumb_user_label = "Banned user"
    else:
        crumb_user_label = user_obj.username
    breadcrumbs = build_breadcrumbs(
        breadcrumb(crumb_user_label, reverse("login_app:profile", kwargs={"username": user_obj.username})),
        breadcrumb(section_title, None),
    )

    link_url = reverse("login_app:profile-section", kwargs={"username": user_obj.username, "section": section})
    context = {
        'user_obj': user_obj,
        'items': page_obj,
        'page_obj': page_obj,
        'page_range': page_range,
        'section': section,
        'section_title': section_title,
        'section_count': section_count,
        'breadcrumbs': breadcrumbs,
        'link_url': link_url,
        'listing_user': user_obj.username,
    }
    return render(request, 'accounts/profile_section.html', context)


@login_required
def api_trust_status(request):
    """API: возвращает trust status для polling (shadow_banned, can_post)."""
    profile = getattr(request.user, 'profile', None)
    return JsonResponse({
        "shadow_banned": getattr(profile, 'shadow_banned', False),
        "can_post": getattr(profile, 'can_post', True),
    })


# Выход из профиля
def logout_view(request):
    if request.user.is_authenticated:
        clear_user_online(request.user)
    logout(request)
    #messages.info(request, 'You were logged out.')
    return redirect('login_app:login')


@login_required
def notifications_view(request, username):
    if request.user.username != username and not request.user.is_staff:
        raise PermissionDenied

    invalid_q = (
        Q(item__isnull=True) |
        Q(notif_type=Notification.TYPE_REPLY, reply_comment__isnull=True) |
        Q(notif_type=Notification.TYPE_REPLY, parent_comment__isnull=True) |
        Q(notif_type=Notification.TYPE_COMMENT_LIKE, parent_comment__isnull=True, reply_comment__isnull=True)
    )
    Notification.objects.filter(recipient=request.user).filter(invalid_q).delete()

    notifications = (
        Notification.objects
        .filter(recipient=request.user, cleared_from_inbox=False)
        .exclude(item__isnull=True)
        .exclude(
            Q(notif_type=Notification.TYPE_REPLY, reply_comment__isnull=True) |
            Q(notif_type=Notification.TYPE_REPLY, parent_comment__isnull=True) |
            Q(notif_type=Notification.TYPE_COMMENT_LIKE, parent_comment__isnull=True, reply_comment__isnull=True)
        )
        .select_related("item", "reply_comment", "parent_comment", "reply_comment__author")
        .order_by("-created_at")
    )
    for notif in notifications:
        notif.actor_name = getattr(notif.actor, "username", "")
        if notif.notif_type == Notification.TYPE_REPLY:
            notif.header_text = "replied to your comment in the post"
            notif.body_text = strip_mention_tokens(getattr(notif.reply_comment, "text", ""))
        elif notif.notif_type == Notification.TYPE_COMMENT_LIKE:
            notif.header_text = "liked your comment in the post"
            liked_comment = notif.parent_comment or notif.reply_comment
            notif.body_text = strip_mention_tokens(getattr(liked_comment, "text", ""))
        else:
            notif.header_text = "liked your post."
            notif.body_text = ""
    unread_count = notifications.filter(is_read=False).count()
    return render(request, "accounts/notifications.html", {
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
                form.save()
                new_username = form.cleaned_data.get('username') or user_obj.username
                messages.success(request, 'Profile was successfully edited')
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


@login_required
@require_POST
def mark_notification_read(request):
    notif_id = request.POST.get("notification_id")
    try:
        notif_id = int(notif_id)
    except (TypeError, ValueError):
        return JsonResponse({"success": False, "error": "Invalid id."}, status=400)

    notif = get_object_or_404(Notification, pk=notif_id, recipient=request.user)
    notif.is_read = True
    notif.save(update_fields=["is_read"])
    from smart_blog.context_processors import invalidate_notifications_cache
    invalidate_notifications_cache(request.user.pk)
    return JsonResponse({"success": True})


@login_required
@require_POST
def mark_all_notifications_read(request):
    Notification.objects.filter(
        recipient=request.user, is_read=False, cleared_from_inbox=False
    ).update(is_read=True)
    from smart_blog.context_processors import invalidate_notifications_cache
    invalidate_notifications_cache(request.user.pk)
    return JsonResponse({"success": True})


@login_required
@require_POST
def delete_notifications(request):
    mode = request.POST.get("mode")
    qs = Notification.objects.filter(recipient=request.user, cleared_from_inbox=False)
    if mode == "last5":
        ids = list(qs.order_by("-created_at").values_list("id", flat=True)[:5])
        Notification.objects.filter(id__in=ids).update(cleared_from_inbox=True)
    else:
        qs.update(cleared_from_inbox=True)
    from smart_blog.context_processors import invalidate_notifications_cache
    invalidate_notifications_cache(request.user.pk)
    return JsonResponse({"success": True})