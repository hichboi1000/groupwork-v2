import random
import string

from django.shortcuts import get_object_or_404
from django.http import FileResponse, Http404
from django.utils import timezone
from django.db.models import Q

from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from users.models import User
from classes.models import Class
from groups.models import Group, GroupFile
from tasks.models import Task
from assignments.models import Unit, Assignment, UnitOffering, GroupAssignment, Submission
from notifications.models import Notification
from notifications.utils import (
    notify_task_assigned,
    notify_task_status_updated,
    notify_member_joined,
    notify_group_assignment_linked,
)

from .serializers import (
    UserSerializer, UserMiniSerializer,
    ClassSerializer,
    GroupSerializer, JoinGroupSerializer,
    UnitSerializer, CreateUnitSerializer,
    UnitOfferingSerializer, AttachClassSerializer,
    AssignmentSerializer,
    GroupAssignmentSerializer, SubmissionSerializer,
    GroupFileSerializer,
    TaskSerializer, NotificationSerializer,
)
from .permissions import IsLecturer, IsLeader, IsRep, IsLecturerOrRep, IsLeaderOrLecturer


# ─── HELPERS ──────────────────────────────────────────────────────────────────

# Below this similarity score (0-1), a name typed against an existing unit
# code is considered different enough to warrant a confirmation prompt
# rather than a silent co-lecturer join. See DESIGN_DECISIONS.md section 6.
UNIT_NAME_SIMILARITY_THRESHOLD = 0.45


def generate_group_code():
    while True:
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        if not Group.objects.filter(code=code).exists():
            return code


def generate_class_code():
    while True:
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        if not Class.objects.filter(code=code).exists():
            return code


def get_user_group(user):
    """Return the user's current group or None."""
    return Group.objects.filter(members=user).first()


def get_user_classes(user):
    """Classes this rep manages. Empty for everyone else."""
    if user.role != 'rep':
        return Class.objects.none()
    return Class.objects.filter(reps=user)


def get_lecturer_units(user):
    """
    Units this lecturer actually teaches. This is the scoping boundary —
    a lecturer's role grants the ABILITY to manage units/assignments,
    but this query decides WHICH ones they can see and touch.
    """
    return Unit.objects.filter(lecturers=user)


def get_rep_units(user):
    """
    Units reachable through any class this rep manages — traced through
    that class's active UnitOfferings, not a direct FK. A rep managing
    multiple classes can see units across all of them.
    """
    classes = get_user_classes(user)
    return Unit.objects.filter(offerings__class_field__in=classes).distinct()


def get_visible_units(user):
    """Single entry point: which units can this user see, based on their role."""
    if user.role == 'lecturer':
        return get_lecturer_units(user)
    if user.role == 'rep':
        return get_rep_units(user)
    return Unit.objects.none()


def get_visible_offerings(user):
    """
    UnitOfferings this user can act on. Lecturers see offerings of units
    they teach; reps see offerings of classes they manage. This is the
    real scoping boundary for assignment/submission data, since that data
    hangs off the offering, not the unit directly.
    """
    if user.role == 'lecturer':
        return UnitOffering.objects.filter(unit__in=get_lecturer_units(user))
    if user.role == 'rep':
        return UnitOffering.objects.filter(class_field__in=get_user_classes(user))
    return UnitOffering.objects.none()


# ─── AUTH / USERS ─────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([AllowAny])
def register_user(request):
    serializer = UserSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=201)
    return Response(serializer.errors, status=400)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    """Return the currently logged-in user's profile."""
    serializer = UserSerializer(request.user)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_list(request):
    users = User.objects.all()
    serializer = UserMiniSerializer(users, many=True)
    return Response(serializer.data)


@api_view(['GET', 'PUT', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def user_detail(request, pk):
    user = get_object_or_404(User, pk=pk)

    if request.method == 'GET':
        return Response(UserSerializer(user).data)

    if request.method in ['PUT', 'PATCH']:
        partial = request.method == 'PATCH'
        serializer = UserSerializer(user, data=request.data, partial=partial)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    if request.method == 'DELETE':
        user.delete()
        return Response({'message': 'User deleted'}, status=204)


# ─── CLASSES (rep-managed cohorts) ──────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def classes_view(request):
    """
    GET: a rep sees only the classes they manage. Lecturers/leaders/students
    don't get a global class list — Class is strictly a rep/lecturer
    coordination concept. See DESIGN_DECISIONS.md section 9.
    POST: any rep can create a class and is automatically added as its rep.
    """
    if request.method == 'GET':
        if request.user.role != 'rep':
            return Response({'error': 'Only class reps manage classes'}, status=403)
        qs = get_user_classes(request.user).prefetch_related('reps', 'groups')
        return Response(ClassSerializer(qs, many=True).data)

    if request.method == 'POST':
        if request.user.role != 'rep':
            return Response({'error': 'Only class reps can create a class'}, status=403)

        serializer = ClassSerializer(data=request.data)
        # ClassSerializer is read-heavy (nested reps/created_by), so build
        # the instance directly instead of relying on serializer.save()
        # for input validation of the writable fields only.
        required = ['name', 'program', 'stage', 'cohort_year']
        missing = [f for f in required if not request.data.get(f)]
        if missing:
            return Response({'error': f"Missing fields: {', '.join(missing)}"}, status=400)

        if Class.objects.filter(
            program=request.data['program'],
            stage=request.data['stage'],
            cohort_year=request.data['cohort_year']
        ).exists():
            return Response({'error': 'A class with this program, stage, and cohort year already exists'}, status=400)

        new_class = Class.objects.create(
            name=request.data['name'],
            program=request.data['program'],
            stage=request.data['stage'],
            cohort_year=request.data['cohort_year'],
            code=generate_class_code(),
            created_by=request.user,
        )
        new_class.reps.add(request.user)
        return Response(ClassSerializer(new_class).data, status=201)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def class_detail(request, pk):
    cls = get_object_or_404(Class, pk=pk)

    if request.user.role != 'rep' or not cls.reps.filter(id=request.user.id).exists():
        return Response({'error': 'You do not manage this class'}, status=403)

    if request.method == 'GET':
        return Response(ClassSerializer(cls).data)

    if request.method == 'PATCH':
        allowed = {'name', 'status'}
        for field in allowed:
            if field in request.data:
                setattr(cls, field, request.data[field])
        cls.save()
        return Response(ClassSerializer(cls).data)

    if request.method == 'DELETE':
        cls.delete()
        return Response({'message': 'Class deleted'}, status=204)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def add_rep_to_class(request, pk):
    """Supports rep handovers — multiple reps per class. See DESIGN_DECISIONS.md section 3."""
    cls = get_object_or_404(Class, pk=pk)
    if not cls.reps.filter(id=request.user.id).exists():
        return Response({'error': 'You do not manage this class'}, status=403)

    new_rep_id = request.data.get('user_id')
    new_rep = get_object_or_404(User, id=new_rep_id, role='rep')
    cls.reps.add(new_rep)
    return Response(ClassSerializer(cls).data)


# ─── GROUPS ───────────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated, IsLeader])
def create_group(request):
    if Group.objects.filter(members=request.user).exists():
        return Response({'error': 'You already belong to a group'}, status=400)

    group = Group.objects.create(
        name=request.data.get('name', ''),
        description=request.data.get('description', ''),
        code=generate_group_code(),
        leader=request.user,
    )
    group.members.add(request.user)

    # Link to a class via its code — same self-service pattern as group
    # and unit codes. The leader needs to know their class's code (shared
    # by their rep), not browse a list of all classes.
    class_code = request.data.get('class_code', '').strip().upper()
    if class_code:
        cls = Class.objects.filter(code=class_code).first()
        if cls:
            group.class_field = cls
            group.save()
        else:
            return Response({'error': f"No class found with code '{class_code}'"}, status=400)

    return Response(GroupSerializer(group).data, status=201)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def join_group(request):
    serializer = JoinGroupSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)

    code = serializer.validated_data['code']
    group = get_object_or_404(Group, code=code)

    if Group.objects.filter(members=request.user).exists():
        return Response({'error': 'You already belong to a group'}, status=400)

    if request.user.role == 'leader':
        return Response({'error': 'Leaders must create their own group'}, status=400)

    group.members.add(request.user)
    notify_member_joined(group, request.user)

    return Response({'message': f'You joined {group.name}', 'group': GroupSerializer(group).data})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_group(request):
    group = get_user_group(request.user)
    if not group:
        return Response({'error': 'You do not belong to any group'}, status=404)
    return Response(GroupSerializer(group).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def all_groups(request):
    """
    Lecturers see groups whose CLASS is currently attached (via an active
    UnitOffering) to a unit they teach.
    Reps see groups in classes they manage.
    Nobody sees every group in the institution by default.
    """
    if request.user.role not in ['lecturer', 'rep']:
        return Response({'error': 'Not authorised'}, status=403)

    if request.user.role == 'rep':
        classes = get_user_classes(request.user)
        groups = Group.objects.filter(class_field__in=classes)
    else:
        visible_units = get_lecturer_units(request.user)
        active_class_ids = UnitOffering.objects.filter(
            unit__in=visible_units, status='active'
        ).values_list('class_field_id', flat=True)
        groups = Group.objects.filter(class_field_id__in=active_class_ids)

    groups = groups.prefetch_related('members', 'leader')
    return Response(GroupSerializer(groups, many=True).data)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def leave_group(request):
    group = get_user_group(request.user)
    if not group:
        return Response({'error': 'You are not in a group'}, status=404)
    if group.leader == request.user:
        return Response({'error': 'Leaders cannot leave — delete the group instead'}, status=400)
    group.members.remove(request.user)
    return Response({'message': f'You left {group.name}'})


# ─── UNITS ────────────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def units(request):
    """
    GET only here — unit CREATION moved to create_unit below because it
    needs special co-lecturer-join logic, not a plain serializer.save().
    """
    user = request.user
    if user.role in ['lecturer', 'rep']:
        qs = get_visible_units(user)
    else:
        group = get_user_group(user)
        if group and group.class_field:
            qs = Unit.objects.filter(offerings__class_field=group.class_field, offerings__status='active').distinct()
        else:
            qs = Unit.objects.none()
    return Response(UnitSerializer(qs, many=True).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsLecturer])
def create_unit(request):
    """
    Create a unit, OR join an existing one as a co-lecturer if the code
    already exists. The unit code IS the join code — see
    DESIGN_DECISIONS.md section 6.
    """
    serializer = CreateUnitSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)

    code = serializer.validated_data['code'].strip().upper()
    name = serializer.validated_data['name'].strip()

    existing = Unit.objects.filter(code=code).first()

    if not existing:
        unit = Unit.objects.create(code=code, name=name, created_by=request.user)
        unit.lecturers.add(request.user)
        return Response({
            'created_new': True,
            'unit': UnitSerializer(unit).data
        }, status=201)

    # Code already exists — this is a co-lecturer join, not a duplicate.
    if existing.lecturers.filter(id=request.user.id).exists():
        return Response({'error': 'You already teach this unit'}, status=400)

    similarity = existing.name_similarity(name)
    force = request.data.get('confirm_join', False)

    if similarity < UNIT_NAME_SIMILARITY_THRESHOLD and not force:
        return Response({
            'needs_confirmation': True,
            'message': (
                f"This code is already registered as '{existing.name}'. "
                f"The name you entered ('{name}') looks quite different. "
                f"Continue and join as a co-lecturer anyway?"
            ),
            'existing_unit': UnitSerializer(existing).data,
        }, status=409)

    existing.lecturers.add(request.user)
    return Response({
        'created_new': False,
        'joined_existing': True,
        'unit': UnitSerializer(existing).data
    }, status=200)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_units(request):
    """What units does the logged-in lecturer/rep actually have scope over."""
    qs = get_visible_units(request.user)
    return Response(UnitSerializer(qs, many=True).data)


# ─── UNIT OFFERINGS (attach / detach — rep-controlled) ──────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def unit_offerings(request):
    """
    Active offerings visible to the requester. Defaults to active only —
    see /unit-offerings/history/ for closed ones.
    See DESIGN_DECISIONS.md section 7.
    """
    qs = get_visible_offerings(request.user).filter(status='active').select_related('unit', 'class_field')
    return Response(UnitOfferingSerializer(qs, many=True).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def unit_offerings_history(request):
    """Closed offerings — past semesters' work, never deleted, just filtered out of the default view."""
    qs = get_visible_offerings(request.user).filter(status='closed').select_related('unit', 'class_field')
    return Response(UnitOfferingSerializer(qs, many=True).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsRep])
def attach_class(request):
    """
    Rep attaches one of their classes to a unit by entering its code.
    This is the ONLY way an offering gets created — lecturers cannot
    initiate this. See DESIGN_DECISIONS.md section 5.
    """
    serializer = AttachClassSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)

    unit_code = serializer.validated_data['unit_code'].strip().upper()
    class_id = serializer.validated_data['class_id']

    cls = get_object_or_404(Class, id=class_id)
    if not cls.reps.filter(id=request.user.id).exists():
        return Response({'error': 'You do not manage this class'}, status=403)

    unit = get_object_or_404(Unit, code=unit_code)

    if UnitOffering.objects.filter(unit=unit, class_field=cls, status='active').exists():
        return Response({'error': 'This class is already attached to this unit'}, status=400)

    offering = UnitOffering.objects.create(
        unit=unit, class_field=cls, attached_by=request.user, status='active'
    )
    return Response(UnitOfferingSerializer(offering).data, status=201)


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsRep])
def detach_class(request, pk):
    """
    Closes (never deletes) a UnitOffering. If there's unsubmitted work,
    requires confirm=true to proceed — see DESIGN_DECISIONS.md section 7.
    """
    offering = get_object_or_404(UnitOffering, pk=pk, status='active')

    if not offering.class_field.reps.filter(id=request.user.id).exists():
        return Response({'error': 'You do not manage this class'}, status=403)

    confirm = request.data.get('confirm', False)

    if offering.has_unsubmitted_work() and not confirm:
        return Response({
            'needs_confirmation': True,
            'message': (
                f"{offering.class_field.name} still has unsubmitted work under "
                f"{offering.unit.code}. Detaching will close this offering but "
                f"won't delete anything — you'll still be able to view it under "
                f"past offerings. Continue?"
            ),
        }, status=409)

    offering.close()
    return Response(UnitOfferingSerializer(offering).data)


# ─── PROGRESS DASHBOARD ──────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def group_progress(request):
    """
    The accountability dashboard. Returns per-member task breakdown for the
    leader's group (or any group if lecturer/rep passes ?group_id=X, scoped
    to units/classes they actually have access to).
    """
    if request.user.role in ['lecturer', 'rep']:
        group_id = request.query_params.get('group_id')
        if not group_id:
            return Response({'error': 'Pass ?group_id=X'}, status=400)

        if request.user.role == 'rep':
            classes = get_user_classes(request.user)
            group = get_object_or_404(Group, id=group_id, class_field__in=classes)
        else:
            visible_units = get_lecturer_units(request.user)
            active_class_ids = UnitOffering.objects.filter(
                unit__in=visible_units, status='active'
            ).values_list('class_field_id', flat=True)
            group = get_object_or_404(Group, id=group_id, class_field_id__in=active_class_ids)
    else:
        group = get_user_group(request.user)
        if not group:
            return Response({'error': 'You are not in a group'}, status=404)
        if request.user.role == 'student':
            return Response({'error': 'Only leaders can view group progress'}, status=403)

    # Fetch every task for this group ONCE, then group in Python — the
    # previous version re-queried per member (a filter + 4 separate
    # .count() calls each), so a 5-person group cost ~25 queries here.
    # This version costs 2 regardless of group size.
    all_tasks = list(Task.objects.filter(group=group).select_related('assigned_to', 'assignment'))
    tasks_by_member = {}
    for t in all_tasks:
        tasks_by_member.setdefault(t.assigned_to_id, []).append(t)

    members_data = []
    for member in group.members.all():
        member_tasks = tasks_by_member.get(member.id, [])
        members_data.append({
            'member': UserMiniSerializer(member).data,
            'tasks': TaskSerializer(member_tasks, many=True, context={'request': request}).data,
            'summary': {
                'total': len(member_tasks),
                'todo': sum(1 for t in member_tasks if t.status == 'todo'),
                'in_progress': sum(1 for t in member_tasks if t.status == 'progress'),
                'done': sum(1 for t in member_tasks if t.status == 'done'),
                'overdue': sum(1 for t in member_tasks if t.is_overdue),
            }
        })

    return Response({
        'group': GroupSerializer(group).data,
        'overall': group.get_progress_summary(),
        'members': members_data,
    })


# ─── INTERNAL GROUP FILES (collaboration, not final submission) ────────────
# Deliberately separate access model from Submission: this is ONLY ever
# the requester's own group, no lecturer/rep path at all — internal means
# internal. Compare to Submission, which lecturers/reps can see by design.

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def group_files(request):
    group = get_user_group(request.user)
    if not group:
        return Response({'error': 'You are not in a group'}, status=400)

    if request.method == 'GET':
        qs = group.shared_files.select_related('uploaded_by')
        return Response(GroupFileSerializer(qs, many=True, context={'request': request}).data)

    # POST
    serializer = GroupFileSerializer(data=request.data)
    if serializer.is_valid():
        group_file = serializer.save(uploaded_by=request.user, group=group)
        return Response(GroupFileSerializer(group_file, context={'request': request}).data, status=201)
    return Response(serializer.errors, status=400)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def group_file_detail(request, pk):
    group_file = get_object_or_404(GroupFile, pk=pk)
    group = get_user_group(request.user)
    if not group or group_file.group_id != group.id:
        return Response({'error': 'Not authorised'}, status=403)
    # Anyone in the group can share; only the uploader or the group's
    # leader can remove something — mirrors a normal shared-drive norm.
    if group_file.uploaded_by_id != request.user.id and group.leader_id != request.user.id:
        return Response({'error': 'Only the uploader or the group leader can remove this file'}, status=403)
    group_file.delete()
    return Response(status=204)



@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def tasks(request):
    if request.method == 'GET':
        user = request.user
        if user.role == 'lecturer':
            visible_units = get_lecturer_units(user)
            active_class_ids = UnitOffering.objects.filter(
                unit__in=visible_units, status='active'
            ).values_list('class_field_id', flat=True)
            task_qs = Task.objects.filter(group__class_field_id__in=active_class_ids)
        elif user.role == 'rep':
            classes = get_user_classes(user)
            task_qs = Task.objects.filter(group__class_field__in=classes)
        elif user.role == 'leader':
            task_qs = Task.objects.filter(group__leader=user)
        else:
            task_qs = Task.objects.filter(assigned_to=user)

        assignment_id = request.query_params.get('assignment')
        if assignment_id:
            task_qs = task_qs.filter(assignment_id=assignment_id)

        task_qs = task_qs.select_related('assigned_to', 'created_by', 'assignment', 'group')
        return Response(TaskSerializer(task_qs, many=True, context={'request': request}).data)

    if request.method == 'POST':
        if request.user.role != 'leader':
            return Response({'error': 'Only group leaders can create tasks'}, status=403)

        group_id = request.data.get('group')
        assigned_to_id = request.data.get('assigned_to')

        group = get_object_or_404(Group, id=group_id)

        if group.leader != request.user:
            return Response({'error': 'You can only create tasks for your own group'}, status=403)

        if not group.members.filter(id=assigned_to_id).exists():
            return Response({'error': 'Assigned user must be a group member'}, status=400)

        serializer = TaskSerializer(data=request.data)
        if serializer.is_valid():
            task = serializer.save(created_by=request.user)
            notify_task_assigned(task)
            if task.assignment:
                ga = GroupAssignment.objects.filter(group=group, assignment=task.assignment).first()
                if ga:
                    ga.auto_update_status()
            return Response(TaskSerializer(task, context={'request': request}).data, status=201)

        return Response(serializer.errors, status=400)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def task_detail(request, pk):
    task = get_object_or_404(Task, pk=pk)
    user = request.user

    if user.role == 'student' and task.assigned_to != user:
        return Response({'error': 'You can only access your own tasks'}, status=403)

    if user.role == 'leader' and task.group.leader != user:
        return Response({'error': 'You can only access tasks in your group'}, status=403)

    if user.role == 'rep' and not get_user_classes(user).filter(id=task.group.class_field_id).exists():
        return Response({'error': 'You can only access tasks in classes you manage'}, status=403)

    if user.role == 'lecturer':
        unit_id = task.assignment.unit_id if task.assignment else None
        if not unit_id or not get_lecturer_units(user).filter(id=unit_id).exists():
            return Response({'error': 'You can only access tasks for units you teach'}, status=403)

    if request.method == 'GET':
        return Response(TaskSerializer(task, context={'request': request}).data)

    if request.method == 'PATCH':
        # Students may only change status and attach evidence
        if user.role == 'student':
            allowed = {'status', 'submission_text', 'submission_file'}
            data = {k: v for k, v in request.data.items() if k in allowed}
        else:
            # Build a plain filtered dict rather than request.data.copy()
            # — QueryDict.copy() deep-copies everything including any
            # uploaded file, which throws on large files (the file
            # backing store becomes a real file handle above ~2.5MB,
            # and Python can't pickle/deepcopy an open file handle).
            data = {k: v for k, v in request.data.items() if k not in ('group', 'created_by')}

            new_assignee = data.get('assigned_to')
            if new_assignee and not task.group.members.filter(id=new_assignee).exists():
                return Response({'error': 'assigned_to must be a member of this task\'s group'}, status=400)

        serializer = TaskSerializer(task, data=data, partial=True)
        if serializer.is_valid():
            updated_task = serializer.save()
            notify_task_status_updated(updated_task, user)
            if updated_task.assignment:
                ga = GroupAssignment.objects.filter(
                    group=updated_task.group,
                    assignment=updated_task.assignment
                ).first()
                if ga:
                    ga.auto_update_status()
            return Response(TaskSerializer(updated_task, context={'request': request}).data)
        return Response(serializer.errors, status=400)

    if request.method == 'DELETE':
        if user.role != 'leader' or task.group.leader != user:
            return Response({'error': 'Only the group leader can delete tasks'}, status=403)
        task.delete()
        return Response({'message': 'Task deleted'}, status=204)


# ─── ASSIGNMENTS ──────────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def assignments_view(request):
    if request.method == 'GET':
        user = request.user
        if user.role in ['lecturer', 'rep']:
            visible_units = get_visible_units(user)
            qs = Assignment.objects.filter(unit__in=visible_units)
        else:
            group = get_user_group(user)
            if group and group.class_field:
                offering_units = Unit.objects.filter(
                    offerings__class_field=group.class_field, offerings__status='active'
                )
                qs = Assignment.objects.filter(unit__in=offering_units)
            else:
                qs = Assignment.objects.none()
        return Response(AssignmentSerializer(qs.select_related('unit', 'created_by'), many=True).data)

    if request.method == 'POST':
        if request.user.role not in ['lecturer', 'rep']:
            return Response({'error': 'Only lecturers can create assignments'}, status=403)

        unit_id = request.data.get('unit')
        if request.user.role == 'lecturer':
            if not get_lecturer_units(request.user).filter(id=unit_id).exists():
                return Response({'error': 'You can only post assignments for units you teach'}, status=403)

        serializer = AssignmentSerializer(data=request.data)
        if serializer.is_valid():
            if serializer.validated_data['deadline'] <= timezone.now():
                return Response({'deadline': 'Deadline must be in the future.'}, status=400)
            assignment = serializer.save(created_by=request.user)
            return Response(AssignmentSerializer(assignment).data, status=201)
        return Response(serializer.errors, status=400)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def assignment_detail(request, pk):
    assignment = get_object_or_404(Assignment, pk=pk)

    if request.method == 'GET':
        return Response(AssignmentSerializer(assignment).data)

    if request.method in ['PATCH', 'DELETE']:
        if request.user.role not in ['lecturer', 'rep']:
            return Response({'error': 'Not authorised'}, status=403)
        if request.user.role == 'lecturer' and not get_lecturer_units(request.user).filter(id=assignment.unit_id).exists():
            return Response({'error': 'You can only manage assignments for units you teach'}, status=403)
        if request.user.role == 'rep' and not get_user_classes(request.user).filter(
            unit_offerings__unit_id=assignment.unit_id
        ).exists():
            return Response({'error': 'You can only manage assignments for units attached to your class'}, status=403)

    if request.method == 'PATCH':
        serializer = AssignmentSerializer(assignment, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    if request.method == 'DELETE':
        assignment.delete()
        return Response({'message': 'Assignment deleted'}, status=204)


# ─── GROUP ASSIGNMENTS (linking groups to assignments, scoped to an offering) ───

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def group_assignments(request):
    if request.method == 'GET':
        user = request.user
        if user.role == 'lecturer':
            visible_offerings = get_visible_offerings(user)
            qs = GroupAssignment.objects.filter(offering__in=visible_offerings)
        elif user.role == 'rep':
            visible_offerings = get_visible_offerings(user)
            qs = GroupAssignment.objects.filter(offering__in=visible_offerings)
        else:
            group = get_user_group(user)
            qs = GroupAssignment.objects.filter(group=group) if group else GroupAssignment.objects.none()
        return Response(GroupAssignmentSerializer(
            qs.select_related('group', 'assignment__unit', 'offering'), many=True
        ).data)

    if request.method == 'POST':
        if request.user.role not in ['lecturer', 'rep']:
            return Response({'error': 'Only lecturers can link assignments to groups'}, status=403)

        group_obj = get_object_or_404(Group, id=request.data.get('group'))
        assignment_obj = get_object_or_404(Assignment, id=request.data.get('assignment'))

        if not group_obj.class_field:
            return Response({'error': 'This group has no class assigned'}, status=400)

        offering = UnitOffering.objects.filter(
            unit=assignment_obj.unit, class_field=group_obj.class_field, status='active'
        ).first()

        if not offering:
            return Response({
                'error': "This group's class isn't attached to this assignment's unit. "
                         "The rep needs to attach the class first."
            }, status=400)

        # Scope check: lecturer must teach this unit; rep must manage this class
        if request.user.role == 'lecturer' and not get_lecturer_units(request.user).filter(id=assignment_obj.unit_id).exists():
            return Response({'error': 'You can only link assignments for units you teach'}, status=403)
        if request.user.role == 'rep' and not get_user_classes(request.user).filter(id=group_obj.class_field_id).exists():
            return Response({'error': 'You can only link groups in classes you manage'}, status=403)

        ga, created = GroupAssignment.objects.get_or_create(
            group=group_obj, assignment=assignment_obj,
            defaults={'offering': offering}
        )
        if not created:
            return Response({'error': 'This group is already linked to this assignment'}, status=400)

        notify_group_assignment_linked(ga)
        return Response(GroupAssignmentSerializer(ga, context={'request': request}).data, status=201)


# ─── SUBMISSIONS ──────────────────────────────────────────────────────────────

@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def mark_group_assignment_reviewed(request, pk):
    """
    Lecturer/rep marks a group's submitted work as reviewed, once they've
    checked it. This is the missing other half of the submission loop —
    previously 'reviewed' was a defined status nothing ever set.
    """
    if request.user.role not in ['lecturer', 'rep']:
        return Response({'error': 'Only lecturers or reps can mark submissions reviewed'}, status=403)

    ga = get_object_or_404(GroupAssignment, id=pk)

    if request.user.role == 'lecturer' and not get_lecturer_units(request.user).filter(id=ga.assignment.unit_id).exists():
        return Response({'error': 'You can only review submissions for units you teach'}, status=403)
    if request.user.role == 'rep' and not get_user_classes(request.user).filter(id=ga.group.class_field_id).exists():
        return Response({'error': 'You can only review submissions for classes you manage'}, status=403)

    if ga.status != 'submitted':
        return Response({'error': 'Only submitted work can be marked reviewed'}, status=400)

    ga.status = 'reviewed'
    ga.save()
    return Response(GroupAssignmentSerializer(ga, context={'request': request}).data)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def submissions(request):
    if request.method == 'GET':
        user = request.user
        if user.role in ['lecturer', 'rep']:
            visible_offerings = get_visible_offerings(user)
            scoped_group_ids = GroupAssignment.objects.filter(
                offering__in=visible_offerings
            ).values_list('group_id', flat=True)
            qs = Submission.objects.filter(group_id__in=scoped_group_ids)
        elif user.role == 'leader':
            group = get_user_group(user)
            qs = Submission.objects.filter(group=group) if group else Submission.objects.none()
        else:
            return Response({'error': 'Not authorised'}, status=403)
        # context is required so FileField serializes to an absolute URL
        # (otherwise the frontend gets a bare /media/... path it can't
        # reliably turn into a working download link)
        return Response(SubmissionSerializer(qs, many=True, context={'request': request}).data)

    if request.method == 'POST':
        if request.user.role != 'leader':
            return Response({'error': 'Only group leaders can submit'}, status=403)

        group = get_user_group(request.user)
        if not group:
            return Response({'error': 'You are not in a group'}, status=400)

        # The group is always the leader's own group — 'group' is
        # read-only on the serializer, so this save() kwarg is the only
        # thing that can set it; no client-supplied value can override it.
        assignment_id = request.data.get('assignment')
        ga = GroupAssignment.objects.filter(group=group, assignment_id=assignment_id).first()
        if not ga:
            return Response({'error': 'This assignment is not linked to your group.'}, status=400)
        if ga.assignment.deadline <= timezone.now():
            return Response({'error': 'The deadline for this assignment has passed.'}, status=400)

        serializer = SubmissionSerializer(data=request.data)
        if serializer.is_valid():
            submission = serializer.save(submitted_by=request.user, group=group)
            ga.status = 'submitted'
            ga.submitted_at = timezone.now()
            ga.save()
            return Response(SubmissionSerializer(submission).data, status=201)
        return Response(serializer.errors, status=400)


# ─── NOTIFICATIONS ────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_notifications(request):
    notifications = Notification.objects.filter(recipient=request.user)
    return Response(NotificationSerializer(notifications, many=True).data)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def mark_notification_read(request, pk):
    notif = get_object_or_404(Notification, pk=pk, recipient=request.user)
    notif.is_read = True
    notif.save()
    return Response({'message': 'Marked as read'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_all_notifications_read(request):
    Notification.objects.filter(recipient=request.user, is_read=False).update(is_read=True)
    return Response({'message': 'All notifications marked as read'})


# ─── STATS / SUMMARY ──────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):
    """A single endpoint the frontend calls to populate the dashboard summary cards."""
    user = request.user

    if user.role in ['lecturer', 'rep']:
        visible_units = get_visible_units(user)
        active_offerings = get_visible_offerings(user).filter(status='active')
        active_class_ids = active_offerings.values_list('class_field_id', flat=True)

        scoped_groups = Group.objects.filter(class_field_id__in=active_class_ids)
        scoped_assignments = Assignment.objects.filter(unit__in=visible_units)
        scoped_tasks = Task.objects.filter(group__class_field_id__in=active_class_ids)
        scoped_group_ids = GroupAssignment.objects.filter(
            offering__in=active_offerings
        ).values_list('group_id', flat=True)
        scoped_submissions = Submission.objects.filter(group_id__in=scoped_group_ids)
        scoped_users = User.objects.filter(joined_groups__class_field_id__in=active_class_ids).distinct()
        pending_review = GroupAssignment.objects.filter(
            offering__in=active_offerings, status='submitted'
        ).select_related('group', 'assignment')

        return Response({
            'role': user.role,
            'units_count': visible_units.count(),
            'units': list(visible_units.values_list('code', flat=True)),
            'active_offerings_count': active_offerings.count(),
            'total_groups': scoped_groups.count(),
            'total_users': scoped_users.count(),
            'total_assignments': scoped_assignments.count(),
            'total_tasks': scoped_tasks.count(),
            'total_submissions': scoped_submissions.count(),
            'pending_review_count': pending_review.count(),
            'pending_review': [
                {'id': ga.id, 'assignment_title': ga.assignment.title, 'group_name': ga.group.name}
                for ga in pending_review[:5]
            ],
            'unread_notifications': Notification.objects.filter(
                recipient=user, is_read=False
            ).count(),
        })

    group = get_user_group(user)

    if user.role == 'leader' and group:
        tasks_qs = Task.objects.filter(group=group)
        ready_to_submit = GroupAssignment.objects.filter(group=group, status='ready_to_submit')
        return Response({
            'role': user.role,
            'group_name': group.name,
            'group_code': group.code,
            'member_count': group.members.count(),
            'tasks_total': tasks_qs.count(),
            'tasks_todo': tasks_qs.filter(status='todo').count(),
            'tasks_in_progress': tasks_qs.filter(status='progress').count(),
            'tasks_done': tasks_qs.filter(status='done').count(),
            'ready_to_submit_count': ready_to_submit.count(),
            'ready_to_submit': [
                {'id': ga.id, 'assignment_title': ga.assignment.title}
                for ga in ready_to_submit.select_related('assignment')[:5]
            ],
            'unread_notifications': Notification.objects.filter(
                recipient=user, is_read=False
            ).count(),
        })

    # Student
    my_tasks = Task.objects.filter(assigned_to=user)
    next_task = my_tasks.exclude(status='done').order_by('due_date').first()
    return Response({
        'role': user.role,
        'group_name': group.name if group else None,
        'group_code': group.code if group else None,
        'tasks_total': my_tasks.count(),
        'tasks_todo': my_tasks.filter(status='todo').count(),
        'tasks_in_progress': my_tasks.filter(status='progress').count(),
        'tasks_done': my_tasks.filter(status='done').count(),
        'next_task': {
            'id': next_task.id, 'title': next_task.title,
            'due_date': next_task.due_date, 'is_overdue': next_task.is_overdue,
        } if next_task else None,
        'unread_notifications': Notification.objects.filter(
            recipient=user, is_read=False
        ).count(),
    })


# ─── PROTECTED FILE ACCESS ──────────────────────────────────────────────────
# Task evidence and submission files are private coursework, not public
# assets. Django's static() media mount serves anything under /media/ to
# anyone who has the URL, with zero login or ownership check — that's a
# real gap (a file URL that leaks via a screenshot, shared link, or browser
# history would be downloadable by a stranger forever). These two views
# are the only way those files are served now; the blanket static() media
# mount has been removed from urls.py.

def _can_access_task_evidence(user, task):
    if user.role == 'student':
        return task.assigned_to_id == user.id or task.group.members.filter(id=user.id).exists()
    if user.role == 'leader':
        return task.group.members.filter(id=user.id).exists() or task.group.leader_id == user.id
    if user.role == 'lecturer':
        return get_lecturer_units(user).filter(id=task.assignment.unit_id).exists() if task.assignment else False
    if user.role == 'rep':
        return get_user_classes(user).filter(id=task.group.class_field_id).exists()
    return False


def _can_access_submission(user, submission):
    group = submission.group
    if user.role in ('student', 'leader'):
        return group.members.filter(id=user.id).exists() or group.leader_id == user.id
    if user.role == 'lecturer':
        return get_lecturer_units(user).filter(id=submission.assignment.unit_id).exists()
    if user.role == 'rep':
        return get_user_classes(user).filter(id=group.class_field_id).exists()
    return False


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def download_task_evidence(request, task_id):
    task = get_object_or_404(Task, id=task_id)
    if not task.submission_file:
        raise Http404('No evidence file on this task.')
    if not _can_access_task_evidence(request.user, task):
        return Response({'detail': 'You do not have permission to access this file.'}, status=403)
    return FileResponse(
        task.submission_file.open('rb'), as_attachment=True,
        filename=task.submission_file.name.split('/')[-1],
    )


def _can_access_group_file(user, group_file):
    return group_file.group.members.filter(id=user.id).exists() or group_file.group.leader_id == user.id


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def download_group_file(request, file_id):
    group_file = get_object_or_404(GroupFile, id=file_id)
    if not _can_access_group_file(request.user, group_file):
        return Response({'detail': 'You do not have permission to access this file.'}, status=403)
    return FileResponse(
        group_file.file.open('rb'), as_attachment=True,
        filename=group_file.file.name.split('/')[-1],
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def download_submission_file(request, submission_id):
    submission = get_object_or_404(Submission, id=submission_id)
    if not submission.file:
        raise Http404('No file on this submission.')
    if not _can_access_submission(request.user, submission):
        return Response({'detail': 'You do not have permission to access this file.'}, status=403)
    return FileResponse(
        submission.file.open('rb'), as_attachment=True,
        filename=submission.file.name.split('/')[-1],
    )
