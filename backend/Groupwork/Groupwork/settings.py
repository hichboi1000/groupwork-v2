import os
from datetime import timedelta
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# Loads backend/Groupwork/.env if present (see .env.example). Safe to call
# even if the file doesn't exist — os.environ just stays as-is and every
# os.environ.get(...) below falls back to its SQLite/dev default.
load_dotenv(BASE_DIR / '.env')

SECRET_KEY = os.environ.get(
    'SECRET_KEY',
    # Placeholder — fine for local dev, NEVER used if SECRET_KEY is set
    # in the environment. Generate a real one for anything public with:
    #   python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
    'django-insecure--$yvtmryuio+pbb&8zb&ywjkek)yv=$%d!7su(zw6!$xo&h0az'
)

# DEBUG defaults to True (matches every existing local setup) unless the
# environment explicitly turns it off.
DEBUG = os.environ.get('DEBUG', 'True') == 'True'

# Comma-separated in the environment, e.g. ALLOWED_HOSTS=api.example.com,example.com
# Falls back to '*' only for local dev.
_allowed_hosts_env = os.environ.get('ALLOWED_HOSTS', '')
ALLOWED_HOSTS = [h.strip() for h in _allowed_hosts_env.split(',') if h.strip()] or ['*']

# Refuse to boot with DEBUG=False and a wildcard/missing ALLOWED_HOSTS —
# that combination silently 400s every request in production. Fail loudly
# at startup instead of leaving a confusing "why is prod down" hunt.
if not DEBUG and ALLOWED_HOSTS == ['*']:
    raise RuntimeError(
        'DEBUG=False requires ALLOWED_HOSTS to be set explicitly '
        '(comma-separated list of your real domain(s)) — refusing to '
        'start with a wildcard host in production.'
    )

INSTALLED_APPS = [
    'daphne',  # must be listed first — this makes `runserver` serve ASGI/WebSockets automatically
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    'channels',
    'rest_framework',
    'corsheaders',

    'users',
    'classes',
    'groups',
    'assignments',
    'tasks',
    'notifications',
    'api',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'Groupwork.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'Groupwork.wsgi.application'
ASGI_APPLICATION = 'Groupwork.asgi.application'

# In-memory channel layer — zero extra infra, works great for dev and a
# single-process deployment. If you ever run multiple server processes
# (e.g. gunicorn/daphne with several workers, or multiple machines behind
# a load balancer), switch this to channels_redis so all processes share
# the same notification "bus":
#
#   pip install channels_redis
#   CHANNEL_LAYERS = {
#       'default': {
#           'BACKEND': 'channels_redis.core.RedisChannelLayer',
#           'CONFIG': {'hosts': [('127.0.0.1', 6379)]},
#       }
#   }
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels.layers.InMemoryChannelLayer',
    }
}

# SQLite only allows one writer at a time — fine for a single developer
# poking at the app, but it starts rejecting writes with "database is
# locked" under real concurrent traffic (multiple students submitting/
# updating tasks at once). Postgres is used whenever DB_ENGINE=postgres is
# set (e.g. in production); SQLite remains the zero-setup default for a
# single dev running things locally.
if os.environ.get('DB_ENGINE') == 'postgres':
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.environ.get('DB_NAME', 'groupwork'),
            'USER': os.environ.get('DB_USER', 'groupwork'),
            'PASSWORD': os.environ.get('DB_PASSWORD', ''),
            'HOST': os.environ.get('DB_HOST', 'localhost'),
            'PORT': os.environ.get('DB_PORT', '5432'),
            # Reuse connections across requests instead of opening a new
            # one every time — matters once you're running multiple
            # gunicorn/daphne worker processes under real load.
            'CONN_MAX_AGE': 60,
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Africa/Nairobi'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
AUTH_USER_MODEL = 'users.User'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    # General-purpose limits so a runaway frontend loop or a scripted
    # attacker can't tie up the (limited, see notes on ASGI concurrency)
    # request-handling capacity for everyone else. Login/register have
    # their own much stricter limits below since password hashing makes
    # them the most expensive requests in the app per-call.
    'DEFAULT_THROTTLE_CLASSES': (
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ),
    'DEFAULT_THROTTLE_RATES': {
        'anon': '30/min',
        'user': '120/min',
        'auth': '5/min',
    },
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=8),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
}

CORS_ALLOW_ALL_ORIGINS = os.environ.get('CORS_ALLOW_ALL_ORIGINS', 'True') == 'True'
CORS_ALLOW_CREDENTIALS = True

# Only consulted when CORS_ALLOW_ALL_ORIGINS is False. Comma-separated,
# e.g. CORS_ALLOWED_ORIGINS=https://app.example.com,https://www.example.com
if not CORS_ALLOW_ALL_ORIGINS:
    _cors_origins_env = os.environ.get('CORS_ALLOWED_ORIGINS', '')
    CORS_ALLOWED_ORIGINS = [o.strip() for o in _cors_origins_env.split(',') if o.strip()]
    if not CORS_ALLOWED_ORIGINS:
        raise RuntimeError(
            'CORS_ALLOW_ALL_ORIGINS=False requires CORS_ALLOWED_ORIGINS to be '
            'set (comma-separated list of your frontend origin(s)).'
        )

# HTTPS-only hardening once DEBUG=False — harmless no-op under plain
# http:// local dev since this block just never runs there.
if not DEBUG:
    SECURE_SSL_REDIRECT = os.environ.get('SECURE_SSL_REDIRECT', 'True') == 'True'
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = int(os.environ.get('SECURE_HSTS_SECONDS', '31536000'))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    # Needed behind most PaaS/proxy setups (Render, Railway, Fly, nginx)
    # so Django knows the original request was HTTPS even though the
    # proxy talks to it over plain HTTP internally.
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
