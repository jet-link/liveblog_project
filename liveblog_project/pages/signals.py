from django.db.models import F
from django.db.models.signals import post_delete, post_save

from pages.models import HomePageContent, HomeQuickLink


def _bump_home_cache():
    if HomePageContent.objects.filter(pk=1).exists():
        HomePageContent.objects.filter(pk=1).update(cache_bump=F("cache_bump") + 1)


def quicklink_changed(sender, instance, **kwargs):
    _bump_home_cache()


post_save.connect(quicklink_changed, sender=HomeQuickLink)
post_delete.connect(quicklink_changed, sender=HomeQuickLink)
