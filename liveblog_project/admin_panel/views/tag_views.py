"""Tag management views."""
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.core.paginator import Paginator

from admin_panel.decorators import admin_required
from smart_blog.models import Tag


@admin_required
def tags_list(request):
    """List tags."""
    qs = Tag.objects.all().order_by('tag_name')
    search = request.GET.get('q', '').strip()
    if search:
        qs = qs.filter(tag_name__icontains=search)
    paginator = Paginator(qs, 25)
    page = request.GET.get('page', 1)
    tags = paginator.get_page(page)
    return render(request, 'admin/tags/tags_list.html', {'tags': tags, 'search': search})


@admin_required
def tag_create(request):
    """Create tag."""
    if request.method == 'POST':
        name = request.POST.get('tag_name', '').strip()
        if name:
            Tag.objects.get_or_create(tag_name=name)
            messages.success(request, 'Tag created.')
            return redirect('admin_panel:tags_list')
        messages.error(request, 'Tag name is required.')
    return render(request, 'admin/tags/tag_form.html', {'is_create': True})


@admin_required
def tag_edit(request, pk):
    """Edit tag."""
    tag = get_object_or_404(Tag, pk=pk)
    if request.method == 'POST':
        tag.tag_name = request.POST.get('tag_name', '').strip()
        if tag.tag_name:
            tag.save()
            messages.success(request, 'Tag updated.')
            return redirect('admin_panel:tags_list')
        messages.error(request, 'Tag name is required.')
    return render(request, 'admin/tags/tag_form.html', {'tag': tag, 'is_create': False})


@admin_required
def tag_delete(request, pk):
    """Delete tag."""
    tag = get_object_or_404(Tag, pk=pk)
    if request.method == 'POST':
        tag.delete()
        messages.success(request, 'Tag deleted.')
        return redirect('admin_panel:tags_list')
    return render(request, 'admin/tags/tag_confirm_delete.html', {'tag': tag})
