"""
PostgreSQL Full-Text Search and filter utilities.
- Pure FTS on search_vector (title A, text B, tags C). No OR/icontains/DISTINCT.
- Popular: uses denormalized likes_count + DB expression.
- Liked/Bookmarked: use Exists in views.
- Prefix matching: "universe" matches "universal" etc.
"""
import re
from functools import reduce
from operator import or_

from django.db import connection
from django.db.models import Q, Value, FloatField, F
from django.db.models.functions import Coalesce


def is_postgresql():
    return connection.vendor == 'postgresql'


def _build_fts_query_with_prefix(q):
    """
    Build tsquery that matches exact words OR word prefixes (universe -> universal).
    Words 5+ chars get prefix variant for fuzzy-like matching.
    Strips special chars to avoid tsquery syntax errors.
    """
    safe_q = re.sub(r'[^\w\s]', ' ', q)
    words = [w.strip() for w in safe_q.split() if w.strip()]
    if not words:
        return q
    parts = []
    for w in words:
        if len(w) >= 5:
            prefix = w[:5] + ':*'
            parts.append('( ' + w + ' | ' + prefix + ' )')
        else:
            parts.append(w)
    return ' & '.join(parts)


def build_search_filter(qs, q, by_title, by_text, by_tags):
    """
    Pure PostgreSQL FTS on search_vector (no OR with icontains, no DISTINCT, no tag JOIN).
    search_vector contains: title(A) + text(B) + tags(C).
    Adds prefix matching so "universe" matches "universal" etc.
    """
    if not q or not (by_title or by_text or by_tags):
        return qs

    if is_postgresql():
        try:
            from django.contrib.postgres.search import SearchQuery, SearchRank
        except ImportError:
            return _search_icontains(qs, q, by_title, by_text, by_tags)

        raw_query = _build_fts_query_with_prefix(q)
        try:
            query = SearchQuery(raw_query, config='simple', search_type='raw')
            qs = qs.annotate(
                rank=SearchRank(F('search_vector'), query),
            )
            qs = qs.filter(search_vector=query)
        except Exception:
            query = SearchQuery(q, config='simple', search_type='websearch')
            qs = qs.annotate(
                rank=SearchRank(F('search_vector'), query),
            )
            qs = qs.filter(search_vector=query)
        qs = qs.order_by(
            Coalesce('rank', Value(0.0), output_field=FloatField()).desc(nulls_last=True),
            '-published_date',
        )
    else:
        qs = _search_icontains(qs, q, by_title, by_text, by_tags)

    return qs


def _search_icontains(qs, q, by_title, by_text, by_tags):
    """SQLite fallback. Adds prefix match (universe -> universal) for queries 5+ chars."""
    queries = []
    if by_title:
        queries.append(Q(title__icontains=q))
        if len(q) >= 5:
            queries.append(Q(title__icontains=q[:5]))
    if by_text:
        queries.append(Q(text__icontains=q))
        if len(q) >= 5:
            queries.append(Q(text__icontains=q[:5]))
    if by_tags:
        queries.append(Q(tags__tag_name__icontains=q))
        if len(q) >= 5:
            queries.append(Q(tags__tag_name__icontains=q[:5]))
    if not queries:
        return qs
    return qs.filter(reduce(or_, queries)).distinct()


def get_popularity_queryset(qs, min_likes=None):
    """
    Order by time-decayed popularity: likes_count / (hours + 2)^1.5.
    Uses denormalized likes_count, no subquery.
    Optionally filter min_likes (e.g. 6 for Popular filter, 1 for home).
    """
    if is_postgresql():
        qs = qs.extra(
            select={
                'popularity_score': """
                    smart_blog_item.likes_count::float
                    / NULLIF(
                        POWER(
                            GREATEST(0, EXTRACT(EPOCH FROM (now() - smart_blog_item.published_date)) / 3600.0) + 2,
                            1.5
                        ),
                        0
                    )
                """
            },
        ).order_by('-popularity_score')
    else:
        qs = qs.order_by('-likes_count', '-published_date')
    if min_likes is not None:
        qs = qs.filter(likes_count__gte=min_likes)
    return qs


def apply_popular_filter(qs):
    """Popular filter: time-decayed ranking, at least 6 likes."""
    return get_popularity_queryset(qs, min_likes=6)
