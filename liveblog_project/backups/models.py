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
