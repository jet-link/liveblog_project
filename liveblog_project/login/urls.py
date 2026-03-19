from django.urls import path
from . import views

app_name = "login_app"

urlpatterns = [
    path('me/trust-status/', views.api_trust_status, name='api_trust_status'),
    path('vanished/', views.vanished_generic_view, name='vanished'),
    path('vanished/created/', views.vanished_created_view, name='vanished-created'),
    path('login/', views.login_view, name='login'),
    path('register/', views.register_view, name='register'),
    path('logout/', views.logout_view, name='logout'),
    path('edit/<str:username>', views.profile_edit, name='profile-edit'),
    path('profile/remove-avatar/', views.remove_avatar, name='remove_avatar'),
    path("notifications/read/", views.mark_notification_read, name="notification_read"),
    path("notifications/read-all/", views.mark_all_notifications_read, name="notifications_read_all"),
    path("notifications/delete/", views.delete_notifications, name="notifications_delete"),
    path('<str:username>/notifications/', views.notifications_view, name='notifications'),
    path('<str:username>/online/', views.profile_online_status, name='profile-online-status'),
    path('<str:username>/<str:section>/', views.profile_section_view, name='profile-section'),
    path('<str:username>/', views.profile_view, name='profile'),
]