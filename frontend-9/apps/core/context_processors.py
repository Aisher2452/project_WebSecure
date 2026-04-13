from django.conf import settings


def frontend_settings(request):
    backend_api_base_url = f"{settings.BACKEND_BASE_URL}{settings.BACKEND_API_PREFIX}"

    return {
        "APP_NAME": settings.APP_NAME,
        "BACKEND_BASE_URL": settings.BACKEND_BASE_URL,
        "BACKEND_API_BASE_URL": backend_api_base_url.rstrip("/"),
        "BACKEND_WS_BASE_URL": settings.BACKEND_WS_BASE_URL,
    }