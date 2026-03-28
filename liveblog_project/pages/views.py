from django.views import View
from django.shortcuts import render
from django.template import TemplateDoesNotExist
from django.urls import reverse
from django.contrib.sites.models import Site
from smart_blog.models import Item, TrendingItem
from smart_blog.search_utils import get_popularity_queryset
from smart_blog.sitemaps import (
    categories_for_sitemap,
    published_posts_queryset,
    static_sitemap_entries,
    tags_for_sitemap,
)
from pages.models import FAQItem, HomePageContent, HomeQuickLink
from pages.home_content import get_home_page
from pages.static_pages import get_about_page, get_contacts_page
from django.http import Http404

RECENT_POSTS_ON_SITEMAP_HTML = 40


def _ordered_editor_picks(home):
    if not home.show_editor_picks:
        return []
    id_order = [
        pk
        for pk in (
            home.editor_pick_1_id,
            home.editor_pick_2_id,
            home.editor_pick_3_id,
        )
        if pk
    ]
    if not id_order:
        return []
    qs = (
        Item.objects.filter(pk__in=id_order, is_published=True)
        .with_counters()
        .prefetch_related("images")
    )
    by_id = {i.pk: i for i in qs}
    return [by_id[i] for i in id_order if i in by_id]


def home_page(request):
    """Home page: copy and layout from HomePageContent; strip popular or trending."""
    home = get_home_page()
    quick_links = []
    if home.show_quick_links:
        quick_links = list(
            HomeQuickLink.objects.filter(is_active=True).order_by("order", "pk")
        )

    strip_items = []
    strip_heading = ""
    mode = home.content_strip_mode
    if mode == HomePageContent.STRIP_POPULAR:
        qs = (
            Item.objects.filter(is_published=True)
            .with_counters()
            .prefetch_related("images")
        )
        qs = get_popularity_queryset(qs, min_likes=home.popular_min_likes)
        strip_items = list(qs[: home.content_strip_limit])
        strip_heading = "Popular"
    elif mode == HomePageContent.STRIP_TRENDING:
        rows = (
            TrendingItem.objects.filter(item__is_published=True)
            .select_related("item", "item__category", "item__author", "item__author__profile")
            .prefetch_related("item__images")
            .order_by("-trend_score")[: home.content_strip_limit]
        )
        strip_items = [t.item for t in rows]
        strip_heading = "In trend"

    show_content_strip = mode != HomePageContent.STRIP_NONE and bool(strip_items)
    editor_picks = _ordered_editor_picks(home)

    return render(
        request,
        "pages/home.html",
        {
            "home": home,
            "meta_description": home.meta_description or "",
            "quick_links": quick_links,
            "strip_items": strip_items,
            "strip_heading": strip_heading,
            "show_content_strip": show_content_strip,
            "editor_picks": editor_picks,
        },
    )


class PageView(View):
    def get(self, request, slug, *args, **kwargs):
        if slug == 'about':
            return render(request, 'pages/about.html', {'about': get_about_page()})
        if slug == 'contacts':
            return render(request, 'pages/contacts.html', {'contacts': get_contacts_page()})
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


def sitemap_page(request):
    """Human-readable sitemap; URL list for crawlers remains /sitemap.xml."""
    static_links = []
    for label, url_name, kwargs in static_sitemap_entries():
        path = reverse(url_name, kwargs=kwargs) if kwargs else reverse(url_name)
        static_links.append({"label": label, "url": path})

    categories = list(categories_for_sitemap())
    topic_links = [
        {"label": c.name, "url": reverse("smart_blog:topic_detail", kwargs={"slug": c.slug})}
        for c in categories
    ]
    category_links = [
        {"label": c.name, "url": reverse("smart_blog:category_list", kwargs={"slug": c.slug})}
        for c in categories
    ]
    tag_links = [
        {"label": t.tag_name, "url": reverse("smart_blog:tag_list", kwargs={"slug": t.slug})}
        for t in tags_for_sitemap()
    ]
    recent_items = list(published_posts_queryset()[:RECENT_POSTS_ON_SITEMAP_HTML])
    recent_links = [{"label": item.title, "url": item.get_absolute_url()} for item in recent_items]

    site = Site.objects.get_current()
    return render(
        request,
        "pages/sitemap.html",
        {
            "static_links": static_links,
            "topic_links": topic_links,
            "category_links": category_links,
            "tag_links": tag_links,
            "recent_links": recent_links,
            "recent_total_shown": len(recent_links),
            "site_domain": site.domain,
            "site_name": site.name,
            "sitemap_xml_url": request.build_absolute_uri(reverse("sitemap_index")),
            "robots_url": request.build_absolute_uri(reverse("robots_txt")),
        },
    )


# Error handlers
def custom_404_view(request, exception):
    return render(request, 'errors/404.html', status=404)


def custom_403_view(request, exception=None):
    return render(request, 'errors/403.html', status=403)
