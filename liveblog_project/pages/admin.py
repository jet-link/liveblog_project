from django.contrib import admin
from pages.models import FAQItem

# pages/admin.py
@admin.register(FAQItem)
class FAQItemAdmin(admin.ModelAdmin):
    list_display = ('question', 'order', 'is_active')
    list_editable = ('order', 'is_active')