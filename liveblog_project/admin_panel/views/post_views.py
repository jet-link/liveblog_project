"""Post (Item) management views."""
import re
from django.shortcuts import render, redirect, get_object_or_404
from django.urls import reverse
from django.contrib import messages
from django.core.paginator import Paginator
from django.db.models import Q, Count
from django.utils import timezone

from admin_panel.decorators import admin_required
from admin_panel.forms import ItemAdminEditForm, ItemAdminCreateForm
from smart_blog.models import Item, Category, Tag, ItemImage
from smart_blog.image_utils import process_image_legacy_safe
from smart_blog.search_utils import refresh_item_search_vector

MAX_IMAGES = 10


@admin_required
def posts_list(request):
    """List posts with search, filter, pagination."""
    qs = Item.objects.select_related('author', 'category').annotate(
        comments_count=Count('comments', filter=Q(comments__parent__isnull=True), distinct=True)
    ).order_by('-published_date')

    search = request.GET.get('q', '').strip()
    if search:
        qs = qs.filter(
            Q(title__icontains=search) | Q(text__icontains=search)
        )

    category_id = request.GET.get('category')
    if category_id:
        qs = qs.filter(category_id=category_id)

    status = request.GET.get('status')
    if status == 'published':
        qs = qs.filter(is_published=True)
    elif status == 'draft':
        qs = qs.filter(is_published=False)

    sort = request.GET.get('sort', 'date')
    if sort == 'views':
        qs = qs.order_by('-views_count')
    elif sort == 'likes':
        qs = qs.order_by('-likes_count')
    elif sort == 'comments':
        qs = qs.order_by('-comments_count')

    paginator = Paginator(qs, 30)
    page = request.GET.get('page', 1)
    posts = paginator.get_page(page)
    categories = Category.objects.order_by('name')

    context = {
        'posts': posts,
        'categories': categories,
        'search': search,
        'current_category': category_id,
        'current_status': status,
        'current_sort': sort,
    }
    return render(request, 'admin/posts/posts_list.html', context)


@admin_required
def post_create(request):
    """Create new post."""
    selected_tag_ids = []
    if request.method == 'POST':
        form = ItemAdminCreateForm(request.POST, request.FILES)
        files = request.FILES.getlist('images')
        selected_tag_ids = [int(x) for x in request.POST.getlist('tags') if str(x).isdigit()]
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
            refresh_item_search_vector(item.pk)
            for f in files[:MAX_IMAGES]:
                if f:
                    processed = process_image_legacy_safe(f, item.pk)
                    if processed:
                        ItemImage.objects.create(
                            item=item, image=processed["image"],
                            image_thumbnail=processed.get("image_thumbnail"),
                            image_medium=processed.get("image_medium"),
                            width=processed.get("width"), height=processed.get("height"),
                        )
                    else:
                        ItemImage.objects.create(item=item, image=f)
            messages.success(request, 'Post created successfully.')
            return redirect('admin_panel:posts_list')
    else:
        form = ItemAdminCreateForm()
    return render(request, 'admin/posts/post_create.html', {'form': form, 'selected_tag_ids': selected_tag_ids})


@admin_required
def post_edit(request, pk):
    """Edit existing post."""
    item = get_object_or_404(Item, pk=pk)
    if request.method == 'POST':
        form = ItemAdminEditForm(request.POST, instance=item)
        if form.is_valid():
            form.save()
            messages.success(request, 'Post updated.')
            url = reverse('admin_panel:posts_list')
            qs = request.GET.urlencode()
            if qs:
                url += '?' + qs
            return redirect(url)
    else:
        form = ItemAdminEditForm(instance=item)
    return render(request, 'admin/posts/post_edit.html', {'form': form, 'item': item})


@admin_required
def post_delete(request, pk):
    """Delete post."""
    item = get_object_or_404(Item, pk=pk)
    if request.method == 'POST':
        item.deleted_at = timezone.now()
        item.is_published = False
        item.save(update_fields=['deleted_at', 'is_published'])
        messages.success(request, 'Post moved to Recent deleted.')
        url = reverse('admin_panel:posts_list')
        qs = request.GET.urlencode()
        if qs:
            url += '?' + qs
        return redirect(url)
    return render(request, 'admin/posts/post_confirm_delete.html', {'item': item})


@admin_required
def post_view_stats(request, pk):
    """View post statistics."""
    import json
    from smart_blog.models import Comment
    from admin_panel.services.analytics_service import get_post_activity_chart_data
    item = get_object_or_404(Item, pk=pk)
    comments_count = Comment.objects.filter(item=item, parent__isnull=True).count()
    reports_count = item.reports.count()
    activity_data = get_post_activity_chart_data(item, days=14)
    activity_json = json.dumps(activity_data)
    return render(request, 'admin/posts/post_stats.html', {
        'item': item,
        'comments_count': comments_count,
        'reports_count': reports_count,
        'activity_json': activity_json,
    })
