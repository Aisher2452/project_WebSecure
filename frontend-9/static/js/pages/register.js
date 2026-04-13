document.addEventListener("DOMContentLoaded", async () => {
    const SM = window.SecureMessenger;
    const form = document.querySelector("[data-register-form]");

    if (!SM || !form) {
        return;
    }

    const alertBox = document.querySelector("[data-form-alert]");
    const submitButton = document.querySelector("[data-submit-button]");
    const cryptoStatus = document.querySelector("[data-crypto-status]");

    if (SM.auth.isAuthenticated()) {
        try {
            await SM.auth.getCurrentUser(true);
            window.location.replace("/chats/");
            return;
        } catch (error) {
            SM.auth.logout();
        }
    }

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

    if (!SM.crypto?.isSupported?.()) {
        setCryptoStatus("Web Crypto API недоступен в этом браузере.", "error");
        SM.ui.showAlert(
            alertBox,
            "Для регистрации нужен браузер с поддержкой Web Crypto API."
        );
        submitButton.disabled = true;
        return;
    }

    setCryptoStatus(
        "При регистрации будет сгенерирована пара RSA-OAEP ключей, а private key будет зашифрован вашим паролем.",
        "muted"
    );

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        SM.ui.hideAlert(alertBox);
        SM.ui.setButtonLoading(submitButton, true, "Готовим ключи...");

        const formData = new FormData(form);
        const username = String(formData.get("username") || "").trim();
        const email = String(formData.get("email") || "").trim();
        const password = String(formData.get("password") || "");
        const passwordConfirm = String(formData.get("password_confirm") || "");

        if (!username || !email || !password || !passwordConfirm) {
            SM.ui.showAlert(alertBox, "Заполните все поля.");
            SM.ui.setButtonLoading(submitButton, false);
            return;
        }

        if (password.length < 6) {
            SM.ui.showAlert(alertBox, "Пароль должен быть не меньше 6 символов.");
            SM.ui.setButtonLoading(submitButton, false);
            return;
        }

        if (password !== passwordConfirm) {
            SM.ui.showAlert(alertBox, "Пароли не совпадают.");
            SM.ui.setButtonLoading(submitButton, false);
            return;
        }

        try {
            setCryptoStatus("Генерируем RSA-OAEP key pair...", "working");
            const registrationBundle = await SM.crypto.createRegistrationBundle(password);

            setCryptoStatus("Шифруем private key через PBKDF2 + AES-GCM...", "working");
            SM.ui.setButtonLoading(submitButton, true, "Создаем аккаунт...");

            await SM.auth.register({
                username,
                email,
                password,
                public_key: registrationBundle.public_key,
                encrypted_private_key: registrationBundle.encrypted_private_key,
                key_salt: registrationBundle.key_salt,
            });

            const user = await SM.auth.getCurrentUser(true);
            await SM.crypto.rememberRegistrationLocally(registrationBundle, user);

            setCryptoStatus("Ключи сохранены. Аккаунт создан.", "success");
            window.location.replace("/chats/");
        } catch (error) {
            setCryptoStatus("Не удалось завершить crypto-инициализацию.", "error");
            SM.ui.showAlert(
                alertBox,
                error.message || "Не удалось зарегистрировать пользователя."
            );
        } finally {
            SM.ui.setButtonLoading(submitButton, false);
        }
    });
});