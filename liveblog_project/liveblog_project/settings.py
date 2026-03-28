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

# .env: repo root (../.env) then app dir (./.env); latter overrides for server layouts
try:
    from dotenv import load_dotenv

    for _env_path in (BASE_DIR.parent / '.env', BASE_DIR / '.env'):
        if _env_path.is_file():
            load_dotenv(_env_path, override=True)
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
    raise ValueError(
        'Set DJANGO_ALLOWED_HOSTS (comma-separated hostnames, e.g. '
        '"example.com,www.example.com") for production.'
    )

_csrf_origins = os.environ.get('DJANGO_CSRF_TRUSTED_ORIGINS', '').strip()
CSRF_TRUSTED_ORIGINS = [
    o.strip() for o in _csrf_origins.split(',') if o.strip()
]

if not DEBUG:
    if not CSRF_TRUSTED_ORIGINS:
        raise ValueError(
            'Set DJANGO_CSRF_TRUSTED_ORIGINS for production (comma-separated full URLs), '
            'e.g. https://example.com,https://www.example.com — required behind HTTPS / nginx.'
        )

    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    USE_X_FORWARDED_HOST = True
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

# Session / cookies (public site)
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = os.environ.get('SESSION_COOKIE_SAMESITE', 'Lax')
SESSION_COOKIE_AGE = int(os.environ.get('SESSION_COOKIE_AGE', str(60 * 60 * 24 * 14)))  # 14 days
SESSION_SAVE_EVERY_REQUEST = os.environ.get('SESSION_SAVE_EVERY_REQUEST', '').lower() in (
    '1',
    'true',
    'yes',
)

# django-ratelimit: use default cache (Redis in prod when REDIS_URL set)
RATELIMIT_USE_CACHE = os.environ.get('RATELIMIT_USE_CACHE', 'default')
RATELIMIT_LOGIN_RATE = os.environ.get('RATELIMIT_LOGIN_RATE', '5/15m')
# security_middleware reads DJANGO_SECURITY_CSP / DJANGO_SECURITY_CSP_REPORT_ONLY.
RATELIMIT_REGISTER_RATE = os.environ.get('RATELIMIT_REGISTER_RATE', '5/h')
RATELIMIT_SEARCH_RATE = os.environ.get('RATELIMIT_SEARCH_RATE', '60/m')
RATELIMIT_TRENDING_RATE = os.environ.get('RATELIMIT_TRENDING_RATE', '120/m')
RATELIMIT_ITEM_COUNTERS_RATE = os.environ.get('RATELIMIT_ITEM_COUNTERS_RATE', '90/m')
RATELIMIT_SEARCH_HISTORY_RATE = os.environ.get('RATELIMIT_SEARCH_HISTORY_RATE', '120/m')
RATELIMIT_REPORT_POST_RATE = os.environ.get('RATELIMIT_REPORT_POST_RATE', '40/m')

SECURITY_HEADERS_ENABLED = os.environ.get('DJANGO_SECURITY_HEADERS', 'true').lower() in (
    '1',
    'true',
    'yes',
    '',
)

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
    'pages.apps.PagesConfig',
    'backups',
]


MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'liveblog_project.security_middleware.SecurityHeadersMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'liveblog_project.security_middleware.AdminAuditMiddleware',
    'login.middleware.UserOnlineMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# Manifest storage fails collectstatic if any referenced file (e.g. *.js.map) is missing.
if os.environ.get('DJANGO_MANIFEST_STATICFILES', 'true').lower() in ('1', 'true', 'yes'):
    STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'
else:
    STATICFILES_STORAGE = 'whitenoise.storage.CompressedStaticFilesStorage'

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


# Database — PostgreSQL in production; SQLite only for explicit local dev (never in prod)
_use_sqlite = os.environ.get('DJANGO_USE_SQLITE', '').lower() in ('1', 'true', 'yes')
if _use_sqlite:
    if not DEBUG:
        raise ValueError(
            'DJANGO_USE_SQLITE is only valid with DJANGO_DEBUG=true. '
            'Use PostgreSQL on the server.'
        )
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }
else:
    _db_user = os.environ.get('DJANGO_DB_USER') or os.environ.get('USER', 'postgres')
    _db_password = os.environ.get('DJANGO_DB_PASSWORD', '')
    if not _db_password:
        raise ValueError(
            'DJANGO_DB_PASSWORD is not set. Set PostgreSQL credentials in the environment, '
            'or for local dev without Postgres set DJANGO_DEBUG=true and DJANGO_USE_SQLITE=true.'
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
            'CONN_MAX_AGE': int(os.environ.get('DJANGO_DB_CONN_MAX_AGE', '60')),
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
        import django_redis  # noqa: F401  # type: ignore[import-untyped]

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
        'django.security': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'security.admin': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}

