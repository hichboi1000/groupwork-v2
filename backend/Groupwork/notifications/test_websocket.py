"""
End-to-end tests for the notifications WebSocket: auth handshake, live
push on Notification creation, and per-user isolation.

Run with: python manage.py test notifications.test_websocket
"""
from channels.testing import WebsocketCommunicator
from channels.routing import URLRouter
from channels.db import database_sync_to_async
from django.test import TransactionTestCase
from rest_framework_simplejwt.tokens import RefreshToken

from notifications.jwt_auth_middleware import JWTAuthMiddlewareStack
from notifications.routing import websocket_urlpatterns
from notifications.models import Notification
from users.models import User


def ws_app():
    return JWTAuthMiddlewareStack(URLRouter(websocket_urlpatterns))


class NotificationWebsocketTests(TransactionTestCase):

    def setUp(self):
        self.alice = User.objects.create_user(
            username='ws_alice', password='pass1234', role='student', email='wsa@test.local')
        self.bob = User.objects.create_user(
            username='ws_bob', password='pass1234', role='student', email='wsb@test.local')

    @database_sync_to_async
    def _token(self, user):
        return str(RefreshToken.for_user(user).access_token)

    @database_sync_to_async
    def _create_notification(self, user, message):
        return Notification.objects.create(
            recipient=user, notification_type='task_assigned', title='Test', message=message)

    async def test_rejects_connection_with_no_token(self):
        communicator = WebsocketCommunicator(ws_app(), "/ws/notifications/")
        connected, _ = await communicator.connect()
        self.assertFalse(connected)
        await communicator.disconnect()

    async def test_rejects_connection_with_garbage_token(self):
        communicator = WebsocketCommunicator(ws_app(), "/ws/notifications/?token=not-a-real-token")
        connected, _ = await communicator.connect()
        self.assertFalse(connected)
        await communicator.disconnect()

    async def test_accepts_connection_with_valid_token(self):
        token = await self._token(self.alice)
        communicator = WebsocketCommunicator(ws_app(), f"/ws/notifications/?token={token}")
        connected, _ = await communicator.connect()
        self.assertTrue(connected)
        await communicator.disconnect()

    async def test_notification_created_in_db_is_pushed_live_to_the_right_socket(self):
        alice_token = await self._token(self.alice)
        bob_token = await self._token(self.bob)

        alice_ws = WebsocketCommunicator(ws_app(), f"/ws/notifications/?token={alice_token}")
        bob_ws = WebsocketCommunicator(ws_app(), f"/ws/notifications/?token={bob_token}")
        await alice_ws.connect()
        await bob_ws.connect()

        await self._create_notification(self.alice, "Only Alice should see this")

        event = await alice_ws.receive_json_from(timeout=5)
        self.assertEqual(event['event'], 'notification.new')
        self.assertIn("Only Alice", event['notification']['message'])

        self.assertTrue(await bob_ws.receive_nothing(timeout=1))

        await alice_ws.disconnect()
        await bob_ws.disconnect()

    async def test_two_tabs_same_user_both_receive_the_push(self):
        token = await self._token(self.alice)
        tab1 = WebsocketCommunicator(ws_app(), f"/ws/notifications/?token={token}")
        tab2 = WebsocketCommunicator(ws_app(), f"/ws/notifications/?token={token}")
        await tab1.connect()
        await tab2.connect()

        await self._create_notification(self.alice, "Multi-tab push")

        e1 = await tab1.receive_json_from(timeout=5)
        e2 = await tab2.receive_json_from(timeout=5)
        self.assertIn("Multi-tab", e1['notification']['message'])
        self.assertIn("Multi-tab", e2['notification']['message'])

        await tab1.disconnect()
        await tab2.disconnect()
