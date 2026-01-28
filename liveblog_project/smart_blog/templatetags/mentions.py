import re
from django import template
from django.contrib.auth import get_user_model
from django.utils.html import escape
from django.utils.safestring import mark_safe
from smart_blog.utils import normalize_comment_text

register = template.Library()
User = get_user_model()

MENTION_RE = re.compile(r'@\[\s*user\s*:\s*(\d+)\s*\]')

@register.filter
def render_mentions(text, parent_comment_id=None):
    if not text:
        return ""

    def repl(match):
        user_id = match.group(1)
        try:
            user = User.objects.get(pk=user_id)
            return (
                f'<a href="#comment-{parent_comment_id}" '
                f'class="mention-link" '
                f'data-parent-id="{parent_comment_id}">'
                f'@{escape(user.username)}</a>'
            )
        except User.DoesNotExist:
            return '<span class="mention-deleted">@deleted-user</span>'

    text = normalize_comment_text(text)
    text = escape(text)
    text = MENTION_RE.sub(repl, text)
    text = text.replace('\r\n', '\n').replace('\r', '\n').replace('\n', '<br>')
    return mark_safe(text)