document.addEventListener("DOMContentLoaded", async () => {
    const SM = window.SecureMessenger;
    const homePage = document.querySelector("[data-home-page]");

    if (!SM || !homePage) {
        return;
    }

    const loadingState = document.querySelector("[data-home-loading]");
    const guestState = document.querySelector("[data-home-guest]");
    const errorState = document.querySelector("[data-home-error]");
    const errorText = document.querySelector("[data-home-error-text]");
    const userState = document.querySelector("[data-home-user]");

    function showState(target) {
        [loadingState, guestState, errorState, userState].forEach((element) => {
            element?.classList.add("hidden");
        });

        target?.classList.remove("hidden");
    }

    function fillTokenState() {
        SM.ui.setText(
            "[data-access-token-preview]",
            SM.ui.maskToken(SM.storage.getAccessToken())
        );
        SM.ui.setText(
            "[data-refresh-token-preview]",
            SM.ui.maskToken(SM.storage.getRefreshToken())
        );
    }

    function fillUser(user) {
        SM.ui.setText("[data-user-id]", user.id);
        SM.ui.setText("[data-user-username]", user.username);
        SM.ui.setText("[data-user-email]", user.email);
        SM.ui.setText("[data-user-active]", user.is_active ? "Да" : "Нет");
        SM.ui.setText(
            "[data-user-public-key]",
            user.public_key ? SM.ui.maskToken(user.public_key) : "—"
        );
        SM.ui.setText(
            "[data-user-encrypted-private-key]",
            user.encrypted_private_key ? SM.ui.maskToken(user.encrypted_private_key) : "—"
        );
        SM.ui.setText(
            "[data-user-key-salt]",
            user.key_salt ? SM.ui.maskToken(user.key_salt) : "—"
        );
    }

    function fillCryptoState() {
        const status = SM.crypto?.getStatus?.() || {};
        const payload = status.encrypted_payload || {};
        const profile = status.profile || {};
        const sessionMeta = status.session_meta || {};

        SM.ui.setText(
            "[data-crypto-supported]",
            status.is_supported ? "Да" : "Нет"
        );
        SM.ui.setText(
            "[data-crypto-unlocked]",
            status.is_unlocked ? "Да, private key импортирован" : "Нет"
        );
        SM.ui.setText(
            "[data-crypto-session-cache]",
            status.has_session_private_key ? "Есть" : "Нет"
        );
        SM.ui.setText(
            "[data-crypto-public-storage]",
            status.public_key_storage || "—"
        );
        SM.ui.setText(
            "[data-crypto-private-storage]",
            status.encrypted_private_key_storage || "—"
        );
        SM.ui.setText(
            "[data-crypto-salt-storage]",
            status.key_salt_storage || "—"
        );
        SM.ui.setText(
            "[data-crypto-session-storage]",
            status.session_private_key_storage || "—"
        );
        SM.ui.setText(
            "[data-crypto-kdf]",
            payload.kdf
                ? `${payload.kdf} / ${payload.kdf_hash} / ${payload.kdf_iterations}`
                : "—"
        );
        SM.ui.setText(
            "[data-crypto-cipher]",
            payload.cipher ? `${payload.cipher} / iv=${SM.ui.maskToken(payload.iv)}` : "—"
        );
        SM.ui.setText(
            "[data-crypto-payload-version]",
            payload.version ?? "—"
        );
        SM.ui.setText(
            "[data-crypto-public-key-preview]",
            profile.public_key ? SM.ui.maskToken(profile.public_key) : "—"
        );
        SM.ui.setText(
            "[data-crypto-private-key-preview]",
            profile.encrypted_private_key
                ? SM.ui.maskToken(profile.encrypted_private_key)
                : "—"
        );
        SM.ui.setText(
            "[data-crypto-salt-preview]",
            profile.key_salt ? SM.ui.maskToken(profile.key_salt) : "—"
        );
        SM.ui.setText(
            "[data-crypto-session-source]",
            sessionMeta.source || "—"
        );
        SM.ui.setText(
            "[data-crypto-session-cached-at]",
            sessionMeta.cached_at || "—"
        );
    }

    fillTokenState();

    if (!SM.auth.isAuthenticated()) {
        showState(guestState);
        return;
    }

    try {
        await SM.crypto?.restoreSession?.();
        const user = await SM.auth.getCurrentUser(true);
        fillUser(user);
        fillCryptoState();
        fillTokenState();
        showState(userState);
    } catch (error) {
        fillTokenState();

        if (error.status && error.status !== 401) {
            if (errorText) {
                errorText.textContent = error.message || "Неизвестная ошибка.";
            }
            showState(errorState);
            return;
        }

        SM.auth.logout();
        showState(guestState);
    }
});