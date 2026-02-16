"""
PostgreSQL Full-Text Search and filter utilities.
- Pure FTS on search_vector (title A, text B, tags C). No OR/icontains/DISTINCT.
- Popular: uses denormalized likes_count + DB expression.
- Liked/Bookmarked: use Exists in views.
"""
from functools import reduce
from operator import or_

from django.db import connection
from django.db.models import Q, Value, FloatField, F
from django.db.models.functions import Coalesce


def is_postgresql():
    return connection.vendor == 'postgresql'


def build_search_filter(qs, q, by_title, by_text, by_tags):
    """
    Pure PostgreSQL FTS on search_vector (no OR with icontains, no DISTINCT, no tag JOIN).
    search_vector contains: title(A) + text(B) + tags(C).
    """
    if not q or not (by_title or by_text or by_tags):
        return qs

    if is_postgresql():
        try:
            from django.contrib.postgres.search import SearchQuery, SearchRank
        except ImportError:
            return _search_icontains(qs, q, by_title, by_text, by_tags)

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
    """SQLite fallback."""
    queries = []
    if by_title:
        queries.append(Q(title__icontains=q))
    if by_text:
        queries.append(Q(text__icontains=q))
    if by_tags:
        queries.append(Q(tags__tag_name__icontains=q))
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
