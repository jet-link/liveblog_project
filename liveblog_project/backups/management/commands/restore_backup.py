"""
Восстановление из backup: database.sql + media.

Запуск: python manage.py restore_backup /path/to/backup.tar.gz

ВНИМАНИЕ: Восстановление перезапишет текущую БД и media.
Рекомендуется остановить приложение перед восстановлением.
"""
import logging
import os
import shutil
import subprocess
import tarfile
import tempfile
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import connection

logger = logging.getLogger('backups')


def restore_backup(archive_path):
    """
    Восстанавливает backup из .tar.gz архива.
    Структура: backup/database.sql, backup/media/
    """
    archive_path = Path(archive_path)
    if not archive_path.exists():
        raise FileNotFoundError(f'Backup file not found: {archive_path}')

    db_settings = settings.DATABASES['default']
    media_root = Path(settings.MEDIA_ROOT)

    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir = Path(tmpdir)
        with tarfile.open(archive_path, 'r:gz') as tar:
            tar.extractall(tmpdir)

        backup_dir = tmpdir / 'backup'
        if not backup_dir.exists():
            raise ValueError('Invalid backup: missing backup/ directory')

        db_sql = backup_dir / 'database.sql'
        media_src = backup_dir / 'media'

        if not db_sql.exists():
            raise ValueError('Invalid backup: missing backup/database.sql')

        # 1. Закрыть соединения Django
        connection.close()

        # 2. Восстановить БД
        env = os.environ.copy()
        env['PGPASSWORD'] = db_settings.get('PASSWORD', '')
        cmd = [
            'psql',
            '-h', db_settings.get('HOST', 'localhost'),
            '-p', str(db_settings.get('PORT', '5432')),
            '-U', db_settings.get('USER', 'postgres'),
            '-d', db_settings.get('NAME', ''),
            '-f', str(db_sql),
            '-v', 'ON_ERROR_STOP=1',
        ]
        result = subprocess.run(cmd, env=env, capture_output=True, text=True, timeout=3600)
        if result.returncode != 0:
            logger.error('psql restore failed: %s', result.stderr or result.stdout)
            raise RuntimeError(f'Database restore failed: {result.stderr or result.stdout}')

        logger.info('Database restored successfully')

        # 3. Восстановить media
        if media_src.exists():
            media_root.mkdir(parents=True, exist_ok=True)
            for item in media_src.iterdir():
                dest = media_root / item.name
                if item.is_dir():
                    if dest.exists():
                        shutil.rmtree(dest)
                    shutil.copytree(item, dest)
                else:
                    shutil.copy2(item, dest)
            logger.info('Media restored to %s', media_root)
        else:
            logger.warning('No media directory in backup')


class Command(BaseCommand):
    help = 'Restore database and media from a backup .tar.gz file'

    def add_arguments(self, parser):
        parser.add_argument(
            'archive_path',
            type=str,
            help='Path to backup .tar.gz file',
        )
        parser.add_argument(
            '--no-input',
            action='store_true',
            help='Skip confirmation prompt',
        )

    def handle(self, *args, **options):
        archive_path = Path(options['archive_path']).resolve()
        if not archive_path.exists():
            self.stderr.write(self.style.ERROR(f'File not found: {archive_path}'))
            return

        if not options['no_input']:
            confirm = input(
                'This will OVERWRITE the current database and media. Type "yes" to continue: '
            )
            if confirm.lower() != 'yes':
                self.stdout.write('Restore cancelled.')
                return

        try:
            restore_backup(archive_path)
            self.stdout.write(self.style.SUCCESS('Restore completed successfully.'))
        except Exception as e:
            logger.exception('Restore failed: %s', e)
            self.stderr.write(self.style.ERROR(f'Restore failed: {e}'))
