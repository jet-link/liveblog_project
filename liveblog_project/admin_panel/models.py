"""Admin panel models."""
from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class DeletedUserLog(models.Model):
    """Log of deleted users for 'Recently deleted' admin page."""
    username = models.CharField(max_length=150)
    deleted_at = models.DateTimeField(auto_now_add=True)
    deleted_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='deleted_users_log',
    )

    class Meta:
        ordering = ('-deleted_at',)
        verbose_name = 'Deleted user log'
        verbose_name_plural = 'Deleted user logs'

    def __str__(self):
        return f'{self.username} (deleted at {self.deleted_at})'
