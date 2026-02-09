from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from .models import Item, ItemImage, Tag, Like, Comment, Bookmark, ItemView, CommentLike, ContentReport, Notification
from .forms import CommentForm, ItemCreateForm
from django.utils import timezone
from django.core.paginator import Paginator
from django.http import JsonResponse
import json
from django.views.decorators.http import require_POST
from django.template.loader import render_to_string
from django.urls import reverse
from django.http import HttpResponseForbidden, HttpResponse
from django.utils.http import url_has_allowed_host_and_scheme
from datetime import timedelta
from django.db.models import Exists, OuterRef, Count, Q
from django.db.models import Prefetch
from .utils import count_convert, build_breadcrumbs, breadcrumb, strip_mention_tokens
import logging
import os
from django.conf import settings
from django.core.files.storage import default_storage


def annotate_user_liked(qs, user):
    if user.is_authenticated:
        likes_subq = Like.objects.filter(item=OuterRef('pk'), user=user)
        return qs.annotate(user_liked=Exists(likes_subq))
    return qs


def items_list(request):
    qs = (
        Item.objects
        .with_counters()
        .order_by('-published_date')
    )
    qs = annotate_user_liked(qs, request.user)

    paginator = Paginator(qs, 20)
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


def tag_list(request, slug):
    tag = get_object_or_404(Tag, slug=slug)

    items = (
        tag.items
        .with_counters()
        .order_by('-published_date')
    )
    items = annotate_user_liked(items, request.user)

    breadcrumbs = build_breadcrumbs(
        breadcrumb("BraiNews", reverse("smart_blog:items_list")),
        breadcrumb(tag.tag_name, None),
    )

    return render(request, "smart_blog/tag_items_list.html", {
        "tag": tag,
        "items": items,
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

    if not q:
        items = Item.objects.none()
    else:
        queries = Q()
        # если ни одного фильтра не выбран — искать по title+text+tag по умолчанию
        if not (by_title or by_text or by_tags):
            by_title = True
            by_text = True
            by_tags = True

        if by_title:
            queries |= Q(title__icontains=q)
        if by_text:
            queries |= Q(text__icontains=q)
        if by_tags:
            # поиск по тегам по названию тэга
            queries |= Q(tags__tag_name__icontains=q)

        items = (
            Item.objects
            .with_counters()
            .filter(queries)
            .distinct()
            .order_by('-published_date')
        )
        items = annotate_user_liked(items, request.user)

    if q:
        breadcrumbs = build_breadcrumbs(
            breadcrumb("Search", reverse("global_search")),
            breadcrumb(q, None),
        )
    else:
        breadcrumbs = build_breadcrumbs(
            breadcrumb("Search", None),
        )

    # без пагинации — как ты просил, просто все результаты
    return render(request, 'smart_blog/search_results.html',
                  {'items': items, 'query': q, 'selected_fields': selected_fields, 'breadcrumbs': breadcrumbs})



MAX_IMAGES = 10
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/jpg", "image/webp"}
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
    if request.method == "POST":
        form = ItemCreateForm(request.POST)
        files = request.FILES.getlist("images")

        # --- CHANGED: server-side validation for file count & types
        if len(files) > MAX_IMAGES:
            form.add_error(None, f"Maximum {MAX_IMAGES} images allowed.")
        else:
            bad = [f.name for f in files if f.content_type not in ALLOWED_CONTENT_TYPES]
            if bad:
                form.add_error(None, f"Unsupported file types: {', '.join(bad)}")

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
                for tg in [t.strip() for t in new_tags_raw.split(',') if t.strip()]:
                    tag_obj, _ = Tag.objects.get_or_create(tag_name=tg)
                    item.tags.add(tag_obj)

            for f in files[:MAX_IMAGES]:
                existing_path = find_existing_media_path(f.name, subdir="items")
                if existing_path:
                    ItemImage.objects.create(item=item, image=existing_path)
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
    else:
        form = ItemCreateForm()
    return render(request, "smart_blog/create_item.html", {"form": form})


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
    item = get_object_or_404(Item, slug=slug)

    # 1️⃣ РЕГИСТРИРУЕМ ПРОСМОТР
    register_item_view(request, item)

    # 2️⃣ ЗАНОВО ПОЛУЧАЕМ item С КОРРЕКТНЫМИ СЧЁТЧИКАМИ
    item = (
        Item.objects
        .with_counters()
        .annotate(reports_count=Count('reports', distinct=True))
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
        .filter(item=item, parent__isnull=True)
        .annotate(
            user_liked=Exists(likes_subq),
            likes_count=Count('likes', distinct=True),
            replies_count=Count('replies', distinct=True),  # ✅ ВАЖНО
            reports_count=Count('reports', distinct=True),
        )
        .order_by('-created')
    )

    replies_qs = (
        Comment.objects
        .filter(parent__isnull=False)
        .annotate(reports_count=Count('reports', distinct=True))
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

    liked_users = (
        Like.objects
        .filter(item=item)
        .select_related('user', 'user__profile')
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
    elif source == "search" and source_query:
        breadcrumbs = build_breadcrumbs(
            breadcrumb(f"Found - {source_query}", safe_source_url or reverse("smart_blog:items_list")),
            breadcrumb(item.title, None),
        )
    elif source == "tag" and source_tag:
        tag_url = safe_source_url
        if not tag_url and source_tag_slug:
            tag_url = reverse("smart_blog:tag_list", kwargs={"slug": source_tag_slug})
        breadcrumbs = build_breadcrumbs(
            breadcrumb(f"Tag - {source_tag}", tag_url or reverse("smart_blog:items_list")),
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

    return render(request, "smart_blog/item_detail.html", {
        "item": item,                 # ← ВСЕ СЧЁТЧИКИ УЖЕ ЗДЕСЬ
        "form": CommentForm(),
        "comments": comments,
        "user_liked": user_liked,
        "user_bookmarked": user_bookmarked,
        "liked_users": liked_users,
        "editable_until_iso": editable_until.isoformat(),
        "is_editable": is_editable,
        "breadcrumbs": breadcrumbs,
    })


def comment_thread(request, pk):
    comment = get_object_or_404(Comment, pk=pk)

    replies_qs = Comment.objects.annotate(
        reports_count=Count('reports', distinct=True)
    ).order_by('-created')
    comment = (
        Comment.objects
        .filter(pk=comment.pk)
        .annotate(reports_count=Count('reports', distinct=True))
        .prefetch_related(
            Prefetch('replies', queryset=replies_qs),
            Prefetch('replies__replies', queryset=replies_qs),
            Prefetch('replies__replies__replies', queryset=replies_qs),
            Prefetch('replies__replies__replies__replies', queryset=replies_qs),
        )
        .get()
    )

    breadcrumbs = build_breadcrumbs(
        breadcrumb("BraiNews", reverse("smart_blog:items_list")),
        breadcrumb(comment.item.title, comment.item.get_absolute_url()),
        breadcrumb("Replies", None),
    )

    return render(request, "smart_blog/comment_thread.html", {
        "comment": comment,
        "item": comment.item,
        "breadcrumbs": breadcrumbs,
    })


@login_required
def edit_item(request, slug):
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

        # ---- CHANGED: server-side validation for new images types/count ----
        if len(files) > MAX_IMAGES:
            form.add_error(None, f"Maximum {MAX_IMAGES} images allowed.")
        else:
            wrong = [f.name for f in files if f.content_type not in ALLOWED_CONTENT_TYPES]
            if wrong:
                form.add_error(None, f"Unsupported file types: {', '.join(wrong)}")

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

            # обновляем теги
            item.tags.set(form.cleaned_data["tags"])

            # новые теги
            new_tags_raw = form.cleaned_data.get("new_tags", "")
            if new_tags_raw:
                for tg in [t.strip() for t in new_tags_raw.split(",") if t.strip()]:
                    tag_obj, created = Tag.objects.get_or_create(tag_name=tg)
                    item.tags.add(tag_obj)

            item.save()

            if delete_ids:
                for sid in delete_ids:
                    try:
                        img = ItemImage.objects.get(pk=sid, item=item)
                        try:
                            if img.image:
                                img.image.delete(save=False)
                        except Exception:
                            pass
                        img.delete()
                    except ItemImage.DoesNotExist:
                        pass

            # ---- ДОБАВЛЯЕМ новые изображения ----
            for f in files[:MAX_IMAGES]:
                existing_path = find_existing_media_path(f.name, subdir="items")
                if existing_path:
                    ItemImage.objects.create(item=item, image=existing_path)
                else:
                    ItemImage.objects.create(item=item, image=f)

            # messages.success(request, "Item updated successfully.")
            if request.GET:
                return redirect(f"{item.get_absolute_url()}?{request.GET.urlencode()}")
            return redirect(item.get_absolute_url())
        else:
            # if AJAX -> return errors JSON
            if request.headers.get('x-requested-with') == 'XMLHttpRequest':
                simple = {k: [str(x) for x in v] for k, v in form.errors.items()}
                return JsonResponse({"success": False, "errors": simple}, status=400)
    else:
        # предварительное заполнение формы текущими данными
        form = ItemCreateForm(initial={
            "title": item.title,
            "text": item.text,
            "tags": item.tags.all(),
        })

    return render(request, "smart_blog/edit_item.html", {
        "form": form,
        "item": item,
        "existing_images": existing_images,
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
        # удалить файл из storage (если есть)
        try:
            if getattr(img, 'image', None) and getattr(img.image, 'name', None):
                img.image.delete(save=False)
        except Exception as e:
            # не фейлим операцию из-за ошибок storage — логируем
            logger.exception("Failed to delete image file for ItemImage %s", pk)

        img.delete()
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
    try:
        item.delete()
    except Exception:
        # можно логировать ошибку
        return HttpResponse("Delete failed", status=500)

    redirect_to = request.POST.get('redirect_to') or ''
    if redirect_to and url_has_allowed_host_and_scheme(redirect_to, allowed_hosts={request.get_host()}):
        return redirect(redirect_to)

    return redirect("smart_blog:items_list")


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

    try:
        target_id = int(target_id)
    except (TypeError, ValueError):
        return JsonResponse({"success": False, "error": "Invalid target."}, status=400)

    item = None
    comment = None
    if target_type == "item":
        item = get_object_or_404(Item, pk=target_id)
    elif target_type == "comment":
        comment = get_object_or_404(Comment, pk=target_id)
        item = comment.item
    else:
        return JsonResponse({"success": False, "error": "Invalid target type."}, status=400)

    reporter = request.user if request.user.is_authenticated else None
    ContentReport.objects.create(
        reporter=reporter,
        item=item,
        comment=comment,
        reason=reason,
        reasons=reasons,
        details=details,
    )

    return JsonResponse({"success": True})


@login_required
@require_POST
def add_comment(request, slug):
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
    comment = Comment.objects.annotate(
        replies_count=Count('replies')
    ).get(pk=comment.pk)

    html = render_to_string(
        "includes/_comments.html",
        {"comment": comment, "user": request.user},
        request=request
    )


    return JsonResponse({
        "success": True,
        "comment_html": html,
        "comments_count": Comment.objects.filter(
            item=item,
            parent__isnull=True
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

    # вернуть фрагмент HTML (тот же шаблон, что используется для рендера одного коммента)
    html = render_to_string("includes/_comments.html", {"comment": comment, "user": request.user})
    total_comments = Comment.objects.filter(item=comment.item).count()
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
        "parent_id": parent_id,  # 🔥 ВАЖНО
        "comments_count": Comment.objects.filter(
            item=comment.item,
            parent__isnull=True
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

    return JsonResponse({
        "success": True,
        "item_id": item.pk,
        "liked": liked,
        "likes_count": item.likes.count(),
        "views_count": item.views.filter(user__isnull=False).count(),
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

    return JsonResponse({
        "success": True,
        "item_id": item.pk,
        "bookmarked": bookmarked,
        "bookmarks_count": Bookmark.objects.filter(item=item).count(),
        "views_count": item.views.filter(user__isnull=False).count(),
    })


@require_POST
@login_required
def toggle_comment_like(request, pk):
    comment = get_object_or_404(Comment, pk=pk)

    # ЗАПРЕТ лайков для reply
    if comment.parent_id is not None:
        return JsonResponse(
            {"success": False, "error": "Replies cannot be liked"},
            status=400
        )

    user = request.user
    like_qs = CommentLike.objects.filter(comment=comment, user=user)
    if like_qs.exists():
        like_qs.delete()
        liked = False
        Notification.objects.filter(
            recipient=comment.author,
            actor=request.user,
            notif_type=Notification.TYPE_COMMENT_LIKE,
            item=comment.item,
            parent_comment=comment
        ).delete()
    else:
        CommentLike.objects.create(comment=comment, user=user)
        liked = True
        if comment.author and comment.author != request.user:
            Notification.objects.create(
                recipient=comment.author,
                actor=request.user,
                notif_type=Notification.TYPE_COMMENT_LIKE,
                item=comment.item,
                parent_comment=comment
            )

    return JsonResponse({
        "success": True,
        "comment_id": comment.pk,
        "liked": liked,
        "likes_count": count_convert(comment.likes.count()),
    })



def item_counters(request, item_id):
    item = get_object_or_404(Item, pk=item_id)

    return JsonResponse({
        "views": item.views_count.filter(user__isnull=False),
        "likes": item.likes_count,
        "bookmarks": item.bookmarks_count,
        "comments": item.comments_count.filter(parent__isnull=True),
    })
