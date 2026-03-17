"""
Content moderation analyzer: Banned words + Regex + Detoxify.
"""
import re
import logging
from datetime import datetime, timedelta
from django.utils import timezone
from django.db.models import Q, Exists, OuterRef

logger = logging.getLogger(__name__)

# Lazy-loaded Detoxify model
_detoxify_model = None
DETOXIFY_THRESHOLD = 0.7


def get_detoxify_model():
    """Lazy load Detoxify model (first call can take 10–30 sec on CPU)."""
    global _detoxify_model
    if _detoxify_model is None:
        try:
            from detoxify import Detoxify
            _detoxify_model = Detoxify('multilingual')  # Better for mixed languages
        except ImportError:
            logger.warning('Detoxify not installed. pip install detoxify')
            _detoxify_model = False  # Mark as unavailable
    return _detoxify_model if _detoxify_model else None


def _normalize_text(text):
    """Lowercase, strip for comparison."""
    if not text:
        return ''
    return text.lower().strip()


def check_banned_words(text, forbidden_words):
    """
    Check text against forbidden word list.
    Returns (found, word, reason) or (False, None, None).
    """
    if not text or not forbidden_words:
        return False, None, None
    normalized = _normalize_text(text)
    for fw in forbidden_words:
        if not fw.is_active:
            continue
        # Whole word or as substring
        if fw.word.lower() in normalized:
            return True, fw.word, fw.reason
    return False, None, None


def check_regex_patterns(text, forbidden_patterns):
    """
    Check text against regex patterns.
    Returns (found, match, reason) or (False, None, None).
    """
    if not text or not forbidden_patterns:
        return False, None, None
    for fp in forbidden_patterns:
        if not fp.is_active:
            continue
        try:
            m = re.search(fp.pattern, text, re.IGNORECASE)
            if m:
                return True, m.group(0)[:255], fp.reason
        except re.error:
            logger.warning('Invalid regex pattern: %s', fp.pattern[:50])
            continue
    return False, None, None


# Regex patterns for violence/abuse (checked before Detoxify for speed)
ABUSE_PATTERNS = [
    (r'\bhit\s+(women|men|kids?|children|people)\b', 'abuse'),
    (r'\b(kill|hurt|beat)\s+(women|men|kids?|children|people|them|us)\b', 'abuse'),
    (r'\b(women|men|people)\s+(need|must|should)\s+(hit|kill|hurt|beat)\b', 'abuse'),
    (r'\b(need|must|gotta|got\s+to|need\s+to)\s+(hit|kill|hurt|beat)\s+\w+', 'abuse'),
    (r'\b(punch|stab|attack)\s+(women|men|kids?|people)\b', 'abuse'),
    (r'\bviolence\s+against\s+(women|men|children)\b', 'abuse'),
]


def check_abuse_patterns(text):
    """
    Check for violence/abuse phrases that Detoxify may miss.
    Returns (found, match, reason) or (False, None, None).
    """
    if not text:
        return False, None, None
    for pattern, reason in ABUSE_PATTERNS:
        try:
            m = re.search(pattern, text, re.IGNORECASE)
            if m:
                return True, m.group(0)[:255], reason
        except re.error:
            continue
    return False, None, None


def check_detoxify(text):
    """
    Run Detoxify on text.
    Returns (is_violation, reason, score_str) or (False, None, None).
    """
    model = get_detoxify_model()
    if not model:
        return False, None, None
    try:
        results = model.predict(text)
        # Map detoxify keys to our reasons
        # threat/identity_attack -> abuse (violence, targeting groups)
        for key, label in [
            ('obscene', 'obscenity'),
            ('toxic', 'abuse'),
            ('severe_toxicity', 'abuse'),
            ('threat', 'abuse'),
            ('identity_attack', 'abuse'),
            ('insult', 'harassment'),
        ]:
            score = results.get(key, 0)
            if isinstance(score, (list, tuple)):
                score = score[0] if score else 0
            if score >= DETOXIFY_THRESHOLD:
                return True, label, f'AI:{key}={score:.2f}'
        return False, None, None
    except Exception as e:
        logger.exception('Detoxify predict failed: %s', e)
        return False, None, None


def analyze_content(text, forbidden_words, forbidden_patterns, use_detoxify=True):
    """
    Run full pipeline: banned words -> regex -> abuse patterns -> detoxify.
    Returns (is_violation, reason, detected_word).
    """
    # 1. Banned words
    found, word, reason = check_banned_words(text, forbidden_words)
    if found:
        return True, reason, word

    # 2. Regex
    found, match, reason = check_regex_patterns(text, forbidden_patterns)
    if found:
        return True, reason, match[:255] if match else 'regex_match'

    # 3. Violence/abuse patterns (before Detoxify)
    found, match, reason = check_abuse_patterns(text)
    if found:
        return True, reason, match[:255] if match else 'abuse'

    # 4. Detoxify
    if use_detoxify:
        found, reason, score_str = check_detoxify(text)
        if found:
            return True, reason, score_str or 'AI:toxicity'

    return False, None, None


def run_content_analysis(schedule='now', analysis_run=None, log_callback=None):
    """
    Run full content analysis: fetch items/comments, check each, create ContentViolation.
    analysis_run: AnalysisRun instance to update progress/logs.
    log_callback: optional callable(msg) for real-time logs.
    """
    from admin_panel.models import (
        AnalysisRun, ContentViolation, ForbiddenWord, ForbiddenPattern,
    )
    from smart_blog.models import Item, Comment

    def log(msg):
        if log_callback:
            log_callback(msg)
        if analysis_run:
            lines = list(analysis_run.log_lines or [])
            lines.append(f'[{timezone.now().isoformat()}] {msg}')
            analysis_run.log_lines = lines
            analysis_run.save(update_fields=['log_lines'])

    # Resolve analysis_run
    if not analysis_run:
        analysis_run = AnalysisRun.objects.create(
            schedule=schedule,
            status=AnalysisRun.STATUS_RUNNING,
            progress=0,
        )

    try:
        log('Start Analysis!')
        forbidden_words = list(ForbiddenWord.objects.filter(is_active=True))
        forbidden_patterns = list(ForbiddenPattern.objects.filter(is_active=True))
        log(f'Loaded {len(forbidden_words)} forbidden words, {len(forbidden_patterns)} patterns')

        # Content created since cutoff
        if schedule == 'hourly':
            cutoff = timezone.now() - timedelta(hours=1)
        elif schedule == 'daily':
            cutoff = timezone.now() - timedelta(days=1)
        else:
            cutoff = None  # Check all for 'now'

        # Existing violation IDs to avoid duplicates
        existing_items = set(
            ContentViolation.objects.filter(item__isnull=False).values_list('item_id', flat=True)
        )
        existing_comments = set(
            ContentViolation.objects.filter(comment__isnull=False).values_list('comment_id', flat=True)
        )

        # Items
        item_qs = Item.objects.all()
        if cutoff:
            item_qs = item_qs.filter(created__gte=cutoff)
        items = list(item_qs.order_by('-created')[:5000])  # Limit batch
        total = len(items)

        # Comments
        comment_qs = Comment.objects.select_related('item').all()
        if cutoff:
            comment_qs = comment_qs.filter(created__gte=cutoff)
        comments = list(comment_qs.order_by('-created')[:5000])
        total += len(comments)

        if total == 0:
            log('No new content to analyze.')
            analysis_run.status = AnalysisRun.STATUS_COMPLETED
            analysis_run.progress = 100
            analysis_run.finished_at = timezone.now()
            analysis_run.save(update_fields=['status', 'progress', 'finished_at'])
            return analysis_run

        processed = 0
        violations_created = 0

        for item in items:
            if item.pk in existing_items:
                processed += 1
                continue
            text = f'{item.title or ""} {item.text or ""}'
            is_violation, reason, detected = analyze_content(text, forbidden_words, forbidden_patterns)
            if is_violation:
                ContentViolation.objects.create(
                    content_type=ContentViolation.TYPE_POST,
                    item=item,
                    reason=reason,
                    detected_word=detected[:255],
                    status=ContentViolation.STATUS_PENDING,
                    analysis_run=analysis_run,
                )
                existing_items.add(item.pk)
                violations_created += 1
                log(f'Violation: Post #{item.pk} ({reason}): {detected[:50]}...')
            processed += 1
            if analysis_run and total > 0:
                analysis_run.progress = min(99, int(100 * processed / total))
                analysis_run.save(update_fields=['progress'])

        for comment in comments:
            if comment.pk in existing_comments:
                processed += 1
                continue
            text = comment.text or ''
            is_violation, reason, detected = analyze_content(text, forbidden_words, forbidden_patterns)
            if is_violation:
                ContentViolation.objects.create(
                    content_type=ContentViolation.TYPE_COMMENT,
                    comment=comment,
                    reason=reason,
                    detected_word=detected[:255],
                    status=ContentViolation.STATUS_PENDING,
                    analysis_run=analysis_run,
                )
                existing_comments.add(comment.pk)
                violations_created += 1
                log(f'Violation: Comment #{comment.pk} ({reason}): {detected[:50]}...')
            processed += 1
            if analysis_run and total > 0:
                analysis_run.progress = min(99, int(100 * processed / total))
                analysis_run.save(update_fields=['progress'])

        log(f'Finish Analysis! Processed {processed} items. Found {violations_created} violations.')
        analysis_run.status = AnalysisRun.STATUS_COMPLETED
        analysis_run.progress = 100
        analysis_run.finished_at = timezone.now()
        analysis_run.save(update_fields=['status', 'progress', 'finished_at'])

    except Exception as e:
        logger.exception('Content analysis failed: %s', e)
        log(f'Error: {e}')
        analysis_run.status = AnalysisRun.STATUS_FAILED
        analysis_run.finished_at = timezone.now()
        analysis_run.save(update_fields=['status', 'finished_at'])

    return analysis_run
