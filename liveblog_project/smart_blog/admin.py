from django.contrib import admin
from django.utils.html import format_html
from .models import Tag, Item, ItemImage, Comment, CommentLike, Like, ItemView, Bookmark, ContentReport
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
@admin.register(ContentReport)
class ContentReportAdmin(admin.ModelAdmin):
    list_display = ("reason", "status", "reporter", "item_link", "comment_link", "created_at")
    list_filter = ("reason", "status", "created_at")
    search_fields = ("details", "reporter__username", "item__title", "comment__text")
    readonly_fields = ("item_link", "comment_link", "created_at")

    def item_link(self, obj):
        if not obj.item:
            return "-"
        url = obj.item.get_absolute_url()
        return format_html('<a href="{}" target="_blank">{}</a>', url, obj.item.title)
    item_link.short_description = "Item link"

    def comment_link(self, obj):
        if not obj.comment:
            return "-"
        item = obj.comment.item
        if not item:
            return "-"
        url = f"{item.get_absolute_url()}#comment-anchor-{obj.comment.pk}"
        return format_html('<a href="{}" target="_blank">Comment #{}</a>', url, obj.comment.pk)
    comment_link.short_description = "Comment link"

