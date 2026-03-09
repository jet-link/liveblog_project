"""Admin panel access control."""
from functools import wraps
from django.shortcuts import redirect


def is_admin(user):
    """Check if user is staff (admin)."""
    return user.is_authenticated and user.is_staff


def admin_required(view_func):
    """Decorator: login required + staff only. Redirects to login if not authenticated."""
    @wraps(view_func)
    def _wrapped(request, *args, **kwargs):
        if not request.user.is_authenticated:
            from django.conf import settings
            from urllib.parse import quote
            login_url = getattr(settings, 'LOGIN_URL', '/profile/login/')
            next_url = quote(request.get_full_path(), safe='/')
            return redirect(f'{login_url}?next={next_url}')
        if not request.user.is_staff:
            return redirect('pages:home')
        return view_func(request, *args, **kwargs)
    return _wrapped
