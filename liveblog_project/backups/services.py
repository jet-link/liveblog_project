"""
Сервис создания backup: pg_dump + media в tar.gz.
Выполняется асинхронно в отдельном потоке.
"""
import logging
import os
import shutil
import subprocess
import tarfile
import tempfile
import threading
from pathlib import Path

from django.conf import settings
from django.utils import timezone

logger = logging.getLogger('backups')


BACKUPS_ROOT = getattr(settings, 'BACKUPS_ROOT', None) or (Path(settings.BASE_DIR) / 'backups')
MAX_BACKUPS = getattr(settings, 'BACKUP_MAX_COUNT', 20)
BACKUP_DAILY_COUNT = getattr(settings, 'BACKUP_DAILY_COUNT', 7)
BACKUP_WEEKLY_COUNT = getattr(settings, 'BACKUP_WEEKLY_COUNT', 4)
BACKUP_MONTHLY_COUNT = getattr(settings, 'BACKUP_MONTHLY_COUNT', 12)


def _ensure_backups_dir():
    """Создаёт директорию backups если её нет."""
    BACKUPS_ROOT.mkdir(parents=True, exist_ok=True)


def _run_pg_dump(db_settings, output_path):
    """Выполняет pg_dump и сохраняет в output_path."""
    env = os.environ.copy()
    env['PGPASSWORD'] = db_settings.get('PASSWORD', '')
    cmd = [
        'pg_dump',
        '-h', db_settings.get('HOST', 'localhost'),
        '-p', str(db_settings.get('PORT', '5432')),
        '-U', db_settings.get('USER', 'postgres'),
        '-d', db_settings.get('NAME', ''),
        '-F', 'p',  # plain SQL
        '-f', str(output_path),
        '--no-owner',
        '--no-acl',
        '--clean',  # add DROP statements for restore
    ]
    result = subprocess.run(cmd, env=env, capture_output=True, text=True, timeout=3600)
    if result.returncode != 0:
        raise RuntimeError(f'pg_dump failed: {result.stderr or result.stdout}')


def _create_backup_archive(backup_obj):
    """
    Создаёт backup: database.sql + media/ в tar.gz.
    Обновляет backup_obj по ходу выполнения.
    """
    from backups.models import Backup

    backup_obj.status = Backup.STATUS_RUNNING
    backup_obj.save(update_fields=['status'])

    tmpdir = None
    try:
        tmpdir = Path(tempfile.mkdtemp())
        db_sql = tmpdir / 'database.sql'
        media_dest = tmpdir / 'media'

        # 1. pg_dump
        db_settings = settings.DATABASES['default']
        _run_pg_dump(db_settings, db_sql)
        logger.info('Database dump created: %s', db_sql)

        # 2. Копируем media
        media_root = Path(settings.MEDIA_ROOT)
        if media_root.exists():
            shutil.copytree(media_root, media_dest, dirs_exist_ok=True)
            logger.info('Media copied to %s', media_dest)
        else:
            media_dest.mkdir(parents=True, exist_ok=True)

        # 3. Создаём tar.gz
        _ensure_backups_dir()
        timestamp = timezone.now().strftime('%Y%m%d_%H%M%S')
        schedule = getattr(backup_obj, 'schedule_type', 'manual')
        suffix = f'_{schedule}' if schedule != 'manual' else ''
        archive_name = f'backup{suffix}_{timestamp}.tar.gz'
        archive_path = BACKUPS_ROOT / archive_name

        with tarfile.open(archive_path, 'w:gz') as tar:
            tar.add(tmpdir, arcname='backup')
        logger.info('Archive created: %s', archive_path)

        # 4. Обновляем модель
        file_size = archive_path.stat().st_size
        backup_obj.status = Backup.STATUS_COMPLETED
        backup_obj.file_path = str(archive_path)
        backup_obj.file_size = file_size
        backup_obj.error_message = ''
        backup_obj.save(update_fields=['status', 'file_path', 'file_size', 'error_message'])

        logger.info('Backup completed: %s, size: %s', backup_obj.name, backup_obj.file_size_human)

        # 5. Очистка старых backup (по лимитам для каждого типа)
        _cleanup_old_backups(backup_obj.schedule_type)

    except Exception as e:
        logger.exception('Backup failed: %s', e)
        backup_obj.status = Backup.STATUS_FAILED
        backup_obj.error_message = str(e)[:500]
        backup_obj.save(update_fields=['status', 'error_message'])
    finally:
        if tmpdir and tmpdir.exists():
            shutil.rmtree(tmpdir, ignore_errors=True)


def _cleanup_old_backups(schedule_type=None, exclude_pk=None):
    """Удаляет самые старые backup по лимитам: daily=7, weekly=4, monthly=12, manual=20."""
    from backups.models import Backup

    limits = {
        Backup.SCHEDULE_DAILY: BACKUP_DAILY_COUNT,
        Backup.SCHEDULE_WEEKLY: BACKUP_WEEKLY_COUNT,
        Backup.SCHEDULE_MONTHLY: BACKUP_MONTHLY_COUNT,
        Backup.SCHEDULE_MANUAL: MAX_BACKUPS,
    }
    st = schedule_type or Backup.SCHEDULE_MANUAL
    limit = limits.get(st, MAX_BACKUPS)
    qs = Backup.objects.filter(
        status=Backup.STATUS_COMPLETED,
        schedule_type=st,
    ).order_by('created_at')
    if exclude_pk:
        qs = qs.exclude(pk=exclude_pk)
    count = qs.count()
    if count > limit:
        to_remove = list(qs[: count - limit])
    else:
        to_remove = []
    for b in to_remove:
        if b.file_path and Path(b.file_path).exists():
            try:
                Path(b.file_path).unlink()
                logger.info('Old backup file deleted: %s', b.file_path)
            except OSError as e:
                logger.warning('Could not delete backup file %s: %s', b.file_path, e)
        b.delete()
        logger.info('Old backup record deleted: %s', b.name)


def create_backup_scheduled(schedule='manual', user=None):
    """
    Создаёт backup по расписанию (daily/weekly/monthly) или вручную.
    Запускается асинхронно в отдельном потоке.
    """
    from backups.models import Backup

    suffix = f' ({schedule})' if schedule != Backup.SCHEDULE_MANUAL else ''
    backup = Backup.objects.create(
        name=f'Backup {timezone.now().strftime("%Y-%m-%d %H:%M:%S")}{suffix}',
        schedule_type=schedule,
        status=Backup.STATUS_PENDING,
        created_by=user,
    )
    logger.info('Backup created (pending): %s by %s', backup.name, user)
    thread = threading.Thread(target=_create_backup_archive, args=(backup,))
    thread.daemon = True
    thread.start()
    return backup


def create_backup_async(user=None):
    """
    Создаёт backup асинхронно в отдельном потоке (ручное создание из админки).
    Возвращает созданный объект Backup.
    """
    return create_backup_scheduled(schedule='manual', user=user)


