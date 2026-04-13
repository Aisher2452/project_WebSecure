from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("", include("apps.accounts.urls")),
    path("auth/", include("apps.accounts.urls")),
    path("chats/", include("apps.chats.urls")),
]