from .models import Notification


def notify_task_assigned(task):
    """Notify the member that a task was assigned to them."""
    Notification.objects.create(
        recipient=task.assigned_to,
        notification_type='task_assigned',
        title='New task assigned to you',
        message=f'"{task.title}" has been assigned to you by {task.created_by.get_full_name() or task.created_by.username}.',
        task=task,
        group=task.group,
    )


def notify_task_status_updated(task, updated_by):
    """Notify the group leader when a task status changes."""
    leader = task.group.leader
    if leader == updated_by:
        return  # Leader updated it themselves, no need to notify
    Notification.objects.create(
        recipient=leader,
        notification_type='task_updated',
        title='Task progress updated',
        message=f'{updated_by.get_full_name() or updated_by.username} marked "{task.title}" as {task.get_status_display()}.',
        task=task,
        group=task.group,
    )


def notify_member_joined(group, new_member):
    """Notify the group leader that someone joined."""
    Notification.objects.create(
        recipient=group.leader,
        notification_type='group_joined',
        title='New member joined your group',
        message=f'{new_member.get_full_name() or new_member.username} joined {group.name}.',
        group=group,
    )


def notify_assignment_posted(assignment, groups):
    """Notify all leaders in the class when a new assignment is posted."""
    for group in groups:
        Notification.objects.create(
            recipient=group.leader,
            notification_type='assignment_posted',
            title='New assignment posted',
            message=f'A new assignment "{assignment.title}" has been posted for {assignment.unit.name}. Deadline: {assignment.deadline.strftime("%d %b %Y")}.',
            group=group,
        )


def notify_ready_to_submit(group_assignment):
    """Notify the leader the moment every task on this assignment is done."""
    group = group_assignment.group
    assignment = group_assignment.assignment
    Notification.objects.create(
        recipient=group.leader,
        notification_type='ready_to_submit',
        title='All tasks done — ready to submit',
        message=f'Every task on "{assignment.title}" is done. Head to Assignments to submit for {group.name}.',
        group=group,
    )


def notify_group_assignment_linked(group_assignment):
    """Notify all group members when an assignment is linked to their group."""
    group = group_assignment.group
    assignment = group_assignment.assignment
    for member in group.members.all():
        Notification.objects.create(
            recipient=member,
            notification_type='group_assigned',
            title='Assignment linked to your group',
            message=f'Your group "{group.name}" has been assigned "{assignment.title}". Deadline: {assignment.deadline.strftime("%d %b %Y")}.',
            group=group,
        )


def notify_leadership_transferred(group, old_leader, new_leader):
    """Notify both users when group leadership is transferred."""

    old_name = old_leader.get_full_name() or old_leader.username
    new_name = new_leader.get_full_name() or new_leader.username

    # Notify the new leader
    Notification.objects.create(
        recipient=new_leader,
        notification_type='leadership_transferred',
        title='You are now the group leader',
        message=f'{old_name} transferred leadership of "{group.name}" to you.',
        group=group,
    )

    # Notify the previous leader
    Notification.objects.create(
        recipient=old_leader,
        notification_type='leadership_transferred',
        title='Leadership transferred',
        message=f'You transferred leadership of "{group.name}" to {new_name}.',
        group=group,
    ) 


def notify_rep_added(cls, new_rep, added_by):
    """Notify a user when they are added as a class representative."""

    added_by_name = added_by.get_full_name() or added_by.username

    Notification.objects.create(
        recipient=new_rep,
        notification_type='rep_added',
        title='You are now a class representative',
        message=f'{added_by_name} added you as a representative for {cls.name}.',
    )