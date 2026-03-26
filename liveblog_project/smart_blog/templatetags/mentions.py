import re
from django import template
from django.contrib.auth import get_user_model
from django.utils.html import escape
from django.utils.safestring import mark_safe

register = template.Library()
User = get_user_model()

MENTION_RE = re.compile(r'@\[\s*user\s*:\s*(\d+)\s*\]')

@register.filter
def render_mentions(text, parent_comment_id=None):
    if not text:
        return ""

    def repl(match):
        user_id = match.group(1)
        anchor = f'#comment-anchor-{parent_comment_id}' if parent_comment_id else '#'
        try:
            user = User._base_manager.get(pk=user_id)
            if user.is_active:
                label = escape(user.username)
                title_attr = f' title="{escape(user.username)}"'
            else:
                if getattr(user, "deleted_queue_entry", None):
                    label = "deleted-user"
                    title_attr = ' title="Deleted user"'
                else:
                    label = "banned-user"
                    title_attr = ' title="Banned user"'
            return (
                f'<a href="{anchor}" '
                f'class="mention-link" '
                f'data-parent-id="{parent_comment_id or ""}"{title_attr}>'
                f'@{label}</a>'
            )
        except User.DoesNotExist:
            return (
                f'<a href="{anchor}" '
                f'class="mention-link" '
                f'data-parent-id="{parent_comment_id or ""}" '
                f'title="Deleted user">'
                f'@deleted-user</a>'
            )

    text = text.replace('\r\n', '\n').replace('\r', '\n')
    text = MENTION_RE.sub(repl, text)
    text = text.replace('\n', '<br>')
    return mark_safe(text)


@register.filter
def strip_mentions(text):
    """Strip @[user:ID], from text. Returns plain comment body for admin display."""
    from smart_blog.utils import strip_mention_tokens
    return strip_mention_tokens(text or "")


@register.filter
def mention_names(text):
    """Replace @[user:ID] with @username (plain text, no HTML). Use for truncation-friendly display."""
    if not text:
        return ""

    def repl(match):
        user_id = match.group(1)
        try:
            user = User._base_manager.get(pk=user_id)
            if user.is_active:
                return f'@{user.username}'
            return '@banned-user'
        except User.DoesNotExist:
            return '@deleted-user'

    text = text.replace('\r\n', '\n').replace('\r', '\n')
    return MENTION_RE.sub(repl, text)


@register.filter
def mention_first_id(text):
    """Extract first @[user:ID]'s user id for edit form (to preserve mention on save)."""
    if not text:
        return ""
    m = MENTION_RE.search(text.replace('\r\n', '\n').replace('\r', '\n'))
    return m.group(1) if m else ""