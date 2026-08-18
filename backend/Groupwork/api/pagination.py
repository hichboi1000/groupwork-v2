"""
Pagination for function-based views.

DRF's DEFAULT_PAGINATION_CLASS in settings.py only applies automatically to
class-based generic views/viewsets. This project uses @api_view functions
throughout, so pagination has to be invoked explicitly per endpoint via the
helper below.

Only applied to endpoints whose result set grows with overall app usage
over time (all users, all notifications for a user across a degree, all
assignments/submissions across every unit someone can see). Endpoints
scoped to a single group's own tasks/files are deliberately left
unpaginated — they're bounded by group size, not by how long the app has
been running, so pagination there adds response-shape complexity for no
real benefit.
"""
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class StandardResultsPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = 'page_size'
    max_page_size = 100


def paginate_response(request, queryset, serializer_class, context=None):
    """
    Paginate `queryset`, serialize the page with `serializer_class`, and
    return a DRF Response shaped like:
        {"count": ..., "next": ..., "previous": ..., "results": [...]}

    Usage (inside an @api_view GET branch):
        return paginate_response(request, qs, AssignmentSerializer)
    """
    paginator = StandardResultsPagination()
    page = paginator.paginate_queryset(queryset, request)
    serializer = serializer_class(page, many=True, context=context or {'request': request})
    return paginator.get_paginated_response(serializer.data)
