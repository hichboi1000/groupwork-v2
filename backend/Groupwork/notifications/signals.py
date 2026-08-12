from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Notification


def _serialize(notification):
    # Mirrors api.serializers.NotificationSerializer's fields exactly, so
    # the frontend can treat a WebSocket push and a REST response the same.
    return {
        'id': notification.id,
        'notification_type': notification.notification_type,
        'title': notification.title,
        'message': notification.message,
        'is_read': notification.is_read,
        'task': notification.task_id,
        'group': notification.group_id,
        'created_at': notification.created_at.isoformat(),
    }


@receiver(post_save, sender=Notification)
def push_notification_over_websocket(sender, instance, created, **kwargs):
    if not created:
        return  # Only push brand-new notifications, not read-status edits

    channel_layer = get_channel_layer()
    if channel_layer is None:
        return

    group_name = f"user_{instance.recipient_id}_notifications"

    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            'type': 'notification_message',
            'payload': {
                'event': 'notification.new',
                'notification': _serialize(instance),
            },
        },
    )
