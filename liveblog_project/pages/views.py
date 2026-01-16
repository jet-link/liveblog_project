from django.views import View
from django.shortcuts import render
from django.template import TemplateDoesNotExist
from smart_blog.models import Item
from pages.models import FAQItem
from django.http import Http404
from django.db.models import Count, Q
from django.utils import timezone
from datetime import timedelta



def home_page(request):
    since = timezone.now() - timedelta(days=30)

    popular_items = (
        Item.objects
        .with_counters()   # 🔥 базовые счётчики
        .annotate(
            recent_likes=Count(
                'likes',
                filter=Q(likes__created_at__gte=since),
                distinct=True
            )
        )
        .filter(recent_likes__gte=5)
        .order_by('-recent_likes')[:10]
    )

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