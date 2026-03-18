"""Seed sample forbidden words and patterns for content moderation."""
from django.core.management.base import BaseCommand

from admin_panel.models import ForbiddenWord, ForbiddenPattern


class Command(BaseCommand):
    help = 'Seed sample forbidden words and regex patterns (idempotent).'

    def handle(self, *args, **options):
        defaults = [
            ('spam', 'spam'),
            ('viagra', 'spam'),
            ('harassment', 'harassment'),
            ('abuse', 'abuse'),
            ('shit', 'obscenity'),
            ('fuck', 'obscenity'),
            ('asshole', 'obscenity'),
        ]
        for word, reason in defaults:
            _, created = ForbiddenWord.objects.get_or_create(
                word=word,
                defaults={'reason': reason, 'is_active': True}
            )
            if created:
                self.stdout.write(f'  + {word} ({reason})')

        patterns = [
            (r'https?://[^\s]+', 'spam'),  # URLs
        ]
        for pattern, reason in patterns:
            if not ForbiddenPattern.objects.filter(pattern=pattern).exists():
                ForbiddenPattern.objects.create(pattern=pattern, reason=reason, is_active=True)
                self.stdout.write(f'  + pattern {pattern[:40]}... ({reason})')

        self.stdout.write(self.style.SUCCESS('Seed complete.'))
