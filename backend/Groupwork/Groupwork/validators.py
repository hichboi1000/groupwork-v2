"""
Shared server-side validators for anything the frontend trusted to
enforce on its own — file size/type, deadlines, sensible bounds. The
frontend still enforces these too for a fast UI response, but the
backend is the actual source of truth: a direct API request (curl,
Postman, a modified frontend build) has to go through these regardless
of what the browser UI does or doesn't check.
"""
from django.core.exceptions import ValidationError
from django.utils import timezone

# 15MB — generous for coursework (docs, zipped code, presentations) while
# still ruling out someone uploading a full video or disk image as
# "evidence". Keeping this modest also matters for the phone-friendly
# goal: nobody wants to burn mobile data on an oversized upload/download.
MAX_UPLOAD_SIZE_BYTES = 15 * 1024 * 1024

ALLOWED_UPLOAD_EXTENSIONS = {
    'pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'csv',
    'zip', 'png', 'jpg', 'jpeg', 'gif', 'md',
}


def validate_upload(file):
    """Raises django.core.exceptions.ValidationError on any violation —
    used as a Django model field validator, so it plugs into both
    normal model validation and DRF's automatic field validation."""
    if file.size > MAX_UPLOAD_SIZE_BYTES:
        raise ValidationError(
            f"File is too large ({file.size // (1024*1024)}MB). "
            f"Maximum allowed is {MAX_UPLOAD_SIZE_BYTES // (1024*1024)}MB."
        )

    ext = file.name.rsplit('.', 1)[-1].lower() if '.' in file.name else ''
    if ext not in ALLOWED_UPLOAD_EXTENSIONS:
        raise ValidationError(
            f"'.{ext}' files aren't allowed. Allowed types: "
            f"{', '.join(sorted(ALLOWED_UPLOAD_EXTENSIONS))}."
        )


def validate_future_deadline(value):
    if value <= timezone.now():
        raise ValidationError("Deadline must be in the future.")
