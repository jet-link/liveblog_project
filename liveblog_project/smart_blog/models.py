# smart_blog/models.py
from django.db import models
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils.text import slugify
import string, random
from transliterate import translit
from datetime import timedelta
from django.utils.html import strip_tags
from django.db.models import Q, Count


User = get_user_model()

class ItemQuerySet(models.QuerySet):
    def with_counters(self):
        return self.annotate(
            views_count=Count(
                'views',
                filter=Q(views__user__isnull=False),
                distinct=True
            ),
            likes_count=Count('likes', distinct=True),
            bookmarks_count=Count('bookmarked_by', distinct=True),
            comments_count=Count(
                'comments',
                filter=Q(comments__parent__isnull=True),
                distinct=True
            ),
        )
    
class ItemManager(models.Manager):
    def get_queryset(self):
        return ItemQuerySet(self.model, using=self._db)

    def with_counters(self):
        return self.get_queryset().with_counters()

class Tag(models.Model):
    tag_name = models.CharField(max_length=50, unique=True)
    slug = models.SlugField(max_length=60, unique=True)

    class Meta:
        verbose_name = "Tag"
        verbose_name_plural = "Tags"

    def __str__(self):
        return self.tag_name

    def get_absolute_url(self):
        from django.urls import reverse
        return reverse('smart_blog:tag_list', kwargs={'slug': self.slug})

    def save(self, *args, **kwargs):
        # Автогенерация slug при сохранении (если не указан)
        if not self.slug:
            base = slugify(self.tag_name)
            slug_candidate = base or "tag"
            # Убедимся в уникальности: добавляем суффикс при необходимости
            counter = 0
            from django.db.models import Q
            while Tag.objects.filter(Q(slug=slug_candidate)).exclude(pk=self.pk).exists():
                counter += 1
                slug_candidate = f"{base}-{counter}"
            self.slug = slug_candidate
        super().save(*args, **kwargs)

# Item model
class Item(models.Model):
    author = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name="items"
    )
    title = models.CharField(max_length=255)
    text = models.TextField()
    tags = models.ManyToManyField(Tag, related_name="items", blank=True)
    slug = models.SlugField(max_length=300, unique=True, blank=True)
    published_date = models.DateTimeField(default=timezone.now)
    created = models.DateTimeField(auto_now_add=True)
    updated = models.DateTimeField(auto_now=True)
    edited = models.BooleanField(default=False)
    is_published = models.BooleanField(default=True)
    objects = ItemManager()

    class Meta:
        ordering = ("-published_date",)

    def __str__(self):
        return self.title
    
    def short_text(self, length=600):
        # 1. Удаляем HTML теги
        plain = strip_tags(self.text)

        # 2. Убираем &nbsp и специальные пробелы
        plain = plain.replace("\xa0", " ").replace("&nbsp;", " ")

        # 3. Если текст меньше length — возвращаем как есть
        if len(plain) <= length:
            return plain

        # 4. Обрезаем, но аккуратно (не посреди слова)
        return plain[:length].rsplit(' ', 1)[0] + " …"
    

   
    def _generate_base_slug(self):
        base = slugify(self.title, allow_unicode=False)
        if not base:
            # если slugify вернул пусто (например, только кириллица),
            # попытаемся транслитерировать (если установлена библиотека)
            if translit:
                base = slugify(translit(self.title, 'ru', reversed=True))
            else:
                # fallback: взять буквенно-цифровую часть title или random short suffix
                base = ''.join(ch for ch in self.title if ch.isalnum())[:50]
                if not base:
                    base = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
        return base

    def save(self, *args, **kwargs):
        # генерируем slug только если он пуст
        if not self.slug:
            base_slug = self._generate_base_slug()
            slug_candidate = base_slug
            counter = 1
            while Item.objects.filter(slug=slug_candidate).exists():
                slug_candidate = f"{base_slug}-{counter}"
                counter += 1
            self.slug = slug_candidate
        if self.pk:
            try:
                previous = Item.objects.only('text').get(pk=self.pk)
                if previous.text != self.text:
                    self.edited = True
            except Item.DoesNotExist:
                pass

        super().save(*args, **kwargs)

    def get_absolute_url(self):
        # для удобства
        return reverse("smart_blog:item_detail", kwargs={"slug": self.slug})
    

    EDITABLE_HOURS = 24  # или 1 день = 24 часа

    @property
    def editable_until(self):
        """Возвращает datetime, до которого можно редактировать/удалять."""
        return (self.published_date or self.created) + timedelta(hours=self.EDITABLE_HOURS)

    @property
    def is_editable(self):
        """True если текущее время <= editable_until."""
        now = timezone.now()
        return now <= self.editable_until

    @property
    def is_edited(self):
        return bool(self.edited)
    
    @property
    def human_published(self):
        dt = self.published_date
        t = timezone.localtime(dt)
        now_local = timezone.localtime(timezone.now())
        dt_local = timezone.localtime(dt)
        delta_days = (now_local.date() - dt_local.date()).days

        if delta_days == 0:
            return f"Today at {t.strftime('%H:%M')}"
        elif delta_days == 1:
            return f"Yesterday at {t.strftime('%H:%M')}"
        elif 2 <= delta_days <= 5:
            return f"{delta_days} days ago at {t.strftime('%H:%M')}"
        else:
            return f"{dt_local.strftime("%d.%m.%Y")} at {t.strftime('%H:%M')}"
            # return dt_local.strftime("%d.%m.%Y")
        
        


class ItemImage(models.Model):
    """Хранит одно изображение, связанное с публикацией.
       Это позволяет иметь несколько изображений для Item."""
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(upload_to="items/%Y/%m/%d/")
    alt_text = models.CharField(max_length=255, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Image for {self.item_id}"


class Comment(models.Model):
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name="comments"
    )
    parent = models.ForeignKey(
        'self',
        null=True,
        blank=True,
        related_name='replies',
        on_delete=models.CASCADE
    )

    text = models.TextField()
    created = models.DateTimeField(auto_now_add=True)
    updated = models.DateTimeField(auto_now=True)
    edited = models.BooleanField(default=False)

    @property
    def human_published(self):
        created = timezone.localtime(self.created)
        now_local = timezone.localtime(timezone.now())
        delta_days = (now_local.date() - created.date()).days

        if delta_days == 0:
            return f"Today at {created.strftime('%H:%M')}"
        elif delta_days == 1:
            return f"Yesterday at {created.strftime('%H:%M')}"
        elif 2 <= delta_days <= 5:
            return f"{delta_days} days ago at {created.strftime('%H:%M')}"
        else:
            return f"{created.strftime("%d.%m.%Y")} at {created.strftime('%H:%M')}"

    class Meta:
        ordering = ("created",)

    def is_reply(self):
        return self.parent_id is not None

    def __str__(self):
        return f"Comment #{self.pk} on {self.item}"
    
    
    EDITABLE_HOURS = 24
    @property
    def editable_until(self):
        return self.created + timedelta(hours=self.EDITABLE_HOURS)

    @property
    def is_editable(self):
        return timezone.now() <= self.editable_until

    @property
    def is_edited(self):
        return bool(self.edited)

    def save(self, *args, **kwargs):
        if self.pk:
            try:
                previous = Comment.objects.only('text').get(pk=self.pk)
                if previous.text != self.text:
                    self.edited = True
            except Comment.DoesNotExist:
                pass
        super().save(*args, **kwargs)
        


class CommentLike(models.Model):
    comment = models.ForeignKey(Comment, on_delete=models.CASCADE, related_name="likes")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="comment_likes")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["comment", "user"], name="unique_comment_user_like")
        ]
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.user} likes comment {self.comment_id}"
    
    @property
    def likes_count(self):
        return self.likes.count()
    
    def can_show_likes(self, user):
        return self.parent is None and (user == self.author or not user.is_authenticated)
    
    


class Like(models.Model):
    """Лайк для самой публикации — один лайк от одного пользователя на одну публикацию."""
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="likes")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="likes")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["item", "user"], name="unique_item_user_like")
        ]
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.user} likes {self.item}"
    
    


# просмотр публикации
class ItemView(models.Model):
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="views")
    user = models.ForeignKey(
        User, on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="item_views"
    )
    session_key = models.CharField(max_length=40, null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    viewed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            # user
            models.UniqueConstraint(
                fields=["item", "user"],
                condition=Q(user__isnull=False),
                name="unique_item_user_view"
            ),
            # guest
            models.UniqueConstraint(
                fields=["item", "session_key"],
                condition=Q(user__isnull=True, session_key__isnull=False),
                name="unique_item_session_view"
            ),
        ]
        indexes = [
            models.Index(fields=["item", "viewed_at"]),
        ]
        ordering = ("-viewed_at",)


class Bookmark(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="bookmarks")
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="bookmarked_by")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "item"], name="unique_user_item_bookmark")
        ]
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.user} bookmarked {self.item}"