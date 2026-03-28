"""Default row values for HomePageContent pk=1 (data migration / get_or_create)."""

HOME_PAGE_DEFAULTS = {
    "browser_title": "brainstorm.news",
    "meta_description": "News, stories, and community discussion on brainstorm.news — BraiNews, trends, and topics.",
    "hero_h1": "brainstorm.news",
    "hero_lede": "Read BraiNews, explore topics, and follow what’s trending — without endless scrolling.",
    "cta_primary_label": "Open BraiNews",
    "cta_primary_url": "/blog/brainews/",
    "cta_secondary_label": "In trend",
    "cta_secondary_url": "/blog/brainews/trending/",
    "trust_line": "",
    "trust_link_url": "",
    "show_quick_links": True,
    "show_decorative_astronauts": False,
    "content_strip_mode": "popular",
    "content_strip_limit": 6,
    "popular_min_likes": 6,
    "show_editor_picks": False,
    "editor_pick_order_after_strip": False,
    "cache_bump": 0,
}

QUICK_LINK_SEED = [
    {"label": "BraiNews", "url": "/blog/brainews/", "icon_class": "fa-newspaper-o", "order": 0},
    {"label": "In trend", "url": "/blog/brainews/trending/", "icon_class": "fa-fire", "order": 1},
    {"label": "Topics", "url": "/blog/topics/", "icon_class": "fa-folder-o", "order": 2},
    {"label": "Search", "url": "/search/", "icon_class": "fa-search", "order": 3},
    {"label": "For you", "url": "/blog/for-you/", "icon_class": "fa-user", "order": 4},
]
