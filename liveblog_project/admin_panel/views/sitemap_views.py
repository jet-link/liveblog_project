"""Admin: sitemap statistics (public index, not admin URLs)."""
from django.shortcuts import render

from admin_panel.decorators import admin_required
from admin_panel.services.sitemap_service import get_sitemap_summary


@admin_required
def sitemap_stats_view(request):
    summary = get_sitemap_summary()
    sitemap_public_url = request.build_absolute_uri("/sitemap.xml")
    robots_url = request.build_absolute_uri("/robots.txt")
    context = {
        "summary": summary,
        "sitemap_public_url": sitemap_public_url,
        "robots_url": robots_url,
    }
    return render(request, "admin/analytics/sitemap_stats.html", context)
