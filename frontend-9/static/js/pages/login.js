document.addEventListener("DOMContentLoaded", async () => {
    const SM = window.SecureMessenger;
    const form = document.querySelector("[data-login-form]");

    if (!SM || !form) {
        return;
    }

    const alertBox = document.querySelector("[data-form-alert]");
    const submitButton = document.querySelector("[data-submit-button]");
    const cryptoStatus = document.querySelector("[data-crypto-status]");

    function setCryptoStatus(message, type = "muted") {
        if (!cryptoStatus) {
            return;
        }

        cryptoStatus.textContent = message;
        cryptoStatus.classList.remove(
            "muted",
            "crypto-status--working",
            "crypto-status--success",
            "crypto-status--error"
        );

        if (type === "working") {
            cryptoStatus.classList.add("crypto-status--working");
            return;
        }

        if (type === "success") {
            cryptoStatus.classList.add("crypto-status--success");
            return;
        }

        if (type === "error") {
            cryptoStatus.classList.add("crypto-status--error");
            return;
        }

        cryptoStatus.classList.add("muted");
    }

    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get("auth") === "logged-out") {
        SM.ui.showAlert(alertBox, "Вы успешно вышли из аккаунта.", "success");
    }

    if (!SM.crypto?.isSupported?.()) {
        setCryptoStatus("Web Crypto API недоступен в этом браузере.", "error");
        SM.ui.showAlert(
            alertBox,
            "Для входа и расшифровки private key нужен браузер с поддержкой Web Crypto API."
        );
        submitButton.disabled = true;
        return;
    }

    setCryptoStatus(
        "После входа private key будет расшифрован вашим паролем и временно сохранен только в sessionStorage текущей вкладки.",
        "muted"
    );

    if (SM.auth.isAuthenticated()) {
        try {
            await SM.auth.getCurrentUser(true);
            window.location.replace("/chats/");
            return;
        } catch (error) {
            SM.auth.logout();
        }
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        SM.ui.hideAlert(alertBox);
        SM.ui.setButtonLoading(submitButton, true, "Входим...");

        const formData = new FormData(form);
        const email = String(formData.get("email") || "").trim();
        const password = String(formData.get("password") || "").trim();

        if (!email || !password) {
            SM.ui.showAlert(alertBox, "Заполните email и пароль.");
            SM.ui.setButtonLoading(submitButton, false);
            return;
        }

        try {
            setCryptoStatus("Проверяем логин и пароль на backend...", "working");
            await SM.auth.login({
                email,
                password,
            });

            setCryptoStatus("Получаем crypto-профиль пользователя...", "working");
            const user = await SM.auth.getCurrentUser(true);

            setCryptoStatus("Расшифровываем private key локально в браузере...", "working");
            await SM.crypto.unlockPrivateKey(user, password);

            setCryptoStatus("Private key успешно импортирован в crypto client.", "success");
            window.location.replace("/chats/");
        } catch (error) {
            SM.auth.logout();
            setCryptoStatus("Не удалось расшифровать private key.", "error");
            SM.ui.showAlert(
                alertBox,
                error.message || "Не удалось выполнить вход."
            );
        } finally {
            SM.ui.setButtonLoading(submitButton, false);
        }
    });
});