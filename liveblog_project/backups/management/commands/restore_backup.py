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
import time
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import connection

logger = logging.getLogger('backups')


def restore_backup(archive_path):
    """
    Восстанавливает backup из .tar.gz архива.
    Структура: backup/database.sql, backup/media/
    Возвращает dict с log, tables_count, media_count, duration_seconds.
    """
    archive_path = Path(archive_path)
    if not archive_path.exists():
        raise FileNotFoundError(f'Backup file not found: {archive_path}')

    start_time = time.time()
    log_lines = []
    tables_count = 0
    media_count = 0

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

        # Count tables in SQL (approximate)
        sql_content = db_sql.read_text(errors='ignore')
        tables_count = sql_content.count('CREATE TABLE') or sql_content.count('create table')

        # 1. Закрыть соединения Django
        connection.close()
        log_lines.append('Database connections closed.')

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

        log_lines.append(f'Database restored. Tables: {tables_count}')
        logger.info('Database restored successfully')

        # 3. Восстановить media (сначала очистить, затем скопировать из архива)
        if media_src.exists():
            # Очистить текущую media для полного восстановления
            if media_root.exists():
                for item in media_root.iterdir():
                    if item.is_dir():
                        shutil.rmtree(item)
                    else:
                        item.unlink()
                log_lines.append('Media cleared before restore.')
            media_root.mkdir(parents=True, exist_ok=True)
            media_count = sum(1 for _ in media_src.rglob('*') if _.is_file())
            for item in media_src.iterdir():
                dest = media_root / item.name
                if item.is_dir():
                    shutil.copytree(item, dest)
                else:
                    shutil.copy2(item, dest)
            log_lines.append(f'Media restored: {media_count} files')
            logger.info('Media restored to %s', media_root)
        else:
            log_lines.append('No media directory in backup.')
            logger.warning('No media directory in backup')

    duration = round(time.time() - start_time, 1)
    log_lines.append(f'Duration: {duration}s')
    return {
        'log': '\n'.join(log_lines),
        'tables_count': tables_count,
        'media_count': media_count,
        'duration_seconds': duration,
    }


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
            result = restore_backup(archive_path)
            self.stdout.write(self.style.SUCCESS('Restore completed successfully.'))
            self.stdout.write(f'Tables restored: {result["tables_count"]}')
            self.stdout.write(f'Media restored: {result["media_count"]} files')
            self.stdout.write(f'Duration: {result["duration_seconds"]}s')
        except Exception as e:
            logger.exception('Restore failed: %s', e)
            self.stderr.write(self.style.ERROR(f'Restore failed: {e}'))
