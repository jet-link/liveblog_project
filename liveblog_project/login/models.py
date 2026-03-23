from django.db import models
from django.conf import settings
from django.dispatch import receiver
from django.db.models.signals import post_save
import os
from django.core.files.storage import default_storage


DEFAULT_AVATAR = 'img/no_image.svg'


def avatar_upload_path(instance, filename):
    return f'avatars/user_{instance.user_id}/{filename}'


class Profile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='profile'
    )

    # 🔗 URL аватар
    avatar_url = models.URLField(
        blank=True,
        null=True,
        help_text="Optional URL to avatar image"
    )

    # 📁 Загруженный файл
    avatar_file = models.ImageField(
        upload_to='profile_avatars/',
        blank=True,
        null=True
    )

    avatar_pos_x = models.FloatField(default=0.0)
    avatar_pos_y = models.FloatField(default=0.0)

    # Trust Score (0–10)
    trust_score = models.FloatField(default=10.0, db_index=True)
    last_violation_at = models.DateTimeField(null=True, blank=True)
    can_post = models.BooleanField(default=True)
    shadow_banned = models.BooleanField(default=False)
    trust_banned = models.BooleanField(
        default=False,
        db_index=True,
        help_text='Account auto-deactivated because trust score fell below site threshold.',
    )

    # Public profile: which personal-info rows are visible to other users (owner always sees all in edit UI).
    public_username = models.BooleanField(default=True)
    public_first_name = models.BooleanField(default=True)
    public_last_name = models.BooleanField(default=True)
    public_email = models.BooleanField(default=True)

    def __str__(self):
        return f'Profile: {self.user.username}'

    def get_avatar(self):
        if self.avatar_file:
            return self.avatar_file.url

        elif self.avatar_url:
            return self.avatar_url

        return DEFAULT_AVATAR
    
    def set_avatar_file(self, new_file):
        if not new_file:
            return

        filename = os.path.basename(new_file.name)
        path = f'profile_avatars/{filename}'

        # если файл уже существует — используем его
        if default_storage.exists(path):
            self.avatar_file.name = path
        else:
            self.avatar_file = new_file
    
    

@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_or_update_user_profile(sender, instance, created, **kwargs):
    if created:
        Profile.objects.create(user=instance)
    else:
        try:
            instance.profile.save()
        except Exception:
            Profile.objects.get_or_create(user=instance)
