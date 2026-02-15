from django.views import View
from django.shortcuts import render
from django.template import TemplateDoesNotExist
from smart_blog.models import Item
from pages.models import FAQItem
from django.http import Http404
from django.utils import timezone


def _popularity_score(item):
    """
    Time decay formula: score = likes / (hours_since_post + 2)^1.5
    """
    likes = getattr(item, 'likes_count', 0) or 0
    pub_date = item.published_date or item.created
    now = timezone.now()
    if timezone.is_naive(pub_date):
        pub_date = timezone.make_aware(pub_date)
    delta = now - pub_date
    hours_since = max(0, delta.total_seconds() / 3600)
    denominator = (hours_since + 2) ** 1.5
    return likes / denominator if denominator > 0 else 0


def home_page(request):
    items = list(
        Item.objects
        .filter(is_published=True)
        .with_counters()
        .order_by('-published_date')[:200]
    )
    items.sort(key=lambda x: _popularity_score(x), reverse=True)
    popular_items = items[:10]

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