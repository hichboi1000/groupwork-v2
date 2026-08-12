"""
Backend tests for the core logic that actually matters for this app:
who can see/touch what across the four roles, and whether the
auto-status/notification/file-access logic behaves the way the UI
assumes it does.

Run with: python manage.py test api
"""
import io
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APITestCase
from rest_framework import status

from users.models import User
from classes.models import Class
from groups.models import Group
from tasks.models import Task
from assignments.models import Unit, Assignment, UnitOffering, GroupAssignment, Submission
from notifications.models import Notification


class ScopedFixtureMixin:
    """
    Builds two fully parallel, non-overlapping worlds — everything with a
    '1' belongs to lecturer1/rep1/class1/unit1/group1, everything with a
    '2' to the other. Every cross-boundary test just tries to reach across
    from one world into the other and asserts it's blocked.
    """

    def setUp(self):
        # --- World 1 ---
        self.lecturer1 = User.objects.create_user(
            username='lecturer1', password='pass1234', role='lecturer',
            email='lecturer1@test.local', first_name='Lec', last_name='One')
        self.rep1 = User.objects.create_user(
            username='rep1', password='pass1234', role='rep',
            email='rep1@test.local', first_name='Rep', last_name='One')
        self.leader1 = User.objects.create_user(
            username='leader1', password='pass1234', role='leader',
            email='leader1@test.local', first_name='Leader', last_name='One')
        self.student1 = User.objects.create_user(
            username='student1', password='pass1234', role='student',
            email='student1@test.local', first_name='Student', last_name='One')

        self.unit1 = Unit.objects.create(name='Unit One', code='U1CODE', created_by=self.lecturer1)
        self.unit1.lecturers.add(self.lecturer1)

        self.class1 = Class.objects.create(
            name='Class One', program='BBIT', stage='2.1', cohort_year=2024,
            code='C1CODE', created_by=self.rep1)
        self.class1.reps.add(self.rep1)

        self.offering1 = UnitOffering.objects.create(
            unit=self.unit1, class_field=self.class1, attached_by=self.rep1)

        self.group1 = Group.objects.create(
            name='Group One', code='G1CODE', leader=self.leader1, class_field=self.class1)
        self.group1.members.add(self.leader1, self.student1)

        self.assignment1 = Assignment.objects.create(
            title='Assignment One', description='desc', unit=self.unit1,
            deadline=timezone.now() + timedelta(days=7), created_by=self.lecturer1)

        self.ga1 = GroupAssignment.objects.create(
            offering=self.offering1, group=self.group1, assignment=self.assignment1)

        self.task1 = Task.objects.create(
            title='Task One', group=self.group1, assigned_to=self.student1,
            assignment=self.assignment1, created_by=self.leader1)

        # --- World 2 (fully separate) ---
        self.lecturer2 = User.objects.create_user(
            username='lecturer2', password='pass1234', role='lecturer',
            email='lecturer2@test.local', first_name='Lec', last_name='Two')
        self.rep2 = User.objects.create_user(
            username='rep2', password='pass1234', role='rep',
            email='rep2@test.local', first_name='Rep', last_name='Two')
        self.leader2 = User.objects.create_user(
            username='leader2', password='pass1234', role='leader',
            email='leader2@test.local', first_name='Leader', last_name='Two')
        self.student2 = User.objects.create_user(
            username='student2', password='pass1234', role='student',
            email='student2@test.local', first_name='Student', last_name='Two')

        self.unit2 = Unit.objects.create(name='Unit Two', code='U2CODE', created_by=self.lecturer2)
        self.unit2.lecturers.add(self.lecturer2)

        self.class2 = Class.objects.create(
            name='Class Two', program='BBIT', stage='2.1', cohort_year=2025,
            code='C2CODE', created_by=self.rep2)
        self.class2.reps.add(self.rep2)

        self.offering2 = UnitOffering.objects.create(
            unit=self.unit2, class_field=self.class2, attached_by=self.rep2)

        self.group2 = Group.objects.create(
            name='Group Two', code='G2CODE', leader=self.leader2, class_field=self.class2)
        self.group2.members.add(self.leader2, self.student2)

        self.assignment2 = Assignment.objects.create(
            title='Assignment Two', description='desc', unit=self.unit2,
            deadline=timezone.now() + timedelta(days=7), created_by=self.lecturer2)

        self.ga2 = GroupAssignment.objects.create(
            offering=self.offering2, group=self.group2, assignment=self.assignment2)

        self.task2 = Task.objects.create(
            title='Task Two', group=self.group2, assigned_to=self.student2,
            assignment=self.assignment2, created_by=self.leader2)


# ─── TASK ACCESS SCOPING ────────────────────────────────────────────────────

class TaskAccessScopingTests(ScopedFixtureMixin, APITestCase):

    def test_student_cannot_view_another_students_task(self):
        self.client.force_authenticate(self.student2)
        r = self.client.get(reverse('task-detail', args=[self.task1.id]))
        self.assertEqual(r.status_code, 403)

    def test_student_can_view_own_task(self):
        self.client.force_authenticate(self.student1)
        r = self.client.get(reverse('task-detail', args=[self.task1.id]))
        self.assertEqual(r.status_code, 200)

    def test_leader_cannot_view_another_groups_task(self):
        self.client.force_authenticate(self.leader2)
        r = self.client.get(reverse('task-detail', args=[self.task1.id]))
        self.assertEqual(r.status_code, 403)

    def test_leader_can_view_own_groups_task(self):
        self.client.force_authenticate(self.leader1)
        r = self.client.get(reverse('task-detail', args=[self.task1.id]))
        self.assertEqual(r.status_code, 200)

    def test_rep_cannot_view_task_in_unrelated_class(self):
        self.client.force_authenticate(self.rep2)
        r = self.client.get(reverse('task-detail', args=[self.task1.id]))
        self.assertEqual(r.status_code, 403)

    def test_rep_can_view_task_in_own_class(self):
        self.client.force_authenticate(self.rep1)
        r = self.client.get(reverse('task-detail', args=[self.task1.id]))
        self.assertEqual(r.status_code, 200)

    def test_lecturer_cannot_view_task_in_unit_they_dont_teach(self):
        self.client.force_authenticate(self.lecturer2)
        r = self.client.get(reverse('task-detail', args=[self.task1.id]))
        self.assertEqual(r.status_code, 403)

    def test_lecturer_can_view_task_in_own_unit(self):
        self.client.force_authenticate(self.lecturer1)
        r = self.client.get(reverse('task-detail', args=[self.task1.id]))
        self.assertEqual(r.status_code, 200)

    def test_leader_cannot_reassign_task_to_another_group(self):
        """A leader shouldn't be able to PATCH a task's `group` field to
        move it into a group they don't lead, or reassign it to a user
        who isn't a member of the (real) group."""
        self.client.force_authenticate(self.leader1)
        r = self.client.patch(
            reverse('task-detail', args=[self.task1.id]),
            {'group': self.group2.id}, format='json',
        )
        self.task1.refresh_from_db()
        self.assertEqual(self.task1.group_id, self.group1.id)

    def test_leader_cannot_assign_task_to_non_member(self):
        self.client.force_authenticate(self.leader1)
        r = self.client.patch(
            reverse('task-detail', args=[self.task1.id]),
            {'assigned_to': self.student2.id}, format='json',
        )
        self.assertIn(r.status_code, (400, 403))
        self.task1.refresh_from_db()
        self.assertEqual(self.task1.assigned_to_id, self.student1.id)

    def test_task_list_scoping_student_only_sees_own_tasks(self):
        self.client.force_authenticate(self.student1)
        r = self.client.get(reverse('tasks'))
        ids = [t['id'] for t in r.data]
        self.assertIn(self.task1.id, ids)
        self.assertNotIn(self.task2.id, ids)


# ─── SUBMISSION / EVIDENCE FILE ACCESS ──────────────────────────────────────

class FileAccessTests(ScopedFixtureMixin, APITestCase):

    def _attach_evidence(self, task):
        task.submission_file = SimpleUploadedFile('evidence.txt', b'proof of work')
        task.status = 'done'
        task.save()

    def test_unrelated_student_cannot_download_task_evidence(self):
        self._attach_evidence(self.task1)
        self.client.force_authenticate(self.student2)
        r = self.client.get(reverse('task-evidence-download', args=[self.task1.id]))
        self.assertEqual(r.status_code, 403)

    def test_own_group_member_can_download_task_evidence(self):
        self._attach_evidence(self.task1)
        self.client.force_authenticate(self.leader1)
        r = self.client.get(reverse('task-evidence-download', args=[self.task1.id]))
        self.assertEqual(r.status_code, 200)

    def test_unrelated_lecturer_cannot_download_task_evidence(self):
        self._attach_evidence(self.task1)
        self.client.force_authenticate(self.lecturer2)
        r = self.client.get(reverse('task-evidence-download', args=[self.task1.id]))
        self.assertEqual(r.status_code, 403)

    def test_owning_lecturer_can_download_task_evidence(self):
        self._attach_evidence(self.task1)
        self.client.force_authenticate(self.lecturer1)
        r = self.client.get(reverse('task-evidence-download', args=[self.task1.id]))
        self.assertEqual(r.status_code, 200)

    def test_unrelated_rep_cannot_download_submission_file(self):
        submission = Submission.objects.create(
            assignment=self.assignment1, group=self.group1, submitted_by=self.leader1,
            file=SimpleUploadedFile('work.txt', b'final work'))
        self.client.force_authenticate(self.rep2)
        r = self.client.get(reverse('submission-download', args=[submission.id]))
        self.assertEqual(r.status_code, 403)

    def test_owning_group_member_can_download_submission_file(self):
        submission = Submission.objects.create(
            assignment=self.assignment1, group=self.group1, submitted_by=self.leader1,
            file=SimpleUploadedFile('work.txt', b'final work'))
        self.client.force_authenticate(self.student1)
        r = self.client.get(reverse('submission-download', args=[submission.id]))
        self.assertEqual(r.status_code, 200)

    def test_download_requires_authentication(self):
        self._attach_evidence(self.task1)
        self.client.force_authenticate(None)
        r = self.client.get(reverse('task-evidence-download', args=[self.task1.id]))
        self.assertIn(r.status_code, (401, 403))


# ─── AUTO STATUS / READY-TO-SUBMIT / NOTIFICATIONS ─────────────────────────

class AutoStatusTransitionTests(ScopedFixtureMixin, APITestCase):

    def test_status_moves_to_in_progress_when_first_task_starts(self):
        self.client.force_authenticate(self.student1)
        self.client.patch(reverse('task-detail', args=[self.task1.id]), {'status': 'progress'}, format='json')
        self.ga1.refresh_from_db()
        self.assertEqual(self.ga1.status, 'in_progress')

    def test_status_moves_to_ready_to_submit_when_all_tasks_done(self):
        self.client.force_authenticate(self.student1)
        self.client.patch(
            reverse('task-detail', args=[self.task1.id]),
            {'status': 'done', 'submission_text': 'done, see attached'}, format='json',
        )
        self.ga1.refresh_from_db()
        self.assertEqual(self.ga1.status, 'ready_to_submit')

    def test_leader_notified_exactly_once_when_ready_to_submit(self):
        self.client.force_authenticate(self.student1)
        # flip to progress, then to done — should only notify on the actual
        # transition INTO ready_to_submit, not on every save.
        self.client.patch(reverse('task-detail', args=[self.task1.id]), {'status': 'progress'}, format='json')
        self.client.patch(
            reverse('task-detail', args=[self.task1.id]),
            {'status': 'done', 'submission_text': 'done'}, format='json',
        )
        notifications = Notification.objects.filter(
            recipient=self.leader1, notification_type='ready_to_submit')
        self.assertEqual(notifications.count(), 1)

    def test_status_does_not_regress_after_submission(self):
        """Once submitted, editing/adding tasks shouldn't silently pull the
        GroupAssignment status backwards."""
        self.ga1.status = 'submitted'
        self.ga1.save()
        self.client.force_authenticate(self.student1)
        self.client.patch(
            reverse('task-detail', args=[self.task1.id]),
            {'status': 'todo'}, format='json',
        )
        self.ga1.refresh_from_db()
        self.assertEqual(self.ga1.status, 'submitted')

    def test_task_assignment_notification_goes_only_to_assignee(self):
        self.client.force_authenticate(self.leader1)
        self.client.post(reverse('tasks'), {
            'title': 'Second task', 'group': self.group1.id,
            'assigned_to': self.student1.id, 'assignment': self.assignment1.id,
        }, format='json')
        self.assertTrue(
            Notification.objects.filter(recipient=self.student1, notification_type='task_assigned').exists())
        # the OTHER group's members should never see this
        self.assertFalse(
            Notification.objects.filter(recipient=self.student2, notification_type='task_assigned').exists())


# ─── SUBMISSION REVIEW FLOW ─────────────────────────────────────────────────

class ReviewFlowTests(ScopedFixtureMixin, APITestCase):

    def test_student_cannot_mark_reviewed(self):
        self.ga1.status = 'submitted'
        self.ga1.save()
        self.client.force_authenticate(self.student1)
        r = self.client.patch(reverse('group-assignment-review', args=[self.ga1.id]))
        self.assertEqual(r.status_code, 403)

    def test_leader_cannot_mark_reviewed(self):
        self.ga1.status = 'submitted'
        self.ga1.save()
        self.client.force_authenticate(self.leader1)
        r = self.client.patch(reverse('group-assignment-review', args=[self.ga1.id]))
        self.assertEqual(r.status_code, 403)

    def test_unrelated_lecturer_cannot_mark_reviewed(self):
        self.ga1.status = 'submitted'
        self.ga1.save()
        self.client.force_authenticate(self.lecturer2)
        r = self.client.patch(reverse('group-assignment-review', args=[self.ga1.id]))
        self.assertEqual(r.status_code, 403)

    def test_owning_lecturer_can_mark_reviewed(self):
        self.ga1.status = 'submitted'
        self.ga1.save()
        self.client.force_authenticate(self.lecturer1)
        r = self.client.patch(reverse('group-assignment-review', args=[self.ga1.id]))
        self.assertEqual(r.status_code, 200)
        self.ga1.refresh_from_db()
        self.assertEqual(self.ga1.status, 'reviewed')

    def test_cannot_review_before_submission(self):
        # ga1 defaults to 'pending' in the fixture
        self.client.force_authenticate(self.lecturer1)
        r = self.client.patch(reverse('group-assignment-review', args=[self.ga1.id]))
        self.assertEqual(r.status_code, 400)


# ─── GROUP MEMBERSHIP RULES ─────────────────────────────────────────────────

class GroupMembershipTests(ScopedFixtureMixin, APITestCase):

    def test_cannot_join_two_groups(self):
        self.client.force_authenticate(self.student1)  # already in group1
        r = self.client.post(reverse('join-group'), {'code': self.group2.code}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_cannot_join_with_invalid_code(self):
        new_student = User.objects.create_user(username='freestudent', password='pass1234', role='student', email='freestudent@test.local')
        self.client.force_authenticate(new_student)
        r = self.client.post(reverse('join-group'), {'code': 'NOTREAL'}, format='json')
        self.assertEqual(r.status_code, 404)

    def test_leader_role_cannot_join_a_group(self):
        new_leader = User.objects.create_user(username='freeleader', password='pass1234', role='leader', email='freeleader@test.local')
        self.client.force_authenticate(new_leader)
        r = self.client.post(reverse('join-group'), {'code': self.group1.code}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_leader_cannot_create_a_second_group(self):
        self.client.force_authenticate(self.leader1)  # already leads group1
        r = self.client.post(reverse('create-group'), {'name': 'Rogue Group'}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_student_cannot_create_a_group_at_all(self):
        """Only leaders can create groups — a student hitting this
        endpoint should be rejected for role, before any other check."""
        self.client.force_authenticate(self.student1)
        r = self.client.post(reverse('create-group'), {'name': 'Rogue Group'}, format='json')
        self.assertEqual(r.status_code, 403)


# ─── GROUP PROGRESS SCOPING ──────────────────────────────────────────────────

class GroupProgressScopingTests(ScopedFixtureMixin, APITestCase):

    def test_student_cannot_view_group_progress(self):
        self.client.force_authenticate(self.student1)
        r = self.client.get(reverse('group-progress'))
        self.assertEqual(r.status_code, 403)

    def test_leader_sees_own_group_progress(self):
        self.client.force_authenticate(self.leader1)
        r = self.client.get(reverse('group-progress'))
        self.assertEqual(r.status_code, 200)

    def test_lecturer_cannot_view_progress_for_unrelated_group(self):
        self.client.force_authenticate(self.lecturer2)
        r = self.client.get(reverse('group-progress'), {'group_id': self.group1.id})
        # Scoped queryset means an out-of-scope group_id 404s rather than
        # 403s — that's fine, it doesn't even confirm the group exists.
        self.assertEqual(r.status_code, 404)

    def test_lecturer_can_view_progress_for_own_units_group(self):
        self.client.force_authenticate(self.lecturer1)
        r = self.client.get(reverse('group-progress'), {'group_id': self.group1.id})
        self.assertEqual(r.status_code, 200)


# ─── VALIDATION: DEADLINES ───────────────────────────────────────────────────

class DeadlineValidationTests(ScopedFixtureMixin, APITestCase):

    def test_cannot_create_assignment_with_past_deadline(self):
        self.client.force_authenticate(self.lecturer1)
        r = self.client.post(reverse('assignments'), {
            'title': 'Late Assignment', 'description': 'x', 'unit': self.unit1.id,
            'deadline': (timezone.now() - timedelta(days=1)).isoformat(),
        }, format='json')
        self.assertEqual(r.status_code, 400)

    def test_can_create_assignment_with_future_deadline(self):
        self.client.force_authenticate(self.lecturer1)
        r = self.client.post(reverse('assignments'), {
            'title': 'On Time Assignment', 'description': 'x', 'unit': self.unit1.id,
            'deadline': (timezone.now() + timedelta(days=3)).isoformat(),
        }, format='json')
        self.assertEqual(r.status_code, 201)

    def test_cannot_submit_after_deadline_passed(self):
        self.assignment1.deadline = timezone.now() - timedelta(hours=1)
        self.assignment1.save()
        self.client.force_authenticate(self.leader1)
        r = self.client.post(reverse('submissions'), {
            'assignment': self.assignment1.id, 'content': 'late work',
        }, format='json')
        self.assertEqual(r.status_code, 400)

    def test_can_submit_before_deadline(self):
        self.client.force_authenticate(self.leader1)
        r = self.client.post(reverse('submissions'), {
            'assignment': self.assignment1.id, 'content': 'on-time work',
        }, format='json')
        self.assertEqual(r.status_code, 201)

    def test_leader_cannot_submit_on_behalf_of_another_group(self):
        """The 'group' field must always resolve to the leader's own
        group — a leader should never be able to submit work under a
        group they don't lead, even by passing a different group id."""
        self.client.force_authenticate(self.leader1)
        r = self.client.post(reverse('submissions'), {
            'assignment': self.assignment1.id, 'group': self.group2.id, 'content': 'sneaky',
        }, format='json')
        # Either rejected outright, or silently forced onto their own
        # group — either way it must never land on group2.
        if r.status_code == 201:
            self.assertEqual(r.data['group'], self.group1.id)
        else:
            self.assertEqual(r.status_code, 400)

    def test_cannot_submit_for_assignment_not_linked_to_group(self):
        # assignment2 belongs to a different world entirely and was never
        # linked to group1 via a GroupAssignment.
        self.client.force_authenticate(self.leader1)
        r = self.client.post(reverse('submissions'), {
            'assignment': self.assignment2.id, 'content': 'wrong assignment',
        }, format='json')
        self.assertEqual(r.status_code, 400)


# ─── VALIDATION: FILE UPLOADS ────────────────────────────────────────────────

class FileUploadValidationTests(ScopedFixtureMixin, APITestCase):

    def test_oversized_task_evidence_rejected(self):
        big_file = SimpleUploadedFile('huge.pdf', b'x' * (16 * 1024 * 1024))  # 16MB > 15MB limit
        self.client.force_authenticate(self.student1)
        r = self.client.patch(
            reverse('task-detail', args=[self.task1.id]),
            {'status': 'done', 'submission_file': big_file}, format='multipart',
        )
        self.assertEqual(r.status_code, 400)

    def test_disallowed_extension_rejected(self):
        bad_file = SimpleUploadedFile('script.exe', b'not a real exe')
        self.client.force_authenticate(self.student1)
        r = self.client.patch(
            reverse('task-detail', args=[self.task1.id]),
            {'status': 'done', 'submission_file': bad_file}, format='multipart',
        )
        self.assertEqual(r.status_code, 400)

    def test_valid_file_accepted(self):
        good_file = SimpleUploadedFile('proof.pdf', b'a small valid pdf')
        self.client.force_authenticate(self.student1)
        r = self.client.patch(
            reverse('task-detail', args=[self.task1.id]),
            {'status': 'done', 'submission_file': good_file}, format='multipart',
        )
        self.assertEqual(r.status_code, 200)


# ─── ASSIGNMENT MANAGEMENT SCOPING ───────────────────────────────────────────

class AssignmentScopingTests(ScopedFixtureMixin, APITestCase):

    def test_rep_cannot_edit_assignment_for_unrelated_unit(self):
        self.client.force_authenticate(self.rep2)
        r = self.client.patch(
            reverse('assignment-detail', args=[self.assignment1.id]),
            {'title': 'Hijacked'}, format='json',
        )
        self.assertEqual(r.status_code, 403)

    def test_rep_can_edit_assignment_for_own_class_unit(self):
        self.client.force_authenticate(self.rep1)
        r = self.client.patch(
            reverse('assignment-detail', args=[self.assignment1.id]),
            {'title': 'Updated title'}, format='json',
        )
        self.assertEqual(r.status_code, 200)

    def test_rep_cannot_delete_assignment_for_unrelated_unit(self):
        self.client.force_authenticate(self.rep2)
        r = self.client.delete(reverse('assignment-detail', args=[self.assignment1.id]))
        self.assertEqual(r.status_code, 403)
        self.assertTrue(Assignment.objects.filter(id=self.assignment1.id).exists())


# ─── INTERNAL GROUP FILES (collaboration, separate from Submission) ────────

class GroupFileTests(ScopedFixtureMixin, APITestCase):

    def test_group_member_can_upload_file(self):
        self.client.force_authenticate(self.student1)
        r = self.client.post(reverse('group-files'), {
            'file': SimpleUploadedFile('notes.txt', b'shared draft notes'),
            'description': 'Draft notes',
        }, format='multipart')
        self.assertEqual(r.status_code, 201)

    def test_uploaded_group_file_only_visible_to_own_group(self):
        self.client.force_authenticate(self.leader1)
        self.client.post(reverse('group-files'), {
            'file': SimpleUploadedFile('draft.txt', b'internal draft'),
        }, format='multipart')

        # own group sees it
        r1 = self.client.get(reverse('group-files'))
        self.assertEqual(len(r1.data), 1)

        # a member of a completely different group sees nothing
        self.client.force_authenticate(self.student2)
        r2 = self.client.get(reverse('group-files'))
        self.assertEqual(len(r2.data), 0)

    def test_unrelated_group_member_cannot_download(self):
        self.client.force_authenticate(self.leader1)
        upload = self.client.post(reverse('group-files'), {
            'file': SimpleUploadedFile('draft.txt', b'internal draft'),
        }, format='multipart')
        file_id = upload.data['id']

        self.client.force_authenticate(self.student2)
        r = self.client.get(reverse('group-file-download', args=[file_id]))
        self.assertEqual(r.status_code, 403)

    def test_own_group_member_can_download(self):
        self.client.force_authenticate(self.leader1)
        upload = self.client.post(reverse('group-files'), {
            'file': SimpleUploadedFile('draft.txt', b'internal draft'),
        }, format='multipart')
        file_id = upload.data['id']

        self.client.force_authenticate(self.student1)  # different member, same group
        r = self.client.get(reverse('group-file-download', args=[file_id]))
        self.assertEqual(r.status_code, 200)

    def test_lecturer_cannot_access_internal_group_files(self):
        """Internal really means internal — even the group's own
        lecturer/rep has no access path to these, unlike Submission."""
        self.client.force_authenticate(self.leader1)
        upload = self.client.post(reverse('group-files'), {
            'file': SimpleUploadedFile('draft.txt', b'internal draft'),
        }, format='multipart')
        file_id = upload.data['id']

        self.client.force_authenticate(self.lecturer1)  # teaches this exact unit
        r = self.client.get(reverse('group-file-download', args=[file_id]))
        self.assertEqual(r.status_code, 403)

    def test_uploader_can_delete_own_file(self):
        self.client.force_authenticate(self.student1)
        upload = self.client.post(reverse('group-files'), {
            'file': SimpleUploadedFile('draft.txt', b'internal draft'),
        }, format='multipart')
        r = self.client.delete(reverse('group-file-detail', args=[upload.data['id']]))
        self.assertEqual(r.status_code, 204)

    def test_leader_can_delete_any_member_file(self):
        self.client.force_authenticate(self.student1)
        upload = self.client.post(reverse('group-files'), {
            'file': SimpleUploadedFile('draft.txt', b'internal draft'),
        }, format='multipart')

        self.client.force_authenticate(self.leader1)
        r = self.client.delete(reverse('group-file-detail', args=[upload.data['id']]))
        self.assertEqual(r.status_code, 204)

    def test_non_uploader_non_leader_cannot_delete(self):
        self.client.force_authenticate(self.leader1)
        upload = self.client.post(reverse('group-files'), {
            'file': SimpleUploadedFile('draft.txt', b'internal draft'),
        }, format='multipart')

        self.client.force_authenticate(self.student1)  # same group, didn't upload it, not leader
        r = self.client.delete(reverse('group-file-detail', args=[upload.data['id']]))
        self.assertEqual(r.status_code, 403)

    def test_oversized_group_file_rejected(self):
        self.client.force_authenticate(self.student1)
        r = self.client.post(reverse('group-files'), {
            'file': SimpleUploadedFile('huge.zip', b'x' * (16 * 1024 * 1024)),
        }, format='multipart')
        self.assertEqual(r.status_code, 400)
