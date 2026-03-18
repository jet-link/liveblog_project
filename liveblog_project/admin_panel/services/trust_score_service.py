"""User Trust Score: penalty from violations, recovery over time, auto-actions."""
from datetime import timedelta

from django.db.models import Q
from django.utils import timezone

VIOLATION_WEIGHTS = {
    "low": 0.2,
    "medium": 0.5,
    "high": 1.0,
    "critical": 2.0,
}
CONTENT_WEIGHTS = {
    "comment": 1.0,
    "post": 1.5,
}
RECOVERY_PER_DAY = 0.05
MAX_SCORE = 10.0


def time_decay(days):
    """Old violations weaken over time."""
    return 1 / (1 + days / 30)


def repeat_multiplier(violations_last_7_days):
    """Anti-spam: frequent violators get higher penalty."""
    if violations_last_7_days >= 5:
        return 1.5
    elif violations_last_7_days >= 3:
        return 1.2
    return 1.0


def calculate_user_score(user):
    """
    Compute User Trust Score (0–10) from violations with time decay, repeat multiplier, and recovery.
    """
    from django.contrib.auth import get_user_model
    from admin_panel.models import ContentViolation

    User = get_user_model()
    if not user or not isinstance(user, User):
        return MAX_SCORE

    now = timezone.now()
    seven_days_ago = now - timedelta(days=7)

    violations = ContentViolation.objects.filter(
        Q(item__author=user) | Q(comment__author=user)
    ).order_by("created_at")

    recent_count = violations.filter(created_at__gte=seven_days_ago).count()
    repeat = repeat_multiplier(recent_count)

    penalty = 0.0
    for v in violations:
        weight = VIOLATION_WEIGHTS.get(v.severity, 0.5)
        content_weight = CONTENT_WEIGHTS.get(v.content_type, 1.0)
        days = max(0, (now - v.created_at).days)
        decay = time_decay(days)
        conf = max(0.0, min(1.0, getattr(v, "confidence", 1.0)))
        penalty += weight * content_weight * decay * repeat * conf

    score = max(0.0, MAX_SCORE - penalty)

    # Recovery: add back for days since last violation
    try:
        profile = user.profile
        last_violation = getattr(profile, "last_violation_at", None)
    except Exception:
        last_violation = None

    if last_violation:
        days_clean = (now - last_violation).days
        if days_clean > 0:
            score += days_clean * RECOVERY_PER_DAY

    return min(score, MAX_SCORE)


def update_user_trust_score(user, set_last_violation=False):
    """
    Calculate score, update profile (trust_score, can_post, shadow_banned).
    When set_last_violation=True (e.g. after creating a violation), also set last_violation_at=now.
    """
    from django.contrib.auth import get_user_model

    User = get_user_model()
    if not user or not isinstance(user, User):
        return

    try:
        profile = user.profile
    except Exception:
        return

    if set_last_violation:
        profile.last_violation_at = timezone.now()

    score = calculate_user_score(user)
    profile.trust_score = round(score, 2)
    # Superusers are never restricted; others depend on score
    if getattr(user, 'is_superuser', False):
        profile.can_post = True
        profile.shadow_banned = False
    else:
        profile.can_post = score >= 5
        profile.shadow_banned = score < 3

    update_fields = ["trust_score", "can_post", "shadow_banned"]
    if set_last_violation:
        update_fields.append("last_violation_at")
    profile.save(update_fields=update_fields)
