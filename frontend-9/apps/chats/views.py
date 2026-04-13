from django.shortcuts import render


def chats_index_view(request):
    return render(
        request,
        "chats/index.html",
        {
            "page_title": "Мессенджер",
        },
    )