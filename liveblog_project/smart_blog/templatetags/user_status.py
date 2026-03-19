"""Template tags for user status display: active, banned, deleted."""
from django import template

register = template.Library()


@register.simple_tag
def user_status_display(user):
    """
    Return display label: username if active, 'Banned user' if banned, 'Deleted user' if None.
    """
    if user is None:
        return "Deleted user"
    if not user.is_active:
        return "Banned user"
    return str(user.username)


@register.simple_tag
def user_status_title(user):
    """
    Return title for hover: Username / Banned user / Deleted user.
    """
    return user_status_display(user)
