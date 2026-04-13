document.addEventListener("DOMContentLoaded", async () => {
    const SM = window.SecureMessenger;

    if (!SM) {
        return;
    }

    const THEME_STORAGE_KEY = "sm_theme_mode";
    const guestNav = document.querySelector("[data-nav-guest]");
    const authNav = document.querySelector("[data-nav-auth]");
    const usernameNode = document.querySelector("[data-nav-username]");
    const emailNode = document.querySelector("[data-nav-useremail]");
    const themeToggle = document.querySelector("[data-theme-toggle]");

    function setGuestState() {
        guestNav?.classList.remove("hidden");
        authNav?.classList.add("hidden");

        if (usernameNode) {
            usernameNode.textContent = "Пользователь";
        }

        if (emailNode) {
            emailNode.textContent = "";
        }
    }

    function setAuthState(user) {
        guestNav?.classList.add("hidden");
        authNav?.classList.remove("hidden");

        if (usernameNode) {
            usernameNode.textContent = user?.username || "Пользователь";
        }

        if (emailNode) {
            emailNode.textContent = user?.email || "";
        }
    }

    function resolveInitialTheme() {
        const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
        if (stored === "light" || stored === "dark") {
            return stored;
        }

        return window.matchMedia?.("(prefers-color-scheme: light)")?.matches
            ? "light"
            : "dark";
    }

    function applyTheme(theme) {
        document.body.classList.toggle("light-mode", theme === "light");
        window.localStorage.setItem(THEME_STORAGE_KEY, theme);
        themeToggle?.setAttribute(
            "aria-label",
            theme === "light" ? "Включить тёмную тему" : "Включить светлую тему"
        );
    }

    applyTheme(resolveInitialTheme());

    themeToggle?.addEventListener("click", () => {
        const nextTheme = document.body.classList.contains("light-mode") ? "dark" : "light";
        applyTheme(nextTheme);
    });

    try {
        await SM.crypto?.restoreSession?.();
    } catch (error) {
        SM.crypto?.clearSession?.();
    }

    if (!SM.auth.isAuthenticated()) {
        setGuestState();
        return;
    }

    try {
        const user = await SM.auth.getCurrentUser(false);
        setAuthState(user);
    } catch (error) {
        SM.auth.logout();
        setGuestState();
    }
});