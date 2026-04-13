from django.shortcuts import render


def login_view(request):
    return render(
        request,
        "accounts/login.html",
        {
            "page_title": "Вход",
        },
    )


def register_view(request):
    return render(
        request,
        "accounts/register.html",
        {
            "page_title": "Регистрация",
        },
    )


def logout_view(request):
    return render(
        request,
        "accounts/logout.html",
        {
            "page_title": "Выход",
        },
    )