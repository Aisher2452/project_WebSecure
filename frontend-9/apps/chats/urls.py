from django.urls import path

from .views import chats_index_view

app_name = "chats"

urlpatterns = [
    path("", chats_index_view, name="index"),
]