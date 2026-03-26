"""Public XML sitemaps (django.contrib.sitemaps)."""
from django.contrib.sitemaps import Sitemap
from django.urls import reverse

from smart_blog.models import Category, Item, Tag

# Whitelist: only slugs backed by templates (see pages.views.PageView).
PAGE_SLUGS_FOR_SITEMAP = ("about", "contacts")


def published_posts_queryset():
    """Posts included in sitemap: published, not soft-deleted."""
    return Item.objects.filter(is_published=True).order_by("-updated", "-pk")


def categories_for_sitemap():
    """Active categories (not soft-deleted)."""
    return Category.objects.all().order_by("slug")


def tags_for_sitemap():
    """Active tags (not soft-deleted)."""
    return Tag.objects.all().order_by("slug")


class StaticAndListSitemap(Sitemap):
    """Home, FAQ, static pages, and main blog listing URLs."""

    changefreq = "daily"
    priority = 0.9

    def items(self):
        entries = [
            ("pages:home", None),
            ("pages:faq", None),
            ("smart_blog:items_list", None),
            ("smart_blog:trending_list", None),
            ("smart_blog:for_you_list", None),
            ("smart_blog:topics_list", None),
        ]
        for slug in PAGE_SLUGS_FOR_SITEMAP:
            entries.append(("pages:page", {"slug": slug}))
        return entries

    def location(self, obj):
        name, kwargs = obj
        if kwargs:
            return reverse(name, kwargs=kwargs)
        return reverse(name)


class PostSitemap(Sitemap):
    changefreq = "weekly"
    priority = 0.8

    def items(self):
        return published_posts_queryset()

    def lastmod(self, obj):
        return obj.updated or obj.published_date


class TopicSitemap(Sitemap):
    """Category topic hub: /blog/topics/<slug>/."""

    changefreq = "weekly"
    priority = 0.7

    def items(self):
        return categories_for_sitemap()

    def location(self, obj):
        return reverse("smart_blog:topic_detail", kwargs={"slug": obj.slug})


class CategoryListSitemap(Sitemap):
    """Posts filtered by category: /blog/brainews/category/<slug>/."""

    changefreq = "weekly"
    priority = 0.65

    def items(self):
        return categories_for_sitemap()

    def location(self, obj):
        return reverse("smart_blog:category_list", kwargs={"slug": obj.slug})


class TagSitemap(Sitemap):
    changefreq = "weekly"
    priority = 0.65

    def items(self):
        return tags_for_sitemap()

    def location(self, obj):
        return reverse("smart_blog:tag_list", kwargs={"slug": obj.slug})


PUBLIC_SITEMAPS = {
    "static": StaticAndListSitemap,
    "posts": PostSitemap,
    "topics": TopicSitemap,
    "categories": CategoryListSitemap,
    "tags": TagSitemap,
}
