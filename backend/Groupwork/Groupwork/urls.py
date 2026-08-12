from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from api.views import download_task_evidence, download_submission_file, download_group_file

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),
    path('api/token/', TokenObtainPairView.as_view(), name='token-obtain'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    # Task evidence and submission files are private coursework — served
    # only through these authenticated, ownership-checked views. There is
    # deliberately no blanket static() mount for MEDIA_ROOT: that would
    # serve any file to anyone who has (or guesses) the URL, no login
    # required. See api/views.py for the permission checks.
    path('api/files/task-evidence/<int:task_id>/', download_task_evidence, name='task-evidence-download'),
    path('api/files/submission/<int:submission_id>/', download_submission_file, name='submission-download'),
    path('api/files/group-file/<int:file_id>/', download_group_file, name='group-file-download'),
]
