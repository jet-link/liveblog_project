from django import template
from django.utils.html import strip_tags
from django.utils.text import Truncator


register = template.Library()
@register.filter(name='excerpt_plain')
def excerpt_plain(value, num=500):
    if value is None:
        return ''
    # Удаляем HTML
    text = strip_tags(value)
    # заменяем NBSP на обычный пробел
    text = text.replace('\xa0', ' ').replace('&nbsp;', ' ')
    # аккуратно обрезаем
    return Truncator(text).chars(int(num), truncate=' …')

