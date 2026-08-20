"""
Tests for the leader/rep 'My Tasks' personal section: dashboard_stats
including personal numbers alongside the management numbers, ?scope=mine
on the tasks list, and that a leader/rep can update the status of a task
assigned to them personally — including the case where a rep is a plain
member of a group under a class they don't manage.

Run with: python manage.py test api.tests_personal_tasks
"""
from django.urls import reverse
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APITestCase

from users.models import User
from classes.models import Class
from groups.models import Group
from tasks.models import Task


class LeaderPersonalTasksTests(APITestCase):
    """A leader is also a participant in their own group, not just its
    manager — they should see what's on THEM specifically, separate from
    the whole group's task load."""

    def setUp(self):
        self.leader = User.objects.create_user(
            username='pt_leader', password='pass1234', role='leader',
            email='ptl@test.local')
        self.member = User.objects.create_user(
            username='pt_member', password='pass1234', role='student',
            email='ptm@test.local')
        self.group = Group.objects.create(
            name='Personal Tasks Group', code='PTGROUP', leader=self.leader)
        self.group.members.add(self.leader, self.member)

        self.my_task = Task.objects.create(
            title="Leader's own task", group=self.group, assigned_to=self.leader,
            created_by=self.leader, due_date=timezone.now() + timedelta(days=3))
        self.other_task = Task.objects.create(
            title='Someone else\'s task', group=self.group, assigned_to=self.member,
            created_by=self.leader, due_date=timezone.now() + timedelta(days=3))

    def test_dashboard_includes_both_group_wide_and_personal_numbers(self):
        self.client.force_authenticate(self.leader)
        resp = self.client.get(reverse('dashboard-stats'))
        self.assertEqual(resp.status_code, 200)
        data = resp.data

        # Group-wide (management) numbers unchanged — 2 tasks total in the group.
        self.assertEqual(data['tasks_total'], 2)
        # Personal numbers — just the leader's own 1 task.
        self.assertEqual(data['my_tasks_total'], 1)
        self.assertEqual(data['my_tasks_todo'], 1)
        self.assertEqual(data['my_next_task']['title'], "Leader's own task")

    def test_scope_mine_on_tasks_list_returns_only_the_leaders_own_task(self):
        self.client.force_authenticate(self.leader)
        # Default (unscoped) — leader sees the whole group's tasks.
        default_resp = self.client.get(reverse('tasks'))
        self.assertEqual(len(default_resp.data), 2)

        # scope=mine — leader sees only their own.
        mine_resp = self.client.get(reverse('tasks'), {'scope': 'mine'})
        self.assertEqual(len(mine_resp.data), 1)
        self.assertEqual(mine_resp.data[0]['title'], "Leader's own task")

    def test_leader_can_mark_their_own_task_done(self):
        self.client.force_authenticate(self.leader)
        resp = self.client.patch(
            reverse('task-detail', args=[self.my_task.id]),
            {'status': 'done', 'submission_text': 'Finished it'}, format='json')
        self.assertEqual(resp.status_code, 200, resp.data)
        self.my_task.refresh_from_db()
        self.assertEqual(self.my_task.status, 'done')

    def test_leader_can_still_retitle_their_own_task(self):
        """Leaders keep full management power over ANY task in their
        group, including one assigned to themselves — they don't lose
        editing rights just because they self-assigned it. The
        status/evidence-only restriction is for plain members (students,
        or a rep/lecturer who happens to just be a member elsewhere),
        not for the group's actual manager."""
        self.client.force_authenticate(self.leader)
        resp = self.client.patch(
            reverse('task-detail', args=[self.my_task.id]),
            {'status': 'progress', 'title': 'Renamed by leader'}, format='json')
        self.assertEqual(resp.status_code, 200, resp.data)
        self.my_task.refresh_from_db()
        self.assertEqual(self.my_task.status, 'progress')
        self.assertEqual(self.my_task.title, 'Renamed by leader')

    def test_leader_can_still_fully_edit_a_teammates_task(self):
        """Confirms the fix didn't take away the leader's actual
        management powers over tasks that aren't their own."""
        self.client.force_authenticate(self.leader)
        resp = self.client.patch(
            reverse('task-detail', args=[self.other_task.id]),
            {'title': 'Retitled by leader'}, format='json')
        self.assertEqual(resp.status_code, 200, resp.data)
        self.other_task.refresh_from_db()
        self.assertEqual(self.other_task.title, 'Retitled by leader')


class RepPersonalTasksTests(APITestCase):
    """A rep can also be an ordinary member of someone else's group —
    including one under a class they don't manage. Their own task there
    must still be visible/updatable, without granting them any of the
    class-management powers that group's actual leader/rep have."""

    def setUp(self):
        self.rep = User.objects.create_user(
            username='pt_rep', password='pass1234', role='rep',
            email='ptr@test.local')
        self.managed_class = Class.objects.create(
            name='Class The Rep Manages', program='BBIT', stage='2.1',
            cohort_year=2025, code='REPMANAGED', created_by=self.rep)
        self.managed_class.reps.add(self.rep)

        # A totally separate class/group the rep does NOT manage, but
        # personally joined as a plain member.
        other_rep = User.objects.create_user(
            username='other_rep', password='pass1234', role='rep',
            email='or@test.local')
        self.unmanaged_class = Class.objects.create(
            name='Class The Rep Does Not Manage', program='BBIT', stage='2.2',
            cohort_year=2025, code='NOTMANAGED', created_by=other_rep)
        self.unmanaged_class.reps.add(other_rep)

        leader = User.objects.create_user(
            username='pt_rep_leader', password='pass1234', role='leader',
            email='ptrl@test.local')
        self.group = Group.objects.create(
            name="Rep's Personal Group", code='REPGROUP', leader=leader,
            class_field=self.unmanaged_class)
        self.group.members.add(leader, self.rep)

        self.my_task = Task.objects.create(
            title="Rep's own task", group=self.group, assigned_to=self.rep,
            created_by=leader, due_date=timezone.now() + timedelta(days=2))

    def test_dashboard_shows_reps_personal_group_and_tasks_when_theyve_joined_one(self):
        self.client.force_authenticate(self.rep)
        resp = self.client.get(reverse('dashboard-stats'))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['group_name'], "Rep's Personal Group")
        self.assertEqual(resp.data['my_tasks_total'], 1)
        self.assertEqual(resp.data['my_next_task']['title'], "Rep's own task")

    def test_dashboard_shows_no_group_for_a_rep_who_hasnt_joined_one(self):
        lone_rep = User.objects.create_user(
            username='lone_rep', password='pass1234', role='rep',
            email='lr@test.local')
        lone_class = Class.objects.create(
            name='Lone Class', program='BBIT', stage='3.1', cohort_year=2025,
            code='LONECLS', created_by=lone_rep)
        lone_class.reps.add(lone_rep)

        self.client.force_authenticate(lone_rep)
        resp = self.client.get(reverse('dashboard-stats'))
        self.assertIsNone(resp.data['group_name'])
        self.assertEqual(resp.data['my_tasks_total'], 0)
        self.assertIsNone(resp.data['my_next_task'])

    def test_rep_working_own_task_as_a_plain_member_cannot_smuggle_in_a_retitle(self):
        """The rep here is NOT this group's leader — just an ordinary
        member, same as a student would be. They can update their own
        task's status/evidence, but not rename or reassign it — that
        stays the group leader's call."""
        self.client.force_authenticate(self.rep)
        resp = self.client.patch(
            reverse('task-detail', args=[self.my_task.id]),
            {'status': 'progress', 'title': 'Sneaky rename'}, format='json')
        self.assertEqual(resp.status_code, 200, resp.data)
        self.my_task.refresh_from_db()
        self.assertEqual(self.my_task.status, 'progress')
        self.assertEqual(self.my_task.title, "Rep's own task")  # unchanged

    def test_rep_can_access_and_update_own_task_in_a_class_they_dont_manage(self):
        """This is the exact gap: without the fix, task_detail's rep
        check only allowed access to tasks in classes the rep MANAGES —
        it had no concept of 'this task happens to be assigned to me'."""
        self.client.force_authenticate(self.rep)
        get_resp = self.client.get(reverse('task-detail', args=[self.my_task.id]))
        self.assertEqual(get_resp.status_code, 200, get_resp.data)

        patch_resp = self.client.patch(
            reverse('task-detail', args=[self.my_task.id]),
            {'status': 'done', 'submission_text': 'Done'}, format='json')
        self.assertEqual(patch_resp.status_code, 200, patch_resp.data)
        self.my_task.refresh_from_db()
        self.assertEqual(self.my_task.status, 'done')

    def test_rep_still_cannot_touch_tasks_in_unrelated_classes_that_arent_theirs(self):
        """Confirms the own-task bypass didn't accidentally widen rep
        oversight access — this is someone ELSE's task, in a class the
        rep neither manages nor personally belongs to."""
        unrelated_student = User.objects.create_user(
            username='unrelated_student', password='pass1234', role='student',
            email='us@test.local')
        self.group.members.add(unrelated_student)
        unrelated_task = Task.objects.create(
            title="Someone else's task", group=self.group,
            assigned_to=unrelated_student, created_by=self.group.leader)

        self.client.force_authenticate(self.rep)
        resp = self.client.get(reverse('task-detail', args=[unrelated_task.id]))
        self.assertEqual(resp.status_code, 403)

    def test_scope_mine_works_for_rep_too(self):
        self.client.force_authenticate(self.rep)
        resp = self.client.get(reverse('tasks'), {'scope': 'mine'})
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]['title'], "Rep's own task")

    def test_rep_can_join_a_group_end_to_end_through_the_ui_facing_flow(self):
        """
        This is the actual new capability being surfaced: previously
        nothing in the nav pointed a rep at /groups, so in practice reps
        never joined one even though the backend never blocked it. This
        walks the exact join_group -> my_group -> dashboard_stats path
        the new Sidebar/QuickActions links now put a rep through.
        """
        fresh_rep = User.objects.create_user(
            username='fresh_rep', password='pass1234', role='rep',
            email='fr@test.local')
        fresh_class = Class.objects.create(
            name='Fresh Class', program='BBIT', stage='1.1', cohort_year=2026,
            code='FRESHCLS', created_by=fresh_rep)
        fresh_class.reps.add(fresh_rep)

        self.client.force_authenticate(fresh_rep)

        # Before joining: dashboard shows no personal group/tasks.
        before = self.client.get(reverse('dashboard-stats'))
        self.assertIsNone(before.data['group_name'])

        join_resp = self.client.post(
            reverse('join-group'), {'code': self.group.code}, format='json')
        self.assertEqual(join_resp.status_code, 200, join_resp.data)

        mine_resp = self.client.get(reverse('my-group'))
        self.assertEqual(mine_resp.status_code, 200)
        self.assertEqual(mine_resp.data['name'], self.group.name)

        after = self.client.get(reverse('dashboard-stats'))
        self.assertEqual(after.data['group_name'], self.group.name)
        self.assertEqual(after.data['my_tasks_total'], 0)  # joined, no tasks assigned yet
