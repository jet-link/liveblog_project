# from collections import deque
# smart_blog/utils.py
# from django.http import JsonResponse
import math


def breadcrumb(title, url=None):
    return {
        "title": title,
        "url": url,
    }


def build_breadcrumbs(*crumbs):
    breadcrumbs = [breadcrumb("BrainStorm", "/")]
    breadcrumbs.extend(crumbs)
    return breadcrumbs

def form_errors_to_json(form):
    """
    Преобразует form.errors и non_field_errors -> чистая JSON-структура:
    { 'errors': { field: [msg,...], ... }, 'non_field_errors': [msg,...] }
    """
    errors = {}
    for k, v in form.errors.items():
        # v — ErrorList, конвертируем в строки
        errors[k] = [str(m) for m in v]

    non_field = [str(m) for m in form.non_field_errors()]

    return {'errors': errors, 'non_field_errors': non_field}


def count_convert(n):
    if n < 1000:
        return str(n)
    for value, suffix in [(1_000_000_000, "B"), (1_000_000, "M"), (1_000, "K")]:
        if n >= value:
            res = n / value
            if res >= 10:
                return f"{int(res)}{suffix}"
            truncated = math.floor(res * 10) / 10
            return f"{truncated:.1f}".rstrip("0").rstrip('.') + suffix
