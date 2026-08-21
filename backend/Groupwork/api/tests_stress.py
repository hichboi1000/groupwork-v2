"""
Stress / concurrency / edge-case tests — separate from tests.py (which
covers authorization scoping) because these need TransactionTestCase
(real committed transactions visible across threads) instead of the
fast rollback-per-test TestCase the rest of the suite uses.

Run with: python manage.py test api.tests_stress
"""
import threading
import time

from django.db import connections
from django.test import TransactionTestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from users.models import User
from classes.models import Class
from groups.models import Group
from notifications.models import Notification


def auth_client(user):
    client = APIClient()
    token = RefreshToken.for_user(user).access_token
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
    return client


def run_concurrently(fns):
    """Runs each callable in its own thread with its own DB connection
    (Django connections aren't thread-safe), lined up on a barrier to
    maximize overlap. Returns results in the same order as fns."""
    results = [None] * len(fns)
    barrier = threading.Barrier(len(fns))

    def wrapper(i, fn):
        try:
            barrier.wait(timeout=5)
            results[i] = fn()
        finally:
            connections.close_all()

    threads = [threading.Thread(target=wrapper, args=(i, fn)) for i, fn in enumerate(fns)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=10)
    return results


class ConcurrentGroupJoinTests(TransactionTestCase):
    """'One student, one group' was enforced with a plain
    .exists()-then-write check — a TOCTOU race. Two concurrent requests
    can both pass the check before either commits."""

    def setUp(self):
        self.rep = User.objects.create_user(
            username='rep_s', password='pass1234', role='rep', email='rep_s@test.local')
        self.cls = Class.objects.create(
            name='Race Class', program='BBIT', stage='2.1', cohort_year=2025,
            code='RACECLS', created_by=self.rep)
        self.cls.reps.add(self.rep)

        self.leader_a = User.objects.create_user(
            username='leader_a', password='pass1234', role='leader', email='la@test.local')
        self.leader_b = User.objects.create_user(
            username='leader_b', password='pass1234', role='leader', email='lb@test.local')
        self.student = User.objects.create_user(
            username='racer', password='pass1234', role='student', email='racer@test.local')

        self.group_a = Group.objects.create(
            name='Group A', code='GROUPA', leader=self.leader_a, class_field=self.cls)
        self.group_a.members.add(self.leader_a)
        self.group_b = Group.objects.create(
            name='Group B', code='GROUPB', leader=self.leader_b, class_field=self.cls)
        self.group_b.members.add(self.leader_b)

    def test_same_student_cannot_end_up_in_two_groups_at_once(self):
        url = reverse('join-group')

        def join_a():
            return auth_client(self.student).post(url, {'code': 'GROUPA'}, format='json').status_code

        def join_b():
            return auth_client(self.student).post(url, {'code': 'GROUPB'}, format='json').status_code

        statuses = run_concurrently([join_a, join_b])
        memberships = Group.objects.filter(members=self.student).count()
        self.assertEqual(memberships, 1, f"Student ended up in {memberships} groups (statuses: {statuses}).")

    def test_two_leaders_double_submitting_create_group_only_makes_one_group(self):
        new_leader = User.objects.create_user(
            username='dblclick', password='pass1234', role='leader', email='dbl@test.local')
        url = reverse('create-group')

        def create():
            return auth_client(new_leader).post(url, {'name': 'Double Click Group'}, format='json').status_code

        run_concurrently([create, create])
        led = Group.objects.filter(leader=new_leader).count()
        self.assertEqual(led, 1, f"Double-submitting Create Group produced {led} groups.")


class ConcurrentNotificationTests(TransactionTestCase):
    """Many members interacting at once shouldn't cross-wire notifications."""

    def setUp(self):
        self.rep = User.objects.create_user(
            username='rep_n', password='pass1234', role='rep', email='rn@test.local')
        self.cls = Class.objects.create(
            name='Notif Class', program='BBIT', stage='2.1', cohort_year=2025,
            code='NOTIFCLS', created_by=self.rep)
        self.cls.reps.add(self.rep)
        self.leader = User.objects.create_user(
            username='notif_leader', password='pass1234', role='leader', email='nl@test.local')
        self.group = Group.objects.create(
            name='Notif Group', code='NOTIFGRP', leader=self.leader, class_field=self.cls)
        self.group.members.add(self.leader)

        self.students = []
        for i in range(8):
            s = User.objects.create_user(
                username=f'nstudent{i}', password='pass1234', role='student', email=f'ns{i}@test.local')
            self.group.members.add(s)
            self.students.append(s)

    def test_many_students_joining_leaving_at_once_stays_consistent(self):
        leave_url = reverse('leave-group')
        fns = [lambda s=s: auth_client(s).delete(leave_url).status_code for s in self.students]
        statuses = run_concurrently(fns)
        self.assertTrue(all(s == 200 for s in statuses), statuses)
        self.group.refresh_from_db()
        self.assertEqual(self.group.members.count(), 1)  # just the leader left

    def test_notifications_dont_cross_wire_between_recipients(self):
        for s in self.students:
            Notification.objects.create(
                recipient=s, notification_type='task_assigned', message=f'Task for {s.username}')

        def fetch(student):
            resp = auth_client(student).get(reverse('notifications'))
            return (student.username, resp.status_code, resp.data)

        fns = [lambda s=s: fetch(s) for s in self.students]
        results = run_concurrently(fns)
        for username, status_code, data in results:
            self.assertEqual(status_code, 200)
            items = data['results'] if isinstance(data, dict) and 'results' in data else data
            for n in items:
                self.assertIn(username, n['message'], f"{username} saw someone else's notification: {n['message']}")


class RoleHandoverTests(TransactionTestCase):
    """Leadership transfer and rep handover, end-to-end, including a race
    on double-transferring leadership."""

    def setUp(self):
        self.rep = User.objects.create_user(
            username='rep_h', password='pass1234', role='rep', email='rh@test.local')
        self.cls = Class.objects.create(
            name='Handover Class', program='BBIT', stage='2.1', cohort_year=2025,
            code='HANDCLS', created_by=self.rep)
        self.cls.reps.add(self.rep)

        self.leader = User.objects.create_user(
            username='out_leader', password='pass1234', role='leader', email='ol@test.local')
        self.group = Group.objects.create(
            name='Handover Group', code='HANDGRP', leader=self.leader, class_field=self.cls)
        self.group.members.add(self.leader)

        self.member = User.objects.create_user(
            username='rising_star', password='pass1234', role='student', email='rs@test.local')
        self.group.members.add(self.member)

        self.outsider = User.objects.create_user(
            username='not_in_group', password='pass1234', role='student', email='nig@test.local')

    def test_leader_can_transfer_leadership_to_existing_member(self):
        resp = auth_client(self.leader).post(
            reverse('transfer-leadership'), {'new_leader_id': self.member.id}, format='json')
        self.assertEqual(resp.status_code, 200, resp.data)

        self.group.refresh_from_db(); self.member.refresh_from_db(); self.leader.refresh_from_db()
        self.assertEqual(self.group.leader_id, self.member.id)
        self.assertEqual(self.member.role, 'leader')
        self.assertEqual(self.leader.role, 'student')
        self.assertTrue(Notification.objects.filter(
            recipient=self.member, notification_type='leadership_transferred').exists())

    def test_old_leader_can_then_leave_normally(self):
        auth_client(self.leader).post(
            reverse('transfer-leadership'), {'new_leader_id': self.member.id}, format='json')
        leave_resp = auth_client(self.leader).delete(reverse('leave-group'))
        self.assertEqual(leave_resp.status_code, 200, leave_resp.data)

    def test_non_leader_cannot_transfer_leadership(self):
        resp = auth_client(self.member).post(
            reverse('transfer-leadership'), {'new_leader_id': self.leader.id}, format='json')
        self.assertEqual(resp.status_code, 403)

    def test_cannot_transfer_to_someone_outside_the_group(self):
        resp = auth_client(self.leader).post(
            reverse('transfer-leadership'), {'new_leader_id': self.outsider.id}, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_concurrent_double_transfer_only_one_wins_cleanly(self):
        second_member = User.objects.create_user(
            username='second_member', password='pass1234', role='student', email='sm@test.local')
        self.group.members.add(second_member)
        url = reverse('transfer-leadership')

        def transfer_to_a():
            return auth_client(self.leader).post(url, {'new_leader_id': self.member.id}, format='json').status_code

        def transfer_to_b():
            return auth_client(self.leader).post(url, {'new_leader_id': second_member.id}, format='json').status_code

        statuses = run_concurrently([transfer_to_a, transfer_to_b])
        self.group.refresh_from_db()
        self.assertIn(self.group.leader_id, [self.member.id, second_member.id])
        self.assertEqual(sorted(statuses), [200, 403])

    def test_rep_can_promote_a_classmate_who_is_not_yet_a_rep(self):
        resp = auth_client(self.rep).post(
            reverse('add-rep-to-class', args=[self.cls.id]), {'user_id': self.member.id}, format='json')
        self.assertEqual(resp.status_code, 200, resp.data)
        self.member.refresh_from_db()
        self.assertEqual(self.member.role, 'rep')

    def test_outgoing_rep_can_step_down_after_handover(self):
        auth_client(self.rep).post(
            reverse('add-rep-to-class', args=[self.cls.id]), {'user_id': self.member.id}, format='json')
        resp = auth_client(self.rep).post(
            reverse('remove-rep-from-class', args=[self.cls.id]), {'user_id': self.rep.id}, format='json')
        self.assertEqual(resp.status_code, 200, resp.data)
        self.rep.refresh_from_db()
        self.assertEqual(self.rep.role, 'student')

    def test_cannot_remove_the_last_rep(self):
        resp = auth_client(self.rep).post(
            reverse('remove-rep-from-class', args=[self.cls.id]), {'user_id': self.rep.id}, format='json')
        self.assertEqual(resp.status_code, 400)


class LoadSimulationTests(TransactionTestCase):
    """A rougher approximation of many students using this at once."""

    def setUp(self):
        self.rep = User.objects.create_user(
            username='rep_load', password='pass1234', role='rep', email='rl@test.local')
        self.cls = Class.objects.create(
            name='Load Class', program='BBIT', stage='2.1', cohort_year=2025,
            code='LOADCLS', created_by=self.rep)
        self.cls.reps.add(self.rep)

        self.groups, self.all_students = [], []
        for g in range(5):
            leader = User.objects.create_user(
                username=f'load_leader{g}', password='pass1234', role='leader', email=f'll{g}@test.local')
            group = Group.objects.create(
                name=f'Load Group {g}', code=f'LOADGRP{g}', leader=leader, class_field=self.cls)
            group.members.add(leader)
            self.groups.append(group)
            self.all_students.append(leader)
            for i in range(5):
                s = User.objects.create_user(
                    username=f'load_s{g}_{i}', password='pass1234', role='student', email=f'ls{g}_{i}@test.local')
                group.members.add(s)
                self.all_students.append(s)

    def test_thirty_students_hitting_dashboard_and_notifications_at_once(self):
        def hit_endpoints(student):
            c = auth_client(student)
            return (student.username, [
                c.get(reverse('my-group')).status_code,
                c.get(reverse('tasks')).status_code,
                c.get(reverse('notifications')).status_code,
            ])

        fns = [lambda s=s: hit_endpoints(s) for s in self.all_students]
        start = time.time()
        results = run_concurrently(fns)
        elapsed = time.time() - start

        failures = [(u, r) for u, r in results if any(code >= 500 for code in r)]
        self.assertEqual(failures, [], f"Server errors under load: {failures}")
        self.assertLess(elapsed, 30, f"30 concurrent users took {elapsed:.1f}s — check for accidental serialization.")

    def test_many_groups_creating_tasks_concurrently_dont_cross_contaminate(self):
        url = reverse('tasks')

        def create_task(group):
            leader = group.leader
            member = group.members.exclude(id=leader.id).first()
            return auth_client(leader).post(url, {
                'title': f'Load task for {group.name}', 'assigned_to': member.id, 'group': group.id,
            }, format='json').status_code

        fns = [lambda g=g: create_task(g) for g in self.groups]
        statuses = run_concurrently(fns)
        self.assertTrue(all(s == 201 for s in statuses), statuses)

        from tasks.models import Task
        for group in self.groups:
            self.assertEqual(Task.objects.filter(group=group, title=f'Load task for {group.name}').count(), 1)
        self.assertEqual(Task.objects.count(), len(self.groups))
