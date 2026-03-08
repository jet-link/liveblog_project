from django.db import models
from django.conf import settings


class Backup(models.Model):
    """Модель для хранения информации о backup."""

    STATUS_PENDING = 'pending'
    STATUS_RUNNING = 'running'
    STATUS_COMPLETED = 'completed'
    STATUS_FAILED = 'failed'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_RUNNING, 'Running'),
        (STATUS_COMPLETED, 'Completed'),
        (STATUS_FAILED, 'Failed'),
    ]

    SCHEDULE_MANUAL = 'manual'
    SCHEDULE_DAILY = 'daily'
    SCHEDULE_WEEKLY = 'weekly'
    SCHEDULE_MONTHLY = 'monthly'
    SCHEDULE_CHOICES = [
        (SCHEDULE_MANUAL, 'Manual'),
        (SCHEDULE_DAILY, 'Daily'),
        (SCHEDULE_WEEKLY, 'Weekly'),
        (SCHEDULE_MONTHLY, 'Monthly'),
    ]

    BACKUP_TYPE_MANUAL = 'manual'
    BACKUP_TYPE_AUTO = 'auto'
    BACKUP_TYPE_PRE_DEPLOY = 'pre_deploy'
    BACKUP_TYPE_PRE_RESTORE = 'pre_restore'
    BACKUP_TYPE_CHOICES = [
        (BACKUP_TYPE_MANUAL, 'Manual'),
        (BACKUP_TYPE_AUTO, 'Auto'),
        (BACKUP_TYPE_PRE_DEPLOY, 'Pre-deploy'),
        (BACKUP_TYPE_PRE_RESTORE, 'Pre-restore'),
    ]

    CONTENT_DATABASE = 'database'
    CONTENT_MEDIA = 'media'
    CONTENT_DATABASE_MEDIA = 'database_media'
    CONTENT_FULL = 'full'
    CONTENT_CHOICES = [
        (CONTENT_DATABASE, 'Database'),
        (CONTENT_MEDIA, 'Media'),
        (CONTENT_DATABASE_MEDIA, 'Database + Media'),
        (CONTENT_FULL, 'Full system'),
    ]

    INTEGRITY_UNKNOWN = 'unknown'
    INTEGRITY_VERIFIED = 'verified'
    INTEGRITY_CORRUPTED = 'corrupted'
    INTEGRITY_CHOICES = [
        (INTEGRITY_UNKNOWN, 'Unknown'),
        (INTEGRITY_VERIFIED, 'Verified'),
        (INTEGRITY_CORRUPTED, 'Corrupted'),
    ]

    name = models.CharField(max_length=255, verbose_name='Backup name')
    schedule_type = models.CharField(
        max_length=20,
        choices=SCHEDULE_CHOICES,
        default=SCHEDULE_MANUAL,
        verbose_name='Schedule',
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Created at')
    file_size = models.BigIntegerField(default=0, verbose_name='File size (bytes)')
    file_path = models.CharField(max_length=500, blank=True, verbose_name='File path')
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING,
        verbose_name='Status',
    )
    error_message = models.TextField(blank=True, verbose_name='Error message')
    duration_seconds = models.FloatField(null=True, blank=True, verbose_name='Duration (sec)')
    backup_type = models.CharField(
        max_length=20,
        choices=BACKUP_TYPE_CHOICES,
        default=BACKUP_TYPE_MANUAL,
        verbose_name='Backup type',
    )
    content_type = models.CharField(
        max_length=20,
        choices=CONTENT_CHOICES,
        default=CONTENT_DATABASE_MEDIA,
        verbose_name='Content',
    )
    integrity_status = models.CharField(
        max_length=20,
        choices=INTEGRITY_CHOICES,
        default=INTEGRITY_UNKNOWN,
        verbose_name='Integrity',
    )
    restore_log = models.TextField(blank=True, verbose_name='Restore log')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_backups',
        verbose_name='Created by',
    )

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Backup'
        verbose_name_plural = 'Backups'

    def __str__(self):
        return f'{self.name} ({self.created_at})'

    @property
    def file_size_human(self):
        """Возвращает размер файла в человекочитаемом формате."""
        size = self.file_size
        for unit in ('B', 'KB', 'MB', 'GB'):
            if size < 1024:
                return f'{size:.1f} {unit}'
            size /= 1024
        return f'{size:.1f} TB'

    @property
    def filename_display(self):
        """Возвращает только имя файла без пути (для UI)."""
        if not self.file_path:
            return '-'
        return self.file_path.rsplit('/', 1)[-1].rsplit('\\', 1)[-1]

    @property
    def duration_human(self):
        """Возвращает длительность в формате 4.3 sec."""
        if self.duration_seconds is None:
            return '-'
        if self.duration_seconds < 60:
            return f'{self.duration_seconds:.1f} sec'
        m = int(self.duration_seconds // 60)
        s = self.duration_seconds % 60
        return f'{m}m {s:.0f}s'
