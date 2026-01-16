from django.contrib import admin
from .models import Tag, Item, ItemImage, Comment, CommentLike, Like, ItemView, Bookmark
from django_ckeditor_5.widgets import CKEditor5Widget
from django import forms

@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ('tag_name', 'slug')
    prepopulated_fields = {"slug": ("tag_name",)}

@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    list_display = ("title", "author", "published_date", "is_published")
    list_filter = ("is_published", "published_date")
    search_fields = ("title", "text")
    filter_horizontal = ("tags",)

@admin.register(ItemImage)
class ItemImageAdmin(admin.ModelAdmin):
    list_display = ("item", "uploaded_at")

@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ("item", "author", "created")
    search_fields = ("text",)

admin.site.register(CommentLike)
admin.site.register(Like)
admin.site.register(ItemView)
admin.site.register(Bookmark)

