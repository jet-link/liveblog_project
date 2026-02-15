from django.views import View
from django.shortcuts import render
from django.template import TemplateDoesNotExist
from smart_blog.models import Item
from smart_blog.search_utils import get_popularity_queryset
from pages.models import FAQItem
from django.http import Http404


def home_page(request):
    """Home page with top popular items (time-decayed popularity, DB-level when PostgreSQL)."""
    qs = (
        Item.objects
        .filter(is_published=True)
        .with_counters()
    )
    qs = get_popularity_queryset(qs).filter(likes_count__gte=1)
    popular_items = list(qs[:10])

    return render(request, 'pages/home.html', {
        'popular_items': popular_items
    })


class PageView(View):
    def get(self, request, slug, *args, **kwargs):
        template_name = f'pages/{slug}.html'
        try:
            return render(request, template_name, {})
        except TemplateDoesNotExist:
            raise Http404


class FAQView(View):
    def get(self, request):
        faq_items = FAQItem.objects.filter(is_active=True).order_by('order')
        return render(request, 'pages/faq.html', {
            'faq_items': faq_items
        })


# Error handlers
def custom_404_view(request, exception):
    return render(request, 'errors/404.html', status=404)


def custom_403_view(request, exception):
    return render(request, 'errors/403.html', status=403)