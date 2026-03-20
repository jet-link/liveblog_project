"""Login app context processors."""


def user_obj_context(request):
    """Provide user_obj for base template (CURRENT_AVATAR). Defaults to request.user.
    Profile pages override with the viewed user."""
    return {"user_obj": getattr(request, "user", None)}
