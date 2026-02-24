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