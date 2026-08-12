import os

from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Groupwork.settings')

# Must come after django.setup() (triggered by get_asgi_application) so
# app models are ready before notifications.routing imports consumers.
django_asgi_app = get_asgi_application()

from notifications.jwt_auth_middleware import JWTAuthMiddlewareStack  # noqa: E402
from notifications.routing import websocket_urlpatterns  # noqa: E402

application = ProtocolTypeRouter({
    'http': django_asgi_app,
    'websocket': JWTAuthMiddlewareStack(
        URLRouter(websocket_urlpatterns)
    ),
})
