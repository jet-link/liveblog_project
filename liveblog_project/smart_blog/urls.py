from django.urls import path
from . import views
from . import views_reports

app_name = "smart_blog"

urlpatterns = [
    path('brainews/', views.items_list, name='items_list'),
    path('brainews/popular/', views.items_popular_list, name='items_popular'),
    path('brainews/filter/', views.items_filtered, name='items_filtered'),
    path('tag/<slug:slug>/', views.tag_list, name='tag_list'),
    # path('search/', views.search_view, name='search'),
    path("item/create/", views.create_item, name="create_item"),
    path("item/<slug:slug>/edit/", views.edit_item, name="edit_item"),
    path('item/image/<int:pk>/delete/', views.delete_item_image, name='delete_item_image'),
    path('item/<slug:slug>/', views.item_detail, name='item_detail'),
    path("item/<slug:slug>/delete/", views.delete_item, name="delete_item"),
    path('item/<slug:slug>/comment/', views.add_comment, name='add_comment'),
    path('comment/<int:pk>/edit/', views.edit_comment, name='edit_comment'),
    path('comment/<int:pk>/delete/', views.delete_comment, name='delete_comment'),
    path('comment/<int:pk>/like/', views.toggle_comment_like, name='toggle_comment_like'),
    path('comment/<int:pk>/thread/', views.comment_thread, name='comment_thread'),
    path("item/<slug:slug>/like/", views.toggle_like, name="toggle_like"),
    path('item/<slug:slug>/bookmark/', views.toggle_bookmark, name='toggle_bookmark'),
    path("report/", views.submit_report, name="submit_report"),
    path("api/report/item/<int:pk>/", views_reports.api_report_item, name="api_report_item"),
    path("api/report/comment/<int:pk>/", views_reports.api_report_comment, name="api_report_comment"),
    path("report/item/<int:pk>/", views_reports.report_item, name="report_item"),
    path("report/comment/<int:pk>/", views_reports.report_comment, name="report_comment"),
    path("report/<int:pk>/delete/", views_reports.cancel_report, name="cancel_report"),
    # browser back button action
    path("api/item/<int:item_id>/counters/", views.item_counters, name="item_counters"),
    path("api/repost/", views.api_repost, name="api_repost"),
    path("api/search-history/", views.api_search_history_list, name="api_search_history_list"),
    path("api/search-history/<int:pk>/clicked/", views.api_search_history_clicked, name="api_search_history_clicked"),
    path("api/search-history/clear/", views.api_search_history_clear, name="api_search_history_clear"),
    path("api/search-history/<int:pk>/delete/", views.api_search_history_delete, name="api_search_history_delete"),
]
