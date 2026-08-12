import json

from channels.generic.websocket import AsyncWebsocketConsumer


class NotificationConsumer(AsyncWebsocketConsumer):
    """
    One consumer instance per connected browser tab. Each user gets their
    own channel group (`user_<id>_notifications`) so the signal in
    signals.py can push straight to just that user, without any polling.
    """

    async def connect(self):
        user = self.scope.get("user")

        if not user or not user.is_authenticated:
            await self.close(code=4001)
            return

        self.group_name = f"user_{user.id}_notifications"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    # Called by channel_layer.group_send(..., {"type": "notification_message", ...})
    async def notification_message(self, event):
        await self.send(text_data=json.dumps(event["payload"]))
