(function () {
    function truncatePreview(value, max = 72) {
        const normalized = String(value || "").trim();
        if (!normalized) {
            return "";
        }
        if (normalized.length <= max) {
            return normalized;
        }
        return `${normalized.slice(0, max)}…`;
    }

    function isOwnMessage(message, currentUserId) {
        return String(message?.sender?.id) === String(currentUserId);
    }

    function hasLocalSenderKey(message) {
        return Boolean(message?.local_sender_encrypted_key);
    }

    function getStatusMeta(message) {
        if (message.local_state === "encrypting") {
            return { label: "Шифруется", className: "message-bubble__status--encrypting" };
        }

        if (message.local_state === "decrypting") {
            return { label: "Расшифровывается", className: "message-bubble__status--decrypting" };
        }

        if (message.local_state === "file_decrypting") {
            return { label: "Расшифровка файла", className: "message-bubble__status--decrypting" };
        }

        if (message.local_state === "sending") {
            return { label: "Отправляется", className: "message-bubble__status--encrypting" };
        }

        if (message.local_state === "uploading") {
            return { label: "Загружается", className: "message-bubble__status--encrypting" };
        }

        if (message.decryption_error || message.file_decryption_error) {
            return { label: "Ошибка", className: "message-bubble__status--error" };
        }

        if (message.is_expired || message.status === "expired") {
            return { label: "Истекло", className: "message-bubble__status--expired" };
        }

        if (message.status === "read") {
            return { label: "Прочитано", className: "message-bubble__status--read" };
        }

        if (message.status === "delivered") {
            return { label: "Доставлено", className: "message-bubble__status--delivered" };
        }

        return { label: "Отправлено", className: "message-bubble__status--sent" };
    }

    function createTextBody(message) {
        const body = document.createElement("div");
        body.className = "message-bubble__body";

        const text = document.createElement("p");
        text.className = "message-bubble__text";

        if (message.is_expired || message.status === "expired") {
            text.textContent = "Сообщение истекло.";
            body.append(text);
            return body;
        }

        if (message.local_preview_text) {
            text.textContent = message.local_preview_text;
            body.append(text);
            return body;
        }

        if (message.local_state === "encrypting") {
            text.textContent = "Сообщение шифруется...";
            body.append(text);
            return body;
        }

        if (message.local_state === "sending") {
            text.textContent = "Сообщение отправляется...";
            body.append(text);
            return body;
        }

        if (message.local_state === "decrypting") {
            text.textContent = "Сообщение расшифровывается...";
            body.append(text);
            return body;
        }

        if (message.decryption_error) {
            text.textContent = "Не удалось расшифровать сообщение.";
            body.append(text);

            const note = document.createElement("p");
            note.className = "message-bubble__error";
            note.textContent = message.decryption_error;
            body.append(note);
            return body;
        }

        text.textContent = isOwnMessage(message, null) && !hasLocalSenderKey(message)
            ? "Зашифрованное сообщение"
            : "Зашифрованное сообщение";
        body.append(text);
        return body;
    }

    function createFileBody(message) {
        const body = document.createElement("div");
        body.className = "message-bubble__body";

        if (message.is_expired || message.status === "expired") {
            const text = document.createElement("p");
            text.className = "message-bubble__text";
            text.textContent = "Файл истек.";
            body.append(text);
            return body;
        }

        const fileLink = document.createElement("button");
        fileLink.className = "message-bubble__file-link";
        fileLink.type = "button";
        fileLink.dataset.action = "decrypt-download-file";
        fileLink.dataset.messageId = String(message.id || "");
        fileLink.textContent = message.file_name || message.local_file_name || "Скачать файл";
        body.append(fileLink);

        if (message.local_state === "uploading") {
            const note = document.createElement("p");
            note.className = "message-bubble__note";
            note.textContent = "Файл подготавливается и загружается...";
            body.append(note);
            return body;
        }

        if (message.local_state === "file_decrypting") {
            const note = document.createElement("p");
            note.className = "message-bubble__note";
            note.textContent = "Файл расшифровывается...";
            body.append(note);
            return body;
        }

        if (message.file_decryption_error) {
            const note = document.createElement("p");
            note.className = "message-bubble__error";
            note.textContent = message.file_decryption_error;
            body.append(note);
            return body;
        }

        const meta = document.createElement("p");
        meta.className = "message-bubble__note";
        meta.textContent = message.decrypted_file_ready
            ? "Нажмите, чтобы скачать расшифрованный файл."
            : "Нажмите, чтобы расшифровать и скачать файл.";
        body.append(meta);
        return body;
    }

    function createMessageBubble(message, helpers) {
        const row = document.createElement("article");
        const ownMessage = isOwnMessage(message, helpers.currentUserId);
        row.className = `message-row${ownMessage ? " message-row--own" : ""}`;
        row.dataset.messageId = String(message.id || message.temp_id || "");

        const sender = document.createElement("span");
        sender.className = "message-bubble__sender";
        sender.textContent = ownMessage ? "Вы" : message?.sender?.username || "Собеседник";

        const bubble = document.createElement("div");
        bubble.className = "message-bubble";

        if (message.is_expired || message.status === "expired") {
            bubble.classList.add("message-bubble--expired");
        }

        const body = message.message_type === "file"
            ? createFileBody(message)
            : createTextBody(message);
        bubble.append(body);

        const footer = document.createElement("div");
        footer.className = "message-bubble__footer";

        const time = document.createElement("span");
        time.className = "message-bubble__time";
        time.textContent = helpers.formatTime(message.created_at || new Date().toISOString());

        const statusMeta = getStatusMeta(message);
        const status = document.createElement("span");
        status.className = `message-bubble__status ${statusMeta.className}`.trim();
        status.textContent = statusMeta.label;

        footer.append(time, status);
        bubble.append(footer);
        row.append(sender, bubble);

        return row;
    }

    function getListPreviewFromMessage(message) {
        if (!message) {
            return null;
        }

        if (message.is_expired || message.status === "expired") {
            return "Сообщение истекло";
        }

        if (message.message_type === "file") {
            return `Файл: ${message.file_name || "вложение"}`;
        }

        if (message.local_preview_text) {
            return truncatePreview(message.local_preview_text);
        }

        return "Зашифрованное сообщение";
    }

    function normalizeHistoryResponse(payload) {
        if (Array.isArray(payload)) {
            return payload;
        }

        if (Array.isArray(payload?.items)) {
            return payload.items;
        }

        return [];
    }

    window.SecureMessenger = window.SecureMessenger || {};
    window.SecureMessenger.chatMessagesPage = {
        createMessageBubble,
        getListPreviewFromMessage,
        normalizeHistoryResponse,
    };
})();