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
            return (
                f'<a href="{anchor}" '
                f'class="mention-link" '
                f'data-parent-id="{parent_comment_id or ""}">'
                f'@{escape(user.username)}</a>'
            )
        except User.DoesNotExist:
            return (
                f'<a href="{anchor}" '
                f'class="mention-link" '
                f'data-parent-id="{parent_comment_id or ""}">'
                f'@vanished-user</a>'
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
            return f'@{user.username}'
        except User.DoesNotExist:
            return '@vanished-user'

    text = text.replace('\r\n', '\n').replace('\r', '\n')
    return MENTION_RE.sub(repl, text)