from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from smart_blog import views as smart_views

admin.site.site_header = 'Admin'
admin.site.site_title = 'Admin'
admin.site.index_title = 'Dashboard'

urlpatterns = [
    path('admin/', admin.site.urls),

    # Глобальный поиск доступен по /search/
    path('search/', smart_views.search_view, name='global_search'),

    # blog routes (с префиксом /blog/)
    path('blog/', include('smart_blog.urls')),

    # pages last — чтобы slug-паттерн не перекрывал другие пути
    path('', include('pages.urls', namespace='pages')),
    path('profile/', include('login.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

handler404 = 'pages.views.custom_404_view'
handler403 = 'pages.views.custom_403_view'
handler500 = 'django.views.defaults.server_error'