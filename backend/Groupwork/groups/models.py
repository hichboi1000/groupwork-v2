from django.db import models
from django.conf import settings
from Groupwork.validators import validate_upload


class Group(models.Model):
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=20, unique=True)
    description = models.TextField(blank=True, null=True)

    leader = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='led_groups'
    )

    members = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name='joined_groups',
        blank=True
    )

    # Groups belong to their Class PERMANENTLY — they progress together
    # through semesters and only get archived when the class graduates.
    # A group's relationship to a Unit is now indirect, through whichever
    # UnitOffering its Class is currently attached to (if any).
    # See DESIGN_DECISIONS.md section 4.
    class_field = models.ForeignKey(
        'classes.Class',
        on_delete=models.SET_NULL,
        related_name='groups',
        null=True,
        blank=True
    )

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

    def current_offering(self):
        """
        The active UnitOffering this group's class is currently attached
        to, if any. A group has no direct unit relationship — this always
        traces through the class. Returns None if the class isn't
        currently attached to anything.
        """
        if not self.class_field:
            return None
        return self.class_field.unit_offerings.filter(status='active').first()

    def get_progress_summary(self):
        """Returns a dict with task status counts for this group."""
        tasks = self.tasks.all()
        return {
            'total': tasks.count(),
            'todo': tasks.filter(status='todo').count(),
            'in_progress': tasks.filter(status='progress').count(),
            'done': tasks.filter(status='done').count(),
        }


class GroupFile(models.Model):
    """
    Internal file-sharing between group members — drafts, research,
    reference material, anything the group wants a shared place for
    while working. Deliberately separate from assignments.Submission:
    a Submission is the final, formal handoff to the lecturer/rep for
    grading; a GroupFile never leaves the group. Keeping them as two
    models (rather than one with a 'visibility' flag) means a bug in
    one access path can never accidentally expose the other.
    """
    group = models.ForeignKey(
        Group, on_delete=models.CASCADE, related_name='shared_files'
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='shared_group_files'
    )
    file = models.FileField(upload_to='group_files/%Y/%m/', validators=[validate_upload])
    description = models.CharField(max_length=255, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-uploaded_at']

    def __str__(self):
        return f"{self.file.name.split('/')[-1]} ({self.group.name})"
