"""Signals to keep Item.likes_count in sync with Like model."""
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.db.models import F
from django.db.models.functions import Greatest

from .models import Like, Item


@receiver(post_save, sender=Like)
def like_created(sender, instance, created, **kwargs):
    if created:
        Item.objects.filter(pk=instance.item_id).update(likes_count=F('likes_count') + 1)


@receiver(post_delete, sender=Like)
def like_deleted(sender, instance, **kwargs):
    Item.objects.filter(pk=instance.item_id).update(
        likes_count=Greatest(F('likes_count') - 1, 0)
    )
