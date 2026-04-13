(function () {
    function normalizeSearchValue(value) {
        return String(value || "").trim().toLowerCase();
    }

    function buildUserSearchText(user) {
        return [
            user?.username || "",
            user?.email || "",
        ]
            .join(" ")
            .toLowerCase();
    }

    function createUserCard(user, helpers = {}) {
        const item = document.createElement("article");
        item.className = "list-card user-card";
        item.dataset.userId = String(user.id);
        item.dataset.searchText = buildUserSearchText(user);

        const avatar = document.createElement("div");
        avatar.className = "chat-avatar";
        avatar.textContent = window.SecureMessenger.ui.makeInitials(user.username || user.email || "U");

        const body = document.createElement("div");
        body.className = "list-card__body";

        const titleRow = document.createElement("div");
        titleRow.className = "list-card__title-row";

        const title = document.createElement("strong");
        title.className = "list-card__title";
        title.textContent = user.username || "Без имени";

        const email = document.createElement("p");
        email.className = "list-card__meta";
        email.textContent = user.email || "—";

        const footer = document.createElement("div");
        footer.className = "list-card__footer";

        const createdAt = document.createElement("span");
        createdAt.className = "list-card__caption";
        createdAt.textContent = typeof helpers.formatDateTime === "function"
            ? `Создан: ${helpers.formatDateTime(user.created_at)}`
            : `Создан: ${user.created_at || "—"}`;

        const button = document.createElement("button");
        button.className = "btn btn--primary btn--sm";
        button.type = "button";
        button.textContent = helpers.existingChat ? "Открыть чат" : "Новый чат";
        button.dataset.action = "create-direct-chat";
        button.dataset.userId = String(user.id);

        titleRow.append(title);
        footer.append(createdAt, button);
        body.append(titleRow, email, footer);
        item.append(avatar, body);
        return item;
    }

    window.SecureMessenger = window.SecureMessenger || {};
    window.SecureMessenger.chatUsersPage = {
        normalizeSearchValue,
        buildUserSearchText,
        createUserCard,
    };
})();