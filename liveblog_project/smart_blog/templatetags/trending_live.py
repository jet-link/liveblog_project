"""Live trending metrics for templates (same source as JSON API)."""
from django import template

from smart_blog.services.trending_service import live_display_metrics_for_item

register = template.Library()


@register.simple_tag
def trending_live_metrics(item):
    return live_display_metrics_for_item(item)
