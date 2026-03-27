from pathlib import Path
import os
from django.contrib.messages import constants as messages


MESSAGE_TAGS = {
    messages.ERROR: 'danger',
    messages.WARNING: 'warning',
    messages.SUCCESS: 'success',
    messages.INFO: 'info',
}

BASE_DIR = Path(__file__).resolve().parent.parent

# Load .env if python-dotenv is installed (optional)
try:
    from dotenv import load_dotenv
    load_dotenv(BASE_DIR.parent / '.env')
except ImportError:
    pass

# SECURITY
DEBUG = os.environ.get('DJANGO_DEBUG', 'False').lower() in ('1', 'true', 'yes')

SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', '').strip()
if not SECRET_KEY:
    if DEBUG:
        SECRET_KEY = 'django-insecure-dev-only-not-for-production'
    else:
        raise ValueError(
            'Set DJANGO_SECRET_KEY in the environment for production deployments.'
        )

_allowed_raw = os.environ.get('DJANGO_ALLOWED_HOSTS', '').strip()
if _allowed_raw:
    ALLOWED_HOSTS = [h.strip() for h in _allowed_raw.split(',') if h.strip()]
elif DEBUG:
    ALLOWED_HOSTS = ['127.0.0.1', 'localhost']
else:
    ALLOWED_HOSTS = []
    raise ValueError(
        'Set DJANGO_ALLOWED_HOSTS (comma-separated hostnames, e.g. '
        '"example.com,www.example.com") for production.'
    )

_csrf_origins = os.environ.get('DJANGO_CSRF_TRUSTED_ORIGINS', '').strip()
CSRF_TRUSTED_ORIGINS = [
    o.strip() for o in _csrf_origins.split(',') if o.strip()
]

if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    _ssl_redirect = os.environ.get('DJANGO_SECURE_SSL_REDIRECT', 'true').lower()
    SECURE_SSL_REDIRECT = _ssl_redirect in ('1', 'true', 'yes')
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = 'DENY'
    SECURE_HSTS_SECONDS = int(os.environ.get('SECURE_HSTS_SECONDS', '31536000'))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = os.environ.get('SECURE_HSTS_PRELOAD', 'false').lower() in ('1', 'true', 'yes')

# Applications
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.sites',
    'django.contrib.sitemaps',
    # Third-party
    'rest_framework',
    # Local apps
    'admin_panel',
    'smart_blog.apps.SmartBlogConfig',
    'login',
    'pages',
    'backups',
]


MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'login.middleware.UserOnlineMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

ROOT_URLCONF = 'liveblog_project.urls'

# Templates
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / "admin_panel" / "templates", BASE_DIR / "templates"],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
                'login.context_processors.user_obj_context',
                'smart_blog.context_processors.notifications_context',
                'smart_blog.context_processors.spellcheck_context',
                'smart_blog.context_processors.nav_categories_context',
                'admin_panel.context_processors.admin_online_count',
            ],
        },
    },
]


WSGI_APPLICATION = 'liveblog_project.wsgi.application'


# Database — PostgreSQL only
_db_user = os.environ.get('DJANGO_DB_USER') or os.environ.get('USER', 'postgres')
_db_password = os.environ.get('DJANGO_DB_PASSWORD', '')
if not _db_password:
    raise ValueError(
        'DJANGO_DB_PASSWORD is not set. This is the PostgreSQL user password, '
        'NOT your Mac login. Set it in .env or: export DJANGO_DB_PASSWORD="your_postgres_password"'
    )
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('DJANGO_DB_NAME', 'liveblog'),
        'USER': _db_user,
        'PASSWORD': _db_password,
        'HOST': os.environ.get('DJANGO_DB_HOST', 'localhost'),
        'PORT': os.environ.get('DJANGO_DB_PORT', '5432'),
        'OPTIONS': {'connect_timeout': 10},
    }
}


# Password validators
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]


# Localization
LANGUAGE_CODE = 'en'
TIME_ZONE = 'Asia/Tashkent'  # or 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'

STATICFILES_DIRS = [
    BASE_DIR / "static",
    BASE_DIR / "admin_panel" / "static",
]

STATIC_ROOT = BASE_DIR / "staticfiles"


# Media files
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / "media"

# Backups (outside media/static, not publicly accessible)
# Archive files directory (not the backups app package)
BACKUPS_ROOT = BASE_DIR / "backup_archives"
BACKUP_MAX_COUNT = 20
BACKUP_DAILY_COUNT = 7
BACKUP_WEEKLY_COUNT = 4
BACKUP_MONTHLY_COUNT = 12

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# django.contrib.sites — canonical domain for sitemap absolute URLs (update Site in admin after deploy)
SITE_ID = 1

# Cache (LocMem for dev; set REDIS_URL + django-redis for production)
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'liveblog-default',
    }
}
_redis_cache_url = os.environ.get('REDIS_URL') or os.environ.get('DJANGO_CACHE_REDIS_URL')
if _redis_cache_url:
    try:
        import django_redis  # noqa: F401

        CACHES = {
            'default': {
                'BACKEND': 'django_redis.cache.RedisCache',
                'LOCATION': _redis_cache_url,
                'OPTIONS': {
                    'CLIENT_CLASS': 'django_redis.client.DefaultClient',
                },
            }
        }
    except ImportError:
        pass

# Celery (broker Redis by default; requires celery package)
CELERY_BROKER_URL = os.environ.get('CELERY_BROKER_URL', 'redis://127.0.0.1:6379/0')
CELERY_RESULT_BACKEND = os.environ.get('CELERY_RESULT_BACKEND', CELERY_BROKER_URL)
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE

try:
    from datetime import timedelta

    from celery.schedules import crontab

    CELERY_BEAT_SCHEDULE = {
        'update-trending': {
            'task': 'smart_blog.tasks.update_trending',
            'schedule': timedelta(minutes=12),
        },
        'rollup-hourly-stats': {
            'task': 'smart_blog.tasks.rollup_hourly_stats',
            'schedule': crontab(minute=7),
        },
    }
except ImportError:
    CELERY_BEAT_SCHEDULE = {}

# Trending JSON cache TTL (seconds); 300–600 matches “5–10 min” refresh window
TRENDING_API_CACHE_SECONDS = int(os.environ.get("TRENDING_API_CACHE_SECONDS", "420"))

# Admin panel login redirect
LOGIN_URL = '/profile/login/'

# Spellcheck language (ru/en) - used by spellcheck.js via data-spellcheck-lang
SPELLCHECK_LANG = os.environ.get('SPELLCHECK_LANG', 'en')

# Logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'loggers': {
        'backups': {
            'handlers': ['console'],
            'level': 'INFO',
        },
    },
}

