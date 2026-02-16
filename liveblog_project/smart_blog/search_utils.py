"""
PostgreSQL-powered search and filtering utilities.
Uses stored tsvector + GIN index for O(1) full-text search when PostgreSQL is available.
Falls back to icontains / likes_count ordering for SQLite.
"""
from django.db import connection
from django.db.models import Q, Value, FloatField, F
from django.db.models.functions import Coalesce


def is_postgresql():
    return connection.vendor == 'postgresql'


def build_search_filter(qs, q, by_title, by_text, by_tags):
    """
    Apply search filter to queryset.
    - PostgreSQL: FTS on precomputed search_vector (GIN index), SearchRank for ordering.
      Uses 'simple' config for multilingual. Tags via icontains.
    - SQLite: icontains on all selected fields.
    """
    if not q or not (by_title or by_text or by_tags):
        return qs

    if is_postgresql():
        try:
            from django.contrib.postgres.search import SearchQuery, SearchRank
        except ImportError:
            return _search_icontains(qs, q, by_title, by_text, by_tags)

        tag_q = Q(tags__tag_name__icontains=q) if by_tags else Q(pk__in=[])

        if by_title or by_text:
            query = SearchQuery(q, config='simple', search_type='websearch')
            qs = qs.annotate(
                rank=SearchRank(F('search_vector'), query),
            )
            qs = qs.filter(Q(search_vector=query) | tag_q).distinct()
            qs = qs.order_by(
                Coalesce('rank', Value(0.0), output_field=FloatField()).desc(nulls_last=True),
                '-published_date',
            )
        elif by_tags:
            qs = qs.filter(tag_q).distinct()

    else:
        qs = _search_icontains(qs, q, by_title, by_text, by_tags)

    return qs


def _search_icontains(qs, q, by_title, by_text, by_tags):
    """Fallback: simple icontains search."""
    queries = Q()
    if by_title:
        queries |= Q(title__icontains=q)
    if by_text:
        queries |= Q(text__icontains=q)
    if by_tags:
        queries |= Q(tags__tag_name__icontains=q)
    return qs.filter(queries).distinct()


def get_popularity_queryset(qs):
    """
    Order queryset by time-decayed popularity score.
    Formula: likes / (hours_since_post + 2)^1.5
    PostgreSQL: computed in DB. SQLite: order by likes_count.
    """
    if is_postgresql():
        qs = qs.extra(
            select={
                'popularity_score': """
                    (SELECT COUNT(*)::float FROM smart_blog_like l WHERE l.item_id = smart_blog_item.id)
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
    return qs


def apply_popular_filter(qs):
    """
    Filter and order items by popularity (for 'popular' filter).
    Returns qs ordered by time-decayed popularity score.
    Minimal threshold: at least 6 likes.
    """
    qs = get_popularity_queryset(qs)
    return qs.filter(likes_count__gte=6)
