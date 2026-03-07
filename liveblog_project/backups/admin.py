"""
Admin для Backup. Доступ только superuser.
Кнопка Create Backup, скачивание, Restore, удаление.
"""
import logging
import subprocess
import sys
from pathlib import Path

from django.conf import settings
from django.contrib import admin
from django.contrib import messages
from django.http import FileResponse, Http404, HttpResponseRedirect
from django.shortcuts import get_object_or_404, render
from django.urls import path, reverse
from django.utils.html import format_html
from django.utils.safestring import mark_safe

from .models import Backup
from .services import create_backup_async

logger = logging.getLogger('backups')


@admin.register(Backup)
class BackupAdmin(admin.ModelAdmin):
    list_display = ('name', 'schedule_type', 'created_at', 'file_size_display', 'status', 'created_by', 'actions_column')
    list_filter = ('status', 'schedule_type', 'created_at')
    search_fields = ('name',)
    readonly_fields = ('name', 'schedule_type', 'created_at', 'file_size', 'file_path', 'status', 'error_message', 'created_by')
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
        download_url = reverse('admin:backups_backup_download', args=[obj.pk])
        restore_url = reverse('admin:backups_backup_restore', args=[obj.pk])
        return format_html(
            '<details class="backup-actions-dropdown">'
            '<summary class="button">Actions ▾</summary>'
            '<ul class="backup-actions-menu">'
            '<li><a href="{}">Download</a></li>'
            '<li><a href="{}">Restore</a></li>'
            '</ul>'
            '</details>',
            download_url, restore_url
        )

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
            path('<int:pk>/restore/', self.admin_site.admin_view(self.restore_backup_view), name='backups_backup_restore'),
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

    def restore_backup_view(self, request, pk):
        if not request.user.is_superuser:
            raise Http404
        backup = get_object_or_404(Backup, pk=pk)
        if backup.status != Backup.STATUS_COMPLETED or not backup.file_path:
            raise Http404('Backup not available for restore')
        path = Path(backup.file_path)
        if not path.exists():
            raise Http404('Backup file not found')

        if request.method == 'POST' and request.POST.get('confirm') == 'yes':
            manage_py = Path(settings.BASE_DIR) / 'manage.py'
            cmd = [sys.executable, str(manage_py), 'restore_backup', str(path.resolve()), '--no-input']
            try:
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=3600, cwd=str(settings.BASE_DIR))
                if result.returncode == 0:
                    logger.info('Restore completed by %s: %s', request.user, backup.name)
                    messages.success(request, 'Restore completed. Restart the server to use the restored data.')
                else:
                    logger.error('Restore failed: %s', result.stderr or result.stdout)
                    messages.error(request, f'Restore failed: {result.stderr or result.stdout}')
            except subprocess.TimeoutExpired:
                messages.error(request, 'Restore timed out.')
            except Exception as e:
                logger.exception('Restore failed: %s', e)
                messages.error(request, f'Restore failed: {str(e)}')
            return HttpResponseRedirect(reverse('admin:backups_backup_changelist'))

        context = {
            'title': 'Confirm Restore',
            'backup': backup,
            'opts': self.model._meta,
        }
        return render(request, 'admin/backups/backup/restore_confirm.html', context)
