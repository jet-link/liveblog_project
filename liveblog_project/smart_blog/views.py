from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from .models import Item, ItemImage, Tag, Category, Like, Comment, Bookmark, ItemView, CommentLike, ContentReport, Notification, SearchHistory, PostRepost
from .forms import CommentForm, ItemCreateForm
from django.utils import timezone
from django.core.paginator import Paginator
from django.http import JsonResponse
import json
from django.views.decorators.http import require_POST
from django.template.loader import render_to_string
from django.urls import reverse
from django.http import HttpResponseForbidden, HttpResponse, Http404
from django.utils.http import url_has_allowed_host_and_scheme
from datetime import timedelta
from django.db.models import Exists, OuterRef, Count, Q, Subquery
from django.db.models import Prefetch
from .utils import count_convert, build_breadcrumbs, breadcrumb
from .selectors import has_user_reported_item, has_user_reported_comment
from .services.report_limits import can_user_report
from .services.reports import ReportService
from .search_utils import build_search_filter, apply_popular_filter, refresh_item_search_vector
from .image_utils import process_image_legacy_safe, MAX_FILE_SIZE_BYTES, ALLOWED_MIME_TYPES as IMAGE_ALLOWED_MIME
import logging
import os
import re
from django.conf import settings
from django.core.files.storage import default_storage
from urllib.parse import urlencode


# Listing page sizes (server-side bounds for DB + HTML payload)
SEARCH_RESULTS_PER_PAGE = 40
FILTER_AJAX_PAGE_SIZE = 20
# Must match STEP in smart_blog/static/smart_blog/js/comment_operate.js (root comment pagination)
COMMENT_ROOT_PAGINATION_STEP = 50


def _comments_min_visible_for_focus(item, focus_comment_id):
    """How many root comments must be visible so focus_comment is shown (JS paginates roots)."""
    if not focus_comment_id:
        return None
    try:
        fid = int(focus_comment_id)
    except (TypeError, ValueError):
        return None
    try:
        focus = Comment.objects.get(pk=fid, item=item, is_draft=False)
    except Comment.DoesNotExist:
        return None
    root = focus
    while root.parent_id:
        root = root.parent
    root_ids = list(
        Comment.objects.filter(item=item, parent__isnull=True, is_draft=False)
        .order_by('-created')
        .values_list('pk', flat=True)
    )
    try:
        idx = root_ids.index(root.pk)
    except ValueError:
        return None
    return max(COMMENT_ROOT_PAGINATION_STEP, idx + 1)


def annotate_user_liked(qs, user):
    if user.is_authenticated:
        likes_subq = Like.objects.filter(item=OuterRef('pk'), user=user)
        return qs.annotate(user_liked=Exists(likes_subq))
    return qs


def annotate_user_bookmarked(qs, user):
    if user.is_authenticated:
        bookmarks_subq = Bookmark.objects.filter(item=OuterRef('pk'), user=user)
        return qs.annotate(user_bookmarked=Exists(bookmarks_subq))
    return qs


def items_list(request):
    qs = (
        Item.objects
        .filter(is_published=True)
        .with_counters()
        .select_related("category", "author", "author__profile")
        .order_by('-published_date')
        .prefetch_related("images", "tags")
    )
    qs = annotate_user_liked(qs, request.user)
    qs = annotate_user_bookmarked(qs, request.user)
    qs = qs.order_by('-published_date', '-pk')

    paginator = Paginator(qs, 40)
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)

    page_range = paginator.get_elided_page_range(
        number=page_obj.number,
        on_each_side=1,
        on_ends=1
    )

    breadcrumbs = build_breadcrumbs(
        breadcrumb("BraiNews", None),
    )

    return render(request, "smart_blog/items_list.html", {
        "page_obj": page_obj,
        "page_range": page_range,
        "items": page_obj.object_list,
        "breadcrumbs": breadcrumbs,
    })


def items_popular_list(request):
    """Public page: top 20 popular posts from the last 15 days (no pagination)."""
    since = timezone.now() - timedelta(days=15)
    qs = (
        Item.objects
        .filter(is_published=True, published_date__gte=since)
        .with_counters()
        .select_related("category", "author", "author__profile")
        .prefetch_related("images", "tags")
    )
    qs = apply_popular_filter(qs)
    qs = annotate_user_liked(qs, request.user)
    qs = annotate_user_bookmarked(qs, request.user)
    items = list(qs[:20])

    breadcrumbs = build_breadcrumbs(
        breadcrumb("Popular", None),
    )

    return render(request, "smart_blog/popular_items_list.html", {
        "items": items,
        "breadcrumbs": breadcrumbs,
    })


def items_filtered(request):
    """Returns filtered items HTML for BraiNews filter block (Liked/Bookmarked)."""
    if not request.user.is_authenticated:
        return HttpResponseForbidden()
    filter_type = request.GET.get('filter', '').strip().lower()
    if filter_type not in ('liked', 'bookmarked'):
        return HttpResponse('', content_type='text/html')
    qs = (
        Item.objects
        .with_counters()
        .filter(is_published=True)
        .order_by('-published_date')
    )
    tag_slug = request.GET.get('tag_slug', '').strip()
    search_q = request.GET.get('q', '').strip()
    if tag_slug:
        tag_obj = Tag.objects.filter(slug=tag_slug).first()
        if tag_obj:
            qs = qs.filter(tags=tag_obj)
    elif search_q:
        by_title = request.GET.get('by_title') in ('1', 'true', 'True')
        by_text = request.GET.get('by_text') in ('1', 'true', 'True')
        by_tags = request.GET.get('by_tags') in ('1', 'true', 'True')
        if not (by_title or by_text or by_tags):
            by_title = by_text = by_tags = True
        qs = build_search_filter(qs, search_q, by_title, by_text, by_tags)
    qs = annotate_user_liked(qs, request.user)
    qs = annotate_user_bookmarked(qs, request.user)
    if filter_type == 'liked':
        like_exists = Like.objects.filter(item=OuterRef('pk'), user=request.user)
        like_date_subq = Like.objects.filter(item=OuterRef('pk'), user=request.user).values('created_at')[:1]
        qs = qs.filter(Exists(like_exists)).annotate(
            user_like_date=Subquery(like_date_subq)
        ).order_by('-user_like_date', '-pk')
        empty_msg = 'Nothing was liked'
    else:  # bookmarked
        bookmark_exists = Bookmark.objects.filter(item=OuterRef('pk'), user=request.user)
        bookmark_date_subq = Bookmark.objects.filter(item=OuterRef('pk'), user=request.user).values('created_at')[:1]
        qs = qs.filter(Exists(bookmark_exists)).annotate(
            user_bookmark_date=Subquery(bookmark_date_subq)
        ).order_by('-user_bookmark_date', '-pk')
        empty_msg = 'Nothing was bookmarked'
    qs = qs.select_related("category", "author", "author__profile").prefetch_related("images", "tags")
    paginator = Paginator(qs, FILTER_AJAX_PAGE_SIZE)
    page_obj = paginator.get_page(request.GET.get("page"))
    items = list(page_obj.object_list)

    append_fragment = request.GET.get("append") == "1"
    if search_q:
        listing_source = 'search'
        listing_query = search_q
        search_params = {'q': search_q}
        if request.GET.get('by_title'): search_params['by_title'] = request.GET.get('by_title')
        if request.GET.get('by_text'): search_params['by_text'] = request.GET.get('by_text')
        if request.GET.get('by_tags'): search_params['by_tags'] = request.GET.get('by_tags')
        listing_source_url = request.build_absolute_uri('/search/?' + urlencode(search_params))
    elif tag_slug:
        listing_source = 'tag'
        tag_obj = Tag.objects.filter(slug=tag_slug).first()
        listing_tag = tag_obj.tag_name if tag_obj else ''
        listing_tag_slug = tag_slug
        listing_source_url = request.build_absolute_uri(reverse('smart_blog:tag_list', kwargs={'slug': tag_slug}))
    else:
        listing_source = 'items_list'
        listing_query = listing_tag = listing_tag_slug = ''
        listing_source_url = request.build_absolute_uri(reverse('smart_blog:items_list'))
    ctx = {
        'items': items,
        'user': request.user,
        'listing_source': listing_source,
        'listing_source_url': listing_source_url,
        'empty_msg': empty_msg,
        'filter_type': filter_type,
        'page_obj': page_obj,
        'paginator': paginator,
    }
    if listing_source == 'search':
        ctx['listing_query'] = listing_query
    elif listing_source == 'tag':
        ctx['listing_tag'] = listing_tag
        ctx['listing_tag_slug'] = listing_tag_slug
    tmpl = (
        'includes/filtered_cards_append.html'
        if append_fragment
        else 'includes/filtered_cards.html'
    )
    html = render_to_string(tmpl, ctx)
    return HttpResponse(html, content_type='text/html')


def tag_list(request, slug):
    tag = get_object_or_404(Tag, slug=slug)

    qs = (
        tag.items
        .filter(is_published=True)
        .with_counters()
        .select_related("category", "author", "author__profile")
        .order_by('-published_date')
        .prefetch_related("images", "tags")
    )
    qs = annotate_user_liked(qs, request.user)
    qs = annotate_user_bookmarked(qs, request.user)
    qs = qs.order_by('-published_date', '-pk')

    paginator = Paginator(qs, 40)
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)
    page_range = paginator.get_elided_page_range(
        number=page_obj.number,
        on_each_side=1,
        on_ends=1
    )

    breadcrumbs = build_breadcrumbs(
        breadcrumb(tag.tag_name, None),
    )

    return render(request, "smart_blog/tag_items_list.html", {
        "tag": tag,
        "page_obj": page_obj,
        "page_range": page_range,
        "items": page_obj.object_list,
        "breadcrumbs": breadcrumbs,
    })


def category_list(request, slug):
    category = get_object_or_404(Category, slug=slug)

    qs = (
        Item.objects
        .filter(is_published=True, category=category)
        .with_counters()
        .select_related("category", "author", "author__profile")
        .order_by('-published_date')
        .prefetch_related("images", "tags")
    )
    qs = annotate_user_liked(qs, request.user)
    qs = annotate_user_bookmarked(qs, request.user)
    qs = qs.order_by('-published_date', '-pk')

    paginator = Paginator(qs, 40)
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)
    page_range = paginator.get_elided_page_range(
        number=page_obj.number,
        on_each_side=1,
        on_ends=1
    )

    breadcrumbs = build_breadcrumbs(
        breadcrumb(category.name, None),
    )

    return render(request, "smart_blog/category_items_list.html", {
        "category": category,
        "page_obj": page_obj,
        "page_range": page_range,
        "items": page_obj.object_list,
        "breadcrumbs": breadcrumbs,
    })


def search_view(request):
    q = request.GET.get('q', '').strip()
    by_title = request.GET.get('by_title') in ('1', 'true', 'True')
    by_text  = request.GET.get('by_text')  in ('1', 'true', 'True')
    by_tags  = request.GET.get('by_tags')  in ('1', 'true', 'True')

    selected_fields = []
    if request.GET.get('by_title') in ('1','true','True'):
        selected_fields.append('title')
    if request.GET.get('by_text') in ('1','true','True'):
        selected_fields.append('text')
    if request.GET.get('by_tags') in ('1','true','True'):
        selected_fields.append('tag')

    # если ничего не выбрано — можно задать дефолт
    if not selected_fields:
        selected_fields = ['title', 'text', 'tag']

    page_obj = None
    page_range = None
    results_total = 0
    pagination_base_qs = ''
    items = []

    if not q:
        items_qs = Item.objects.none()
    else:
        if not (by_title or by_text or by_tags):
            by_title = by_text = by_tags = True

        items_qs = (
            Item.objects
            .with_counters()
            .select_related("category", "author", "author__profile")
            .filter(is_published=True)
            .prefetch_related("images", "tags")
        )
        items_qs = build_search_filter(items_qs, q, by_title, by_text, by_tags)
        items_qs = annotate_user_liked(items_qs, request.user)
        items_qs = annotate_user_bookmarked(items_qs, request.user)
        if not items_qs.ordered:
            items_qs = items_qs.order_by('-published_date', '-pk')

        paginator = Paginator(items_qs, SEARCH_RESULTS_PER_PAGE)
        page_obj = paginator.get_page(request.GET.get('page'))
        page_range = paginator.get_elided_page_range(
            number=page_obj.number,
            on_each_side=1,
            on_ends=1
        )
        items = page_obj.object_list
        results_total = paginator.count

        params = request.GET.copy()
        params.pop('page', None)
        pagination_base_qs = params.urlencode()

    if q:
        breadcrumbs = build_breadcrumbs(
            breadcrumb("Search", reverse("global_search")),
            breadcrumb(q, None),
        )
        # История поиска: авторизованные — БД
        if request.user.is_authenticated:
            results_count = results_total
            filters_dict = {
                'by_title': by_title, 'by_text': by_text, 'by_tags': by_tags
            }
            if request.GET.get('from_history'):
                # Клик из списка — поднимаем запись наверх
                existing = SearchHistory.objects.filter(
                    user=request.user,
                    search_query__iexact=q,
                    search_filters=filters_dict,
                ).first()
                if existing:
                    was_clicked = existing.was_clicked
                    existing.delete()
                    SearchHistory.objects.create(
                        user=request.user,
                        search_query=existing.search_query or q,
                        results_count=results_count,
                        search_filters=filters_dict,
                        was_clicked=was_clicked,
                    )
                    all_ids = list(SearchHistory.objects.filter(user=request.user).order_by('-created_at').values_list('pk', flat=True))
                    if len(all_ids) > 25:
                        SearchHistory.objects.filter(pk__in=all_ids[25:]).delete()
            else:
                # Новый поиск (Enter) — сохраняем или обновляем
                existing = SearchHistory.objects.filter(
                    user=request.user,
                    search_query__iexact=q,
                    search_filters=filters_dict,
                ).first()
                if existing:
                    was_clicked = existing.was_clicked
                    existing.delete()
                    SearchHistory.objects.create(
                        user=request.user,
                        search_query=q,
                        results_count=results_count,
                        search_filters=filters_dict,
                        was_clicked=was_clicked,
                    )
                else:
                    SearchHistory.objects.create(
                        user=request.user,
                        search_query=q,
                        results_count=results_count,
                        search_filters=filters_dict,
                        was_clicked=False,
                    )
                all_ids = list(SearchHistory.objects.filter(user=request.user).order_by('-created_at').values_list('pk', flat=True))
                if len(all_ids) > 25:
                    SearchHistory.objects.filter(pk__in=all_ids[25:]).delete()
    else:
        breadcrumbs = build_breadcrumbs(
            breadcrumb("Search", None),
        )

    return render(request, 'smart_blog/search_results.html', {
        'items': items,
        'query': q,
        'selected_fields': selected_fields,
        'breadcrumbs': breadcrumbs,
        'page_obj': page_obj,
        'page_range': page_range,
        'results_total': results_total,
        'pagination_base_qs': pagination_base_qs,
    })


def api_search_history_list(request):
    """Список последних поисковых запросов пользователя (только GET)."""
    if not request.user.is_authenticated:
        return JsonResponse({'items': []})
    items = list(
        SearchHistory.objects.filter(user=request.user).order_by('-created_at')[:25].values(
            'id', 'search_query', 'created_at', 'results_count', 'search_filters', 'was_clicked'
        )
    )
    for it in items:
        it['created_at'] = it['created_at'].isoformat()
    return JsonResponse({'items': items})


@require_POST
def api_search_history_clicked(request, pk):
    """Отметить запись истории как clicked (при клике из дропдауна)."""
    if not request.user.is_authenticated:
        return JsonResponse({'ok': False}, status=403)
    try:
        rec = SearchHistory.objects.get(pk=pk, user=request.user)
        rec.was_clicked = True
        rec.save(update_fields=['was_clicked'])
        return JsonResponse({'ok': True})
    except SearchHistory.DoesNotExist:
        return JsonResponse({'ok': False}, status=404)


@require_POST
def api_search_history_clear(request):
    """Очистить всю историю поиска пользователя."""
    if not request.user.is_authenticated:
        return JsonResponse({'ok': False}, status=403)
    SearchHistory.objects.filter(user=request.user).delete()
    return JsonResponse({'ok': True})


@require_POST
def api_search_history_delete(request, pk):
    """Удалить один запрос из истории."""
    if not request.user.is_authenticated:
        return JsonResponse({'ok': False}, status=403)
    try:
        rec = SearchHistory.objects.get(pk=pk, user=request.user)
        rec.delete()
        return JsonResponse({'ok': True})
    except SearchHistory.DoesNotExist:
        return JsonResponse({'ok': False}, status=404)


MAX_IMAGES = 10
ALLOWED_CONTENT_TYPES = IMAGE_ALLOWED_MIME
logger = logging.getLogger(__name__)

def find_existing_media_path(filename, subdir=None):
    if not filename:
        return None
    try:
        base_root = settings.MEDIA_ROOT
        if base_root:
            search_root = os.path.join(base_root, subdir) if subdir else base_root
            if os.path.isdir(search_root):
                for root, _dirs, files in os.walk(search_root):
                    if filename in files:
                        full_path = os.path.join(root, filename)
                        rel_path = os.path.relpath(full_path, base_root)
                        return rel_path.replace(os.sep, '/')
    except Exception:
        pass
    if subdir:
        rel_path = f"{subdir}/{filename}"
        try:
            if default_storage.exists(rel_path):
                return rel_path
        except Exception:
            pass
    return None

@login_required
def create_item(request):
    if not request.user.is_superuser:
        profile = getattr(request.user, 'profile', None)
        can_post = getattr(profile, 'can_post', True)
        shadow_banned = getattr(profile, 'shadow_banned', False)
        if not can_post or shadow_banned:
            if request.method == "POST" and request.headers.get('x-requested-with') == 'XMLHttpRequest':
                msg = "You have been shadow banned. Improve your trust score to restore access." if shadow_banned else "Create post is disabled. Improve your trust score to restore access."
                return JsonResponse({"success": False, "error": msg}, status=403)
            return redirect('smart_blog:items_list')
    if request.method == "POST":
        form = ItemCreateForm(request.POST)
        files = request.FILES.getlist("images")

        # --- server-side validation: count, types, size
        if len(files) > MAX_IMAGES:
            form.add_error(None, f"Maximum {MAX_IMAGES} images allowed.")
        else:
            bad = [f.name for f in files if (f.content_type or "").lower().strip() not in ALLOWED_CONTENT_TYPES]
            if bad:
                form.add_error(None, f"Unsupported file types: {', '.join(bad)}")
            for f in files:
                f.seek(0, 2)
                sz = f.tell()
                f.seek(0)
                if sz > MAX_FILE_SIZE_BYTES:
                    form.add_error(None, f"File {f.name} too large ({sz / (1024*1024):.1f} MB). Max {MAX_FILE_SIZE_BYTES / (1024*1024):.0f} MB.")
                    break

        # Enforce: either 0 images OR at least 2 images
        if files and (len(files) == 1):
            form.add_error(None, "Either submit no images, or at least 2 images (minimum 2, maximum 10).")

        if form.is_valid():
            item = form.save(commit=False)
            item.author = request.user
            item.save()
            form.save_m2m()

            new_tags_raw = form.cleaned_data.get('new_tags', '')
            if new_tags_raw:
                for tg in [t for t in re.split(r'\s+', new_tags_raw.strip()) if t]:
                    tag_obj, _ = Tag.objects.get_or_create(tag_name=tg)
                    item.tags.add(tag_obj)

            # Ensure search_vector is populated so new posts appear in search immediately
            refresh_item_search_vector(item.pk)

            for f in files[:MAX_IMAGES]:
                processed = process_image_legacy_safe(f, item.pk)
                if processed:
                    ItemImage.objects.create(
                        item=item,
                        image=processed["image"],
                        image_thumbnail=processed["image_thumbnail"],
                        image_medium=processed["image_medium"],
                        width=processed.get("width"),
                        height=processed.get("height"),
                    )
                else:
                    ItemImage.objects.create(item=item, image=f)

            profile_url = redirect('login_app:profile', username=request.user.username).url
            if request.headers.get('x-requested-with') == 'XMLHttpRequest':
                return JsonResponse({"success": True, "redirect": profile_url})
            messages.success(request, "Item created successfully.")
            return redirect(profile_url)
        else:
            # Form invalid
            if request.headers.get('x-requested-with') == 'XMLHttpRequest':
                errors = {}
                for k, v in form.errors.items():
                    errors[k] = v.get_json_data() if hasattr(v, 'get_json_data') else form.errors[k]
                simple = {k: [str(x) for x in v] for k, v in form.errors.items()}
                return JsonResponse({"success": False, "errors": simple}, status=400)
            selected_tag_ids = [int(x) for x in request.POST.getlist("tags") if x.isdigit()]
    else:
        form = ItemCreateForm()
        selected_tag_ids = []
    return render(request, "smart_blog/create_item.html", {"form": form, "selected_tag_ids": selected_tag_ids})


def register_item_view(request, item):
    if request.user.is_authenticated:
        ItemView.objects.get_or_create(
            item=item,
            user=request.user
        )
    else:
        if not request.session.session_key:
            request.session.create()

        ItemView.objects.get_or_create(
            item=item,
            user=None,
            session_key=request.session.session_key,
            defaults={
                "ip_address": request.META.get("REMOTE_ADDR")
            }
        )


# detail item 
def item_detail(request, slug):
    slug = (slug or '').strip()
    item = get_object_or_404(Item.objects.filter(is_published=True), slug=slug)

    # 1️⃣ РЕГИСТРИРУЕМ ПРОСМОТР
    register_item_view(request, item)

    # 2️⃣ ЗАНОВО ПОЛУЧАЕМ item С КОРРЕКТНЫМИ СЧЁТЧИКАМИ + prefetch images
    item = (
        Item.objects
        .with_counters()
        .select_related("category")
        .annotate(reports_count=Count('reports', distinct=True))
        .prefetch_related("images")
        .get(pk=item.pk)
    )

    # ---- 2) Subquery лайков комментариев ----
    if request.user.is_authenticated:
        likes_subq = CommentLike.objects.filter(
            comment=OuterRef('pk'),
            user=request.user
        )
    else:
        likes_subq = CommentLike.objects.none()

    # ---- 3) Основные комментарии ----
    main_comments_qs = (
        Comment.objects
        .filter(item=item, parent__isnull=True, is_draft=False)
        .annotate(
            user_liked=Exists(likes_subq),
            likes_count=Count('likes', distinct=True),
            replies_count=Count('replies', filter=Q(replies__is_draft=False), distinct=True),
            reports_count=Count('reports', distinct=True),
        )
        .order_by('-created')
    )

    replies_qs = (
        Comment.objects
        .filter(parent__isnull=False, is_draft=False)
        .annotate(
            user_liked=Exists(likes_subq),
            likes_count=Count('likes', distinct=True),
            reports_count=Count('reports', distinct=True),
        )
        .order_by('-created')   # 🔥 СВЕЖИЕ СВЕРХУ
        )

    comments = main_comments_qs.prefetch_related(
        Prefetch('replies', queryset=replies_qs),
        Prefetch('replies__replies', queryset=replies_qs),
        Prefetch('replies__replies__replies', queryset=replies_qs),
    )

    # ---- 4) Пользовательские флаги ----
    user_liked = (
        Like.objects.filter(item=item, user=request.user).exists()
        if request.user.is_authenticated else False
    )

    user_bookmarked = (
        Bookmark.objects.filter(item=item, user=request.user).exists()
        if request.user.is_authenticated else False
    )

    user_reported_item = has_user_reported_item(request.user, item)
    allowed, _ = can_user_report(request.user) if request.user.is_authenticated else (False, None)
    report_rate_limited = not allowed

    liked_users = (
        Like.objects
        .filter(item=item)
        .select_related('user', 'user__profile')
        .exclude(user__isnull=True)
        .order_by('-created_at')
    )

    # ---- 5) Редактирование ----
    editable_until = (item.published_date or item.created) + timedelta(hours=24)
    is_editable = timezone.now() <= editable_until

    source = request.GET.get("from")
    source_user = request.GET.get("user")
    source_section = request.GET.get("section")
    source_url = request.GET.get("source_url")
    source_query = request.GET.get("query")
    source_tag = request.GET.get("tag")
    source_tag_slug = request.GET.get("tag_slug")
    section_titles = {
        "created": "Created",
        "liked": "Liked",
        "bookmarked": "Bookmarked",
    }

    safe_source_url = None
    if source_url and url_has_allowed_host_and_scheme(
        url=source_url,
        allowed_hosts={request.get_host()},
        require_https=request.is_secure()
    ):
        safe_source_url = source_url

    if source == "profile" and source_user and source_section in section_titles:
        breadcrumbs = build_breadcrumbs(
            breadcrumb(source_user, reverse("login_app:profile", kwargs={"username": source_user})),
            breadcrumb(section_titles[source_section], None),
            breadcrumb(item.title, None),
        )
    elif source == "items_list":
        breadcrumbs = build_breadcrumbs(
            breadcrumb("BraiNews", safe_source_url or reverse("smart_blog:items_list")),
            breadcrumb(item.title, None),
        )
    elif source == "popular":
        breadcrumbs = build_breadcrumbs(
            breadcrumb("Popular", safe_source_url or reverse("smart_blog:items_popular")),
            breadcrumb(item.title, None),
        )
    elif source == "search" and source_query:
        from urllib.parse import urlencode
        search_url = safe_source_url or (reverse("global_search") + "?" + urlencode({"q": source_query}))
        breadcrumbs = build_breadcrumbs(
            breadcrumb(f"Found - {source_query}", search_url),
            breadcrumb(item.title, None),
        )
    elif source == "tag" and source_tag:
        tag_url = safe_source_url
        if not tag_url and source_tag_slug:
            tag_url = reverse("smart_blog:tag_list", kwargs={"slug": source_tag_slug})
        if not tag_url:
            tag_url = reverse("smart_blog:items_list")
        breadcrumbs = build_breadcrumbs(
            breadcrumb(source_tag, tag_url),
            breadcrumb(item.title, None),
        )
    elif source == "home":
        breadcrumbs = build_breadcrumbs(
            breadcrumb("BrainStorm", safe_source_url or "/"),
            breadcrumb(item.title, None),
        )
    else:
        breadcrumbs = build_breadcrumbs(
            breadcrumb("BraiNews", reverse("smart_blog:items_list")),
            breadcrumb(item.title, None),
        )

    comments_min_visible = _comments_min_visible_for_focus(item, request.GET.get("focus_comment"))

    return render(request, "smart_blog/item_detail.html", {
        "item": item,                 # ← ВСЕ СЧЁТЧИКИ УЖЕ ЗДЕСЬ
        "form": CommentForm(),
        "comments": comments,
        "user_liked": user_liked,
        "user_bookmarked": user_bookmarked,
        "user_reported_item": user_reported_item,
        "report_rate_limited": report_rate_limited,
        "liked_users": liked_users,
        "editable_until_iso": editable_until.isoformat(),
        "is_editable": is_editable,
        "breadcrumbs": breadcrumbs,
        "comments_min_visible": comments_min_visible,
    })


def comment_thread(request, pk):
    comment = get_object_or_404(Comment, pk=pk)
    if comment.is_draft:
        raise Http404

    if request.user.is_authenticated:
        thread_likes_subq = CommentLike.objects.filter(
            comment=OuterRef('pk'),
            user=request.user
        )
    else:
        thread_likes_subq = CommentLike.objects.none()

    replies_qs = Comment.objects.filter(is_draft=False).annotate(
        user_liked=Exists(thread_likes_subq),
        likes_count=Count('likes', distinct=True),
        reports_count=Count('reports', distinct=True),
    ).order_by('-created')
    comment = (
        Comment.objects
        .filter(pk=comment.pk)
        .annotate(
            user_liked=Exists(thread_likes_subq),
            likes_count=Count('likes', distinct=True),
            reports_count=Count('reports', distinct=True),
        )
        .prefetch_related(
            Prefetch('replies', queryset=replies_qs),
            Prefetch('replies__replies', queryset=replies_qs),
            Prefetch('replies__replies__replies', queryset=replies_qs),
            Prefetch('replies__replies__replies__replies', queryset=replies_qs),
        )
        .get()
    )

    allowed, _ = can_user_report(request.user) if request.user.is_authenticated else (False, None)
    report_rate_limited = not allowed

    breadcrumbs = build_breadcrumbs(
        breadcrumb(comment.item.title, comment.item.get_absolute_url()),
        breadcrumb("Replies", None),
    )

    return render(request, "smart_blog/comment_thread.html", {
        "comment": comment,
        "item": comment.item,
        "report_rate_limited": report_rate_limited,
        "breadcrumbs": breadcrumbs,
    })


@login_required
def edit_item(request, slug):
    slug = (slug or '').strip()
    item = get_object_or_404(Item, slug=slug)

    # ---- защита: только автор может редактировать ----
    if request.user != item.author:
        return HttpResponseForbidden("You are not allowed to edit this item.")

    if not item.is_editable and not request.user.is_staff:
        return HttpResponseForbidden("Editing period expired (24 hours after publication).")

    existing_images = item.images.all()   # ItemImage → related_name="images"

    if request.method == "POST":
        form = ItemCreateForm(request.POST)
        files = request.FILES.getlist("images")
        delete_ids = request.POST.getlist("delete_images")  # ids user marked to delete in UI

        # ---- server-side validation: count, types, size ----
        if len(files) > MAX_IMAGES:
            form.add_error(None, f"Maximum {MAX_IMAGES} images allowed.")
        else:
            wrong = [f.name for f in files if (f.content_type or "").lower().strip() not in ALLOWED_CONTENT_TYPES]
            if wrong:
                form.add_error(None, f"Unsupported file types: {', '.join(wrong)}")
            for f in files:
                f.seek(0, 2)
                sz = f.tell()
                f.seek(0)
                if sz > MAX_FILE_SIZE_BYTES:
                    form.add_error(None, f"File {f.name} too large ({sz / (1024*1024):.1f} MB). Max {MAX_FILE_SIZE_BYTES / (1024*1024):.0f} MB.")
                    break

        # compute counts after applying delete_ids
        existing_count = existing_images.count()
        delete_count = len(delete_ids) if delete_ids else 0
        remaining_after_delete = max(0, existing_count - delete_count)
        total_after = remaining_after_delete + len(files)

        # Enforce min/max: either 0 images OR >=2 images, and never more than MAX_IMAGES
        if total_after > MAX_IMAGES:
            form.add_error(None, f"Total images after updates cannot exceed {MAX_IMAGES}.")
        if total_after == 1:
            form.add_error(None, "Resulting number of images would be 1 — either keep 0 images or at least 2 images.")

        if form.is_valid():
            # обновляем сам Item
            item.title = form.cleaned_data["title"]
            item.text = form.cleaned_data["text"]

            # сравниваем категорию до изменений (для Edited badge)
            new_category = form.cleaned_data.get("category")
            new_category_id = new_category.pk if new_category else None
            if item.category_id != new_category_id:
                item.edited = True

            item.category = new_category

            # сравниваем теги до изменений (для Edited badge)
            old_tag_ids = set(item.tags.values_list("pk", flat=True))

            # обновляем теги
            new_tags_from_form = list(form.cleaned_data["tags"])
            new_tags_raw = form.cleaned_data.get("new_tags", "")
            if new_tags_raw:
                for tg in [t for t in re.split(r'\s+', new_tags_raw.strip()) if t]:
                    tag_obj, _ = Tag.objects.get_or_create(tag_name=tg)
                    new_tags_from_form.append(tag_obj)

            item.tags.set(new_tags_from_form)
            new_tag_ids = set(item.tags.values_list("pk", flat=True))
            if old_tag_ids != new_tag_ids:
                item.edited = True

            if delete_ids or files:
                item.edited = True

            item.save()

            if delete_ids:
                for sid in delete_ids:
                    try:
                        img = ItemImage.objects.get(pk=sid, item=item)
                        for fn in ("image", "image_thumbnail", "image_medium"):
                            try:
                                f = getattr(img, fn, None)
                                if f and getattr(f, "name", None):
                                    f.delete(save=False)
                            except Exception:
                                pass
                        img.delete()
                    except ItemImage.DoesNotExist:
                        pass

            # ---- ДОБАВЛЯЕМ новые изображения (обработка + WebP + responsive) ----
            for f in files[:MAX_IMAGES]:
                processed = process_image_legacy_safe(f, item.pk)
                if processed:
                    ItemImage.objects.create(
                        item=item,
                        image=processed["image"],
                        image_thumbnail=processed["image_thumbnail"],
                        image_medium=processed["image_medium"],
                        width=processed.get("width"),
                        height=processed.get("height"),
                    )
                else:
                    ItemImage.objects.create(item=item, image=f)

            messages.success(request, "Post was successfully edited")
            redirect_url = f"{item.get_absolute_url()}?{request.GET.urlencode()}" if request.GET else item.get_absolute_url()
            if request.headers.get("x-requested-with") == "XMLHttpRequest":
                return JsonResponse({"success": True, "redirect": redirect_url})
            return redirect(redirect_url)
        else:
            # if AJAX -> return errors JSON
            if request.headers.get('x-requested-with') == 'XMLHttpRequest':
                simple = {k: [str(x) for x in v] for k, v in form.errors.items()}
                return JsonResponse({"success": False, "errors": simple}, status=400)
            selected_tag_ids = [int(x) for x in request.POST.getlist("tags") if x.isdigit()]
    else:
        # предварительное заполнение формы текущими данными
        form = ItemCreateForm(initial={
            "title": item.title,
            "text": item.text,
            "category": item.category_id,
            "tags": item.tags.all(),
        })
        selected_tag_ids = list(item.tags.values_list("pk", flat=True))

    return render(request, "smart_blog/edit_item.html", {
        "form": form,
        "item": item,
        "existing_images": existing_images,
        "selected_tag_ids": selected_tag_ids,
    })



logger = logging.getLogger(__name__)

@require_POST
@login_required
def delete_item_image(request, pk):
    """
    AJAX: удаление изображения по id (pk).
    Требует POST и авторизации. Только автор Item (или staff) может удалять.
    """
    img = get_object_or_404(ItemImage, pk=pk)
    item = img.item

    # разрешаем удалять только автору публикации или staff
    if request.user != item.author and not request.user.is_staff:
        return JsonResponse({"success": False, "error": "Permission denied."}, status=403)

    try:
        # удалить все файлы из storage (image, image_thumbnail, image_medium)
        for field_name in ("image", "image_thumbnail", "image_medium"):
            try:
                field = getattr(img, field_name, None)
                if field and getattr(field, "name", None):
                    field.delete(save=False)
            except Exception:
                logger.exception("Failed to delete %s file for ItemImage %s", field_name, pk)

        img.delete()
        item.edited = True
        item.save(update_fields=["edited"])
    except Exception as e:
        logger.exception("Failed to delete ItemImage %s", pk)
        return JsonResponse({"success": False, "error": "Delete failed."}, status=500)

    remaining = item.images.count()
    return JsonResponse({"success": True, "image_id": pk, "remaining": remaining})



@require_POST
@login_required
def delete_item(request, slug):
    """
    Удаление Item (только POST). Разрешено только автору или staff.
    После удаления — редирект на профиль автора.
    """
    item = get_object_or_404(Item, slug=slug)

    # право: только автор или staff
    if request.user != item.author and not request.user.is_staff:
        return HttpResponseForbidden("Permission denied.")
    
    if not item.is_editable and not request.user.is_staff:
        return HttpResponseForbidden("Deletion period expired.")
    # удаляем объект (ItemImage, файлы автоматически удалятся, если настроен storage signals или в модели)
    # если нужно принудительно удалить файлы, пробегите item.images.all() и img.image.delete(save=False)
    item_title = item.title
    try:
        item.delete()
    except Exception:
        return HttpResponse("Delete failed", status=500)

    messages.info(request, f'Post {item_title} was deleted')
    redirect_to = request.POST.get('redirect_to') or ''
    if redirect_to and url_has_allowed_host_and_scheme(redirect_to, allowed_hosts={request.get_host()}):
        return redirect(redirect_to)

    return redirect("smart_blog:items_list")


@login_required
@require_POST
def submit_report(request):
    try:
        payload = request.POST
        if request.headers.get("Content-Type", "").startswith("application/json"):
            payload = json.loads(request.body.decode("utf-8") or "{}")
    except Exception:
        payload = request.POST

    target_type = (payload.get("target_type") or "").strip()
    target_id = payload.get("target_id")
    reason = (payload.get("reason") or "").strip()
    reasons = payload.get("reasons") or []
    details = (payload.get("details") or "").strip()

    valid_reasons = set(dict(ContentReport.REASON_CHOICES))
    if isinstance(reasons, str):
        reasons = [reasons]
    if reasons:
        reasons = [r for r in reasons if r in valid_reasons]
        if not reasons:
            return JsonResponse({"success": False, "error": "Invalid reason."}, status=400)
        reason = reasons[0]
    elif reason:
        if reason not in valid_reasons:
            return JsonResponse({"success": False, "error": "Invalid reason."}, status=400)
        reasons = [reason]
    else:
        return JsonResponse({"success": False, "error": "Invalid reason."}, status=400)

    if reason == ContentReport.REASON_OTHER:
        details_stripped = (details or '').strip()
        if len(details_stripped) < 2 or len(details_stripped) > 300:
            return JsonResponse({"success": False, "error": "Please write other reasons."}, status=400)

    try:
        target_id = int(target_id)
    except (TypeError, ValueError):
        return JsonResponse({"success": False, "error": "Invalid target."}, status=400)

    item = None
    comment = None
    if target_type == "item":
        item = get_object_or_404(Item.objects.filter(is_published=True), pk=target_id)
    elif target_type == "comment":
        comment = get_object_or_404(Comment.objects.filter(is_draft=False), pk=target_id)
    else:
        return JsonResponse({"success": False, "error": "Invalid target type."}, status=400)

    allowed, err = can_user_report(request.user)
    if not allowed:
        return JsonResponse({"success": False, "error": err}, status=429)

    report, err = ReportService.create_or_update_report(
        request.user, item=item, comment=comment, reason=reason, details=details
    )
    if err:
        return JsonResponse({"success": False, "error": err}, status=400)
    return JsonResponse({"success": True, "report_id": report.pk})


@login_required
@require_POST
def add_comment(request, slug):
    if not request.user.is_superuser:
        shadow_banned = getattr(getattr(request.user, 'profile', None), 'shadow_banned', False)
        if shadow_banned:
            return JsonResponse({
                "success": False,
                "error": "You have been shadow banned. Improve your trust score to restore access."
            }, status=403)
    item = get_object_or_404(Item, slug=slug)
    # Anti-spam: per-item cooldown for main comments only (not replies)
    parent_id = request.POST.get("parent_id")
    if not parent_id:
        cooldown_key = f'comment_cooldown_{item.pk}'
        now_ts = timezone.now().timestamp()
        last_ts = request.session.get(cooldown_key)
        cooldown_sec = 30
        if last_ts and (now_ts - float(last_ts)) < cooldown_sec:
            remaining = int(cooldown_sec - (now_ts - float(last_ts)))
            return JsonResponse(
                {
                    "success": False,
                    "error": f"Please wait {remaining} seconds before commenting again."
                },
                status=429
            )
    form = CommentForm(request.POST)

    if not form.is_valid():
        return JsonResponse(
            {"success": False, "errors": form.errors},
            status=400
        )
    text = form.cleaned_data.get('text', '')
    
    # --- parent (reply) ---
    parent = None
    if parent_id:
        parent = Comment.objects.filter(
            pk=parent_id,
            item=item
        ).first()

    comment = form.save(commit=False)
    comment.text = text
    comment.author = request.user
    comment.item = item
    comment.parent = parent
    comment.save()
    if not parent_id:
        request.session[cooldown_key] = now_ts
    if parent and parent.author and parent.author != request.user:
        Notification.objects.create(
            recipient=parent.author,
            actor=request.user,
            notif_type=Notification.TYPE_REPLY,
            item=item,
            parent_comment=parent,
            reply_comment=comment,
        )
        from smart_blog.context_processors import invalidate_notifications_cache
        invalidate_notifications_cache(parent.author.pk)
    comment = Comment.objects.annotate(
        replies_count=Count('replies')
    ).get(pk=comment.pk)

    html = render_to_string(
        "includes/_comments.html",
        {
            "comment": comment,
            "user": request.user,
            "report_rate_limited": False,
        },
        request=request
    )


    return JsonResponse({
        "success": True,
        "comment_html": html,
        "comments_count": Comment.objects.filter(
            item=item,
            parent__isnull=True,
            is_draft=False
        ).count()
    })


EDITABLE_HOURS = 24
@login_required
@require_POST
def edit_comment(request, pk):
    comment = get_object_or_404(Comment, pk=pk)

    # только автор или staff
    if request.user != comment.author and not request.user.is_staff:
        return JsonResponse({'success': False, 'error': 'Permission denied.'}, status=403)

    if not request.user.is_superuser:
        shadow_banned = getattr(getattr(request.user, 'profile', None), 'shadow_banned', False)
        if shadow_banned:
            return JsonResponse({
                'success': False,
                'error': 'You have been shadow banned. Improve your trust score to restore access.'
            }, status=403)

    # проверка времени
    editable_until = comment.created + timedelta(hours=EDITABLE_HOURS)
    if timezone.now() > editable_until and not request.user.is_staff:
        return JsonResponse({'success': False, 'error': 'Editing period expired.'}, status=403)

    # валидация через форму
    form = CommentForm(request.POST, instance=comment)
    if not form.is_valid():
        return JsonResponse({'success': False, 'errors': form.errors}, status=400)

    # сохранить
    form.save()

    html = render_to_string("includes/_comments.html", {
        "comment": comment, "user": request.user,
        "report_rate_limited": False,
        "just_edited": True,
    })
    total_comments = Comment.objects.filter(item=comment.item, is_draft=False).count()
    return JsonResponse({'success': True, 'comment_html': html, 'comment_id': comment.pk, 'total_comments': total_comments})


@login_required
@require_POST
def delete_comment(request, pk):
    comment = get_object_or_404(Comment, pk=pk)

    # только автор или staff может удалять
    if request.user != comment.author and not request.user.is_staff:
        return JsonResponse({'success': False, 'error': 'Permission denied.'}, status=403)

    item_slug = comment.item.slug  # для редиректа/информирования, если нужно
    parent_id = comment.parent_id  # ← ДО delete()
    comment.delete()

    # если хотим вернуть новый count комментариев:
    # total_comments = Comment.objects.filter(item=comment.item,parent__isnull=True).count()

    return JsonResponse({
        "success": True,
        "comment_id": pk,
        "parent_id": parent_id,
        "comments_count": Comment.objects.filter(
            item=comment.item,
            parent__isnull=True,
            is_draft=False
        ).count()
    })


@require_POST
@login_required
def toggle_like(request, slug):
    item = get_object_or_404(Item, slug=slug)

    like_qs = Like.objects.filter(item=item, user=request.user)

    if like_qs.exists():
        like_qs.delete()
        liked = False
        Notification.objects.filter(
            recipient=item.author,
            actor=request.user,
            notif_type=Notification.TYPE_ITEM_LIKE,
            item=item
        ).delete()
        if item.author:
            from smart_blog.context_processors import invalidate_notifications_cache
            invalidate_notifications_cache(item.author.pk)
    else:
        Like.objects.create(item=item, user=request.user)
        liked = True
        if item.author and item.author != request.user:
            Notification.objects.create(
                recipient=item.author,
                actor=request.user,
                notif_type=Notification.TYPE_ITEM_LIKE,
                item=item
            )
            from smart_blog.context_processors import invalidate_notifications_cache
            invalidate_notifications_cache(item.author.pk)

    item.refresh_from_db()
    return JsonResponse({
        "success": True,
        "item_id": item.pk,
        "liked": liked,
        "likes_count": item.likes_count,
        "views_count": item.views_count,
    })



@require_POST
@login_required
def toggle_bookmark(request, slug):
    item = get_object_or_404(Item, slug=slug)
    user = request.user

    existing = Bookmark.objects.filter(user=user, item=item)

    if existing.exists():
        existing.delete()
        bookmarked = False
    else:
        Bookmark.objects.create(user=user, item=item)
        bookmarked = True

    item.refresh_from_db()
    return JsonResponse({
        "success": True,
        "item_id": item.pk,
        "bookmarked": bookmarked,
        "bookmarks_count": item.bookmarks_count,
        "views_count": item.views_count,
    })


@require_POST
@login_required
def toggle_comment_like(request, pk):
    comment = get_object_or_404(Comment, pk=pk)

    user = request.user
    like_qs = CommentLike.objects.filter(comment=comment, user=user)
    if like_qs.exists():
        like_qs.delete()
        liked = False
        notif_filter = {
            "recipient": comment.author,
            "actor": request.user,
            "notif_type": Notification.TYPE_COMMENT_LIKE,
            "item": comment.item,
        }
        if comment.parent_id:
            Notification.objects.filter(**notif_filter, reply_comment=comment).delete()
        else:
            Notification.objects.filter(**notif_filter, parent_comment=comment).delete()
        if comment.author:
            from smart_blog.context_processors import invalidate_notifications_cache
            invalidate_notifications_cache(comment.author.pk)
    else:
        CommentLike.objects.create(comment=comment, user=user)
        liked = True
        if comment.author and comment.author != request.user:
            kwargs = {
                "recipient": comment.author,
                "actor": request.user,
                "notif_type": Notification.TYPE_COMMENT_LIKE,
                "item": comment.item,
            }
            if comment.parent_id:
                kwargs["reply_comment"] = comment
            else:
                kwargs["parent_comment"] = comment
            Notification.objects.create(**kwargs)
            from smart_blog.context_processors import invalidate_notifications_cache
            invalidate_notifications_cache(comment.author.pk)

    return JsonResponse({
        "success": True,
        "comment_id": comment.pk,
        "liked": liked,
        "likes_count": count_convert(comment.likes.count()),
    })



def item_counters(request, item_id):
    item = get_object_or_404(Item.objects.with_counters(), pk=item_id)
    return JsonResponse({
        "views": item.views_count,
        "likes": item.likes_count,
        "bookmarks": item.bookmarks_count,
        "comments": item.comments_count,
        "reposts": item.reposts_count,
    })


def _get_client_ip(request):
    xff = request.META.get('HTTP_X_FORWARDED_FOR')
    if xff:
        return xff.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '')


@require_POST
def api_repost(request):
    """
    POST /api/repost
    Body: {"post_id": int, "platform": "telegram"|"twitter"|"facebook"|"linkedin"|"copy_link"|"other"}
    Rate limits: IP 10s/post, User 5s, copy_link 15s
    """
    try:
        data = json.loads(request.body) if request.body else {}
    except json.JSONDecodeError:
        data = request.POST.dict()
    post_id = data.get('post_id') or data.get('item_id')
    platform = (data.get('platform') or 'other').strip().lower()
    valid_platforms = ['telegram', 'twitter', 'facebook', 'linkedin', 'copy_link', 'other']
    if platform not in valid_platforms:
        return JsonResponse({'error': 'Invalid platform'}, status=400)
    if not post_id:
        return JsonResponse({'error': 'post_id required'}, status=400)
    try:
        post_id = int(post_id)
    except (TypeError, ValueError):
        return JsonResponse({'error': 'Invalid post_id'}, status=400)

    item = get_object_or_404(Item.objects.filter(is_published=True), pk=post_id)
    ip = _get_client_ip(request)
    user = request.user if request.user.is_authenticated else None
    ua = (request.META.get('HTTP_USER_AGENT') or '')[:500]

    now = timezone.now()
    ip_window = timedelta(seconds=10)
    user_window = timedelta(seconds=5)
    copy_link_window = timedelta(seconds=15)

    if ip:
        recent_ip = PostRepost.objects.filter(
            item=item, ip_address=ip, created_at__gte=now - ip_window
        ).exists()
        if recent_ip:
            item.refresh_from_db()
            return JsonResponse({'reposts_count': item.reposts_count, 'rate_limited': True}, status=429)
    if user:
        recent_user = PostRepost.objects.filter(
            item=item, user=user, created_at__gte=now - user_window
        ).exists()
        if recent_user:
            item.refresh_from_db()
            return JsonResponse({'reposts_count': item.reposts_count, 'rate_limited': True}, status=429)
    if platform == PostRepost.PLATFORM_COPY_LINK and ip:
        recent_copy = PostRepost.objects.filter(
            item=item, platform=PostRepost.PLATFORM_COPY_LINK,
            ip_address=ip, created_at__gte=now - copy_link_window
        ).exists()
        if recent_copy:
            item.refresh_from_db()
            return JsonResponse({'reposts_count': item.reposts_count, 'rate_limited': True}, status=429)

    PostRepost.objects.create(
        item=item, user=user, ip_address=ip or None, platform=platform, user_agent=ua,
    )
    item.refresh_from_db()
    return JsonResponse({'reposts_count': item.reposts_count, 'success': True})
