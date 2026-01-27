from django.urls import path
from . import views

app_name = "smart_blog"

urlpatterns = [
    path('brainews/', views.items_list, name='items_list'),
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
    
    # browser back button action
    path("api/item/<int:item_id>/counters/", views.item_counters, name="item_counters")
]
