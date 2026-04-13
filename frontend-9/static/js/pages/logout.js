document.addEventListener("DOMContentLoaded", () => {
    const SM = window.SecureMessenger;

    if (SM) {
        SM.auth.logout();
    }

    window.setTimeout(() => {
        window.location.replace("/auth/login/?auth=logged-out");
    }, 250);
});