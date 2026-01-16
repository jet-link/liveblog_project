from django.urls import path
from . import views

app_name = "login_app"

urlpatterns = [
    path('login/', views.login_view, name='login'),
    path('register/', views.register_view, name='register'),
    path('logout/', views.logout_view, name='logout'),
    path('<str:username>/', views.profile_view, name='profile'),
    path('edit/<str:username>', views.profile_edit, name='profile-edit'),
    path('profile/remove-avatar/', views.remove_avatar, name='remove_avatar'),
]