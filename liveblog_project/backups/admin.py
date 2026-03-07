"""
Admin для Backup. Доступ только superuser.
Кнопка Create Backup, скачивание, удаление.
"""
import logging
from pathlib import Path

from django.contrib import admin
from django.contrib.admin.views.decorators import staff_member_required
from django.http import FileResponse, Http404, HttpResponseRedirect
from django.shortcuts import get_object_or_404
from django.urls import path, reverse
from django.utils.html import format_html
from django.utils.safestring import mark_safe

from .models import Backup
from .services import create_backup_async

logger = logging.getLogger('backups')


@admin.register(Backup)
class BackupAdmin(admin.ModelAdmin):
    list_display = ('name', 'created_at', 'file_size_display', 'status', 'created_by', 'actions_column')
    list_filter = ('status', 'created_at')
    search_fields = ('name',)
    readonly_fields = ('name', 'created_at', 'file_size', 'file_path', 'status', 'error_message', 'created_by')
    ordering = ('-created_at',)
    date_hierarchy = 'created_at'

    def has_add_permission(self, request):
        return request.user.is_superuser

    def has_change_permission(self, request, obj=None):
        return request.user.is_superuser

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser

    def has_module_permission(self, request):
        return request.user.is_superuser

    def delete_model(self, request, obj):
        if obj.file_path and Path(obj.file_path).exists():
            try:
                Path(obj.file_path).unlink()
                logger.info('Backup file deleted by %s: %s', request.user, obj.file_path)
            except OSError as e:
                logger.warning('Could not delete backup file %s: %s', obj.file_path, e)
        logger.info('Backup record deleted by %s: %s', request.user, obj.name)
        super().delete_model(request, obj)

    def delete_queryset(self, request, queryset):
        for obj in queryset:
            if obj.file_path and Path(obj.file_path).exists():
                try:
                    Path(obj.file_path).unlink()
                    logger.info('Backup file deleted by %s: %s', request.user, obj.file_path)
                except OSError as e:
                    logger.warning('Could not delete backup file %s: %s', obj.file_path, e)
            logger.info('Backup record deleted by %s: %s', request.user, obj.name)
        super().delete_queryset(request, queryset)

    def file_size_display(self, obj):
        return obj.file_size_human if obj.file_size else '-'

    file_size_display.short_description = 'Size'

    def actions_column(self, obj):
        if obj.status != Backup.STATUS_COMPLETED or not obj.file_path or not Path(obj.file_path).exists():
            return '-'
        url = reverse('admin:backups_backup_download', args=[obj.pk])
        return format_html('<a href="{}" class="button">Download</a>', url)

    actions_column.short_description = 'Actions'

    def changelist_view(self, request, extra_context=None):
        extra_context = extra_context or {}
        extra_context['show_create_backup'] = request.user.is_superuser
        return super().changelist_view(request, extra_context)

    def get_urls(self):
        urls = super().get_urls()
        custom = [
            path('create/', self.admin_site.admin_view(self.create_backup_view), name='backups_backup_create'),
            path('<int:pk>/download/', self.admin_site.admin_view(self.download_backup_view), name='backups_backup_download'),
        ]
        return custom + urls

    def create_backup_view(self, request):
        if not request.user.is_superuser:
            raise Http404
        backup = create_backup_async(user=request.user)
        logger.info('Backup creation started by %s: %s', request.user, backup.name)
        url = reverse('admin:backups_backup_changelist')
        return HttpResponseRedirect(url)

    def download_backup_view(self, request, pk):
        if not request.user.is_superuser:
            raise Http404
        backup = get_object_or_404(Backup, pk=pk)
        if backup.status != Backup.STATUS_COMPLETED or not backup.file_path:
            raise Http404('Backup not available for download')
        path = Path(backup.file_path)
        if not path.exists():
            raise Http404('Backup file not found')
        try:
            return FileResponse(
                path.open('rb'),
                as_attachment=True,
                filename=path.name,
                content_type='application/gzip',
            )
        except OSError as e:
            logger.error('Download failed for backup %s: %s', backup.pk, e)
            raise Http404('Could not open backup file')
