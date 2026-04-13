(function () {
    function normalizeChatPreview(chat) {
        if (!chat) {
            return "";
        }

        if (!chat.last_message_id) {
            return "Сообщений пока нет";
        }

        const preview = String(chat.last_message_preview || "").trim();

        if (!preview) {
            return "Зашифрованное сообщение";
        }

        if (/^[A-Za-z0-9+/=]{24,}$/.test(preview) || preview.length > 90) {
            return "Зашифрованное сообщение";
        }

        return preview;
    }

    function buildChatSearchText(chat) {
        return [
            chat?.other_user?.username || "",
            chat?.other_user?.email || "",
            normalizeChatPreview(chat),
        ]
            .join(" ")
            .toLowerCase();
    }

    function createChatCard(chat, state) {
        const item = document.createElement("button");
        item.className = "list-card chat-card";
        item.type = "button";
        item.dataset.chatId = String(chat.chat_id);
        item.dataset.searchText = buildChatSearchText(chat);

        const avatar = document.createElement("div");
        avatar.className = "chat-avatar";
        avatar.textContent = window.SecureMessenger.ui.makeInitials(
            chat?.other_user?.username || chat?.other_user?.email || "C"
        );

        const body = document.createElement("div");
        body.className = "list-card__body";

        const header = document.createElement("div");
        header.className = "list-card__title-row";

        const title = document.createElement("strong");
        title.className = "list-card__title";
        title.textContent = chat?.other_user?.username || `Chat #${chat.chat_id}`;

        const time = document.createElement("span");
        time.className = "list-card__time";
        time.textContent = state.formatShortDateTime(
            chat.last_message_created_at || chat.created_at
        );

        const subtitle = document.createElement("p");
        subtitle.className = "list-card__meta list-card__meta--clamp";
        subtitle.textContent = normalizeChatPreview(chat);

        const footer = document.createElement("div");
        footer.className = "list-card__footer";

        const meta = document.createElement("span");
        meta.className = "list-card__caption";
        meta.textContent = chat?.other_user?.email || "direct chat";

        header.append(title, time);
        footer.append(meta);
        body.append(header, subtitle, footer);
        item.append(avatar, body);
        return item;
    }

    window.SecureMessenger = window.SecureMessenger || {};
    window.SecureMessenger.chatListPage = {
        normalizeChatPreview,
        buildChatSearchText,
        createChatCard,
    };
})();