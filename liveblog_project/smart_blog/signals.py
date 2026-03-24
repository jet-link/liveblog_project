"""Signals to keep Item.likes_count, views_count, bookmarks_count, search_vector in sync."""
from django.core.cache import cache
from django.db.models.signals import post_save, post_delete, m2m_changed
from django.dispatch import receiver
from django.db.models import F
from django.db.models.functions import Greatest

from .models import Like, Item, ItemView, Bookmark, PostRepost, Comment
from .search_utils import refresh_item_search_vector
from smart_blog.services.trending_service import TRENDING_API_CACHE_KEY


def _invalidate_trending_api_cache():
    cache.delete(TRENDING_API_CACHE_KEY)


@receiver(post_save, sender=Like)
def like_created(sender, instance, created, **kwargs):
    if created:
        Item.objects.filter(pk=instance.item_id).update(likes_count=F('likes_count') + 1)
        _invalidate_trending_api_cache()


@receiver(post_delete, sender=Like)
def like_deleted(sender, instance, **kwargs):
    Item.objects.filter(pk=instance.item_id).update(
        likes_count=Greatest(F('likes_count') - 1, 0)
    )
    _invalidate_trending_api_cache()


@receiver(post_save, sender=ItemView)
def itemview_created(sender, instance, created, **kwargs):
    if created and instance.user_id is not None:
        Item.objects.filter(pk=instance.item_id).update(views_count=F('views_count') + 1)


@receiver(post_delete, sender=ItemView)
def itemview_deleted(sender, instance, **kwargs):
    if instance.user_id is not None:
        Item.objects.filter(pk=instance.item_id).update(
            views_count=Greatest(F('views_count') - 1, 0)
        )


@receiver(post_save, sender=Bookmark)
def bookmark_created(sender, instance, created, **kwargs):
    if created:
        Item.objects.filter(pk=instance.item_id).update(bookmarks_count=F('bookmarks_count') + 1)


@receiver(post_delete, sender=Bookmark)
def bookmark_deleted(sender, instance, **kwargs):
    Item.objects.filter(pk=instance.item_id).update(
        bookmarks_count=Greatest(F('bookmarks_count') - 1, 0)
    )


@receiver(post_save, sender=PostRepost)
def repost_created(sender, instance, created, **kwargs):
    if created:
        Item.objects.filter(pk=instance.item_id).update(reposts_count=F('reposts_count') + 1)


@receiver(post_save, sender=Comment)
def comment_changed_trending_cache(sender, instance, **kwargs):
    _invalidate_trending_api_cache()


@receiver(post_delete, sender=Comment)
def comment_deleted_trending_cache(sender, instance, **kwargs):
    _invalidate_trending_api_cache()


@receiver(post_save, sender=Item)
def item_search_vector_sync(sender, instance, **kwargs):
    """Ensure search_vector is populated so new/updated posts appear in search immediately."""
    if instance.pk:
        refresh_item_search_vector(instance.pk)


@receiver(m2m_changed, sender=Item.tags.through)
def item_tags_search_vector_sync(sender, instance, action, **kwargs):
    """Refresh search_vector when tags are added/removed (M2M changes after initial save)."""
    if action not in ('post_add', 'post_remove', 'post_clear'):
        return
    # instance is Item when using item.tags.add(); or through instance has item_id
    item_id = getattr(instance, 'item_id', None) or getattr(instance, 'pk', None)
    if item_id:
        refresh_item_search_vector(item_id)
