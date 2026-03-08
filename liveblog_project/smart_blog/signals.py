"""Signals to keep Item.likes_count, views_count, bookmarks_count in sync."""
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.db.models import F
from django.db.models.functions import Greatest

from .models import Like, Item, ItemView, Bookmark, PostRepost


@receiver(post_save, sender=Like)
def like_created(sender, instance, created, **kwargs):
    if created:
        Item.objects.filter(pk=instance.item_id).update(likes_count=F('likes_count') + 1)


@receiver(post_delete, sender=Like)
def like_deleted(sender, instance, **kwargs):
    Item.objects.filter(pk=instance.item_id).update(
        likes_count=Greatest(F('likes_count') - 1, 0)
    )


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
