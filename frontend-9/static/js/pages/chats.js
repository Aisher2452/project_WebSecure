document.addEventListener("DOMContentLoaded", async () => {
    const SM = window.SecureMessenger;
    const page = document.querySelector("[data-chats-page]");

    if (!SM || !page) {
        return;
    }

    const shell = document.querySelector("[data-messenger-shell]");
    const guestState = document.querySelector("[data-messenger-guest]");

    const chatsListElement = document.querySelector("[data-chats-list]");
    const chatsLoading = document.querySelector("[data-chats-loading]");
    const chatsError = document.querySelector("[data-chats-error]");
    const chatsEmpty = document.querySelector("[data-chats-empty]");
    const chatsSearch = document.querySelector("[data-chats-search]");
    const refreshChatsButton = document.querySelector("[data-refresh-chats-button]");

    const usersListElement = document.querySelector("[data-users-list]");
    const usersLoading = document.querySelector("[data-users-loading]");
    const usersError = document.querySelector("[data-users-error]");
    const usersEmpty = document.querySelector("[data-users-empty]");
    const usersSearch = document.querySelector("[data-users-search]");
    const refreshUsersButton = document.querySelector("[data-refresh-users-button]");
    const usersModal = document.querySelector("[data-users-modal]");
    const openUsersModalButton = document.querySelector("[data-open-users-modal-button]");
    const closeUsersModalButtons = document.querySelectorAll("[data-close-users-modal]");

    const placeholderState = document.querySelector("[data-chat-placeholder]");
    const chatLoadingState = document.querySelector("[data-chat-loading]");
    const chatViewState = document.querySelector("[data-chat-view]");
    const chatErrorState = document.querySelector("[data-chat-error]");
    const chatErrorText = document.querySelector("[data-chat-error-text]");
    const chatErrorInline = document.querySelector("[data-chat-error-inline]");

    const selectedChatAvatar = document.querySelector("[data-selected-chat-avatar]");
    const selectedChatName = document.querySelector("[data-selected-chat-name]");
    const selectedChatEmail = document.querySelector("[data-selected-chat-email]");
    const selectedChatCreatedAt = document.querySelector("[data-selected-chat-created-at]");
    const selectedChatLastMessage = document.querySelector("[data-selected-chat-last-message]");
    const selectedChatLastMessageAt = document.querySelector("[data-selected-chat-last-message-at]");
    const chatIdBadge = document.querySelector("[data-chat-id-badge]");
    const wsStatusBadge = document.querySelector("[data-ws-status-badge]");

    const messagesLoading = document.querySelector("[data-messages-loading]");
    const messagesError = document.querySelector("[data-messages-error]");
    const messagesErrorText = document.querySelector("[data-messages-error-text]");
    const messagesEmpty = document.querySelector("[data-messages-empty]");
    const messagesList = document.querySelector("[data-messages-list]");

    const messageForm = document.querySelector("[data-message-form]");
    const messageText = document.querySelector("[data-message-text]");
    const messageExpiration = document.querySelector("[data-message-expiration]");
    const messageFileInput = document.querySelector("[data-message-file-input]");
    const pickFileButton = document.querySelector("[data-pick-file-button]");
    const clearFileButton = document.querySelector("[data-clear-file-button]");
    const selectedFileBox = document.querySelector("[data-selected-file-box]");
    const selectedFileName = document.querySelector("[data-selected-file-name]");
    const selectedFileMeta = document.querySelector("[data-selected-file-meta]");
    const messageFormError = document.querySelector("[data-message-form-error]");
    const refreshHistoryButton = document.querySelector("[data-refresh-history-button]");
    const sendMessageButton = document.querySelector("[data-send-message-button]");

    const SESSION_SENDER_KEYS_STORAGE = "sm_chat_sender_keys_v1";

    const state = {
        currentUser: null,
        users: [],
        chats: [],
        selectedChatId: null,
        creatingUserId: null,
        messages: [],
        selectedFile: null,
        isSendingText: false,
        isSendingFile: false,
        historyRequestId: 0,
        localTextPreviewByMessageId: {},
        decryptedFileCacheByMessageId: {},
        senderEncryptedKeysByMessageId: readSenderKeysFromSession(),
        realtimeClient: null,
    };

    function readSenderKeysFromSession() {
        try {
            const rawValue = window.sessionStorage.getItem(SESSION_SENDER_KEYS_STORAGE);
            const parsed = rawValue ? JSON.parse(rawValue) : {};
            return parsed && typeof parsed === "object" ? parsed : {};
        } catch (error) {
            return {};
        }
    }

    function writeSenderKeysToSession() {
        try {
            window.sessionStorage.setItem(
                SESSION_SENDER_KEYS_STORAGE,
                JSON.stringify(state.senderEncryptedKeysByMessageId)
            );
        } catch (error) {
            // ignore sessionStorage quota / private mode errors
        }
    }

    function getLocalSenderEncryptedKey(messageId) {
        if (!messageId) {
            return null;
        }
    
        return state.senderEncryptedKeysByMessageId[String(messageId)] || null;
    }
    
    function saveLocalSenderEncryptedKey(messageId, encryptedKey) {
        if (!messageId || !encryptedKey) {
            return;
        }
    
        state.senderEncryptedKeysByMessageId[String(messageId)] = encryptedKey;
        writeSenderKeysToSession();
    }

    function enrichMessageWithLocalSenderKey(message) {
        if (!message?.id) {
            return message;
        }
    
        const isOwnMessage = String(message?.sender?.id) === String(state.currentUser?.id);
        if (!isOwnMessage) {
            return message;
        }
    
        const senderEncryptedKey = getLocalSenderEncryptedKey(message.id);
        if (!senderEncryptedKey) {
            return message;
        }
    
        return {
            ...message,
            local_sender_encrypted_key: senderEncryptedKey,
        };
    }

    function formatDateTime(value) {
        if (!value) {
            return "—";
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return String(value);
        }

        return new Intl.DateTimeFormat("ru-RU", {
            dateStyle: "medium",
            timeStyle: "short",
        }).format(date);
    }

    function formatShortDateTime(value) {
        if (!value) {
            return "—";
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return String(value);
        }

        return new Intl.DateTimeFormat("ru-RU", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        }).format(date);
    }

    function formatTime(value) {
        if (!value) {
            return "—";
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return String(value);
        }

        return new Intl.DateTimeFormat("ru-RU", {
            hour: "2-digit",
            minute: "2-digit",
        }).format(date);
    }

    function formatBytes(bytes) {
        const size = Number(bytes || 0);

        if (!size) {
            return "0 B";
        }

        const units = ["B", "KB", "MB", "GB"];
        let value = size;
        let unitIndex = 0;

        while (value >= 1024 && unitIndex < units.length - 1) {
            value /= 1024;
            unitIndex += 1;
        }

        return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
    }

    function showRootState(isAuthenticated) {
        shell?.classList.toggle("hidden", !isAuthenticated);
        guestState?.classList.toggle("hidden", isAuthenticated);
    }

    function showChatPanelState(target) {
        [placeholderState, chatLoadingState, chatViewState, chatErrorState].forEach((element) => {
            element?.classList.add("hidden");
        });

        target?.classList.remove("hidden");
    }

    function showMessagesState(target) {
        [messagesLoading, messagesError, messagesEmpty, messagesList].forEach((element) => {
            element?.classList.add("hidden");
        });

        target?.classList.remove("hidden");
    }

    function openUsersModal() {
        usersModal?.classList.remove("hidden");
        document.body.style.overflow = "hidden";
        usersSearch?.focus();
    }

    function closeUsersModal() {
        usersModal?.classList.add("hidden");
        document.body.style.overflow = "";
    }

    function syncUrl(chatId = null) {
        const url = new URL(window.location.href);

        if (chatId) {
            url.searchParams.set("chat", String(chatId));
        } else {
            url.searchParams.delete("chat");
        }

        window.history.replaceState({}, "", url);
    }

    function getChatFromState(chatId) {
        return state.chats.find((chat) => String(chat.chat_id) === String(chatId)) || null;
    }

    function getExistingChatByOtherUserId(userId) {
        return state.chats.find((chat) => String(chat?.other_user?.id) === String(userId)) || null;
    }

    function getSelectedChat() {
        return getChatFromState(state.selectedChatId);
    }

    function updateActiveChatCard() {
        const cards = chatsListElement?.querySelectorAll("[data-chat-id]") || [];

        cards.forEach((card) => {
            card.classList.toggle(
                "is-active",
                String(card.dataset.chatId) === String(state.selectedChatId)
            );
        });
    }

    function applyFilter(listElement, emptyElement, searchValue) {
        if (!listElement) {
            return;
        }

        const normalized = String(searchValue || "").trim().toLowerCase();
        const cards = Array.from(listElement.children);
        let visibleCount = 0;

        cards.forEach((card) => {
            const matches = !normalized || String(card.dataset.searchText || "").includes(normalized);
            card.classList.toggle("hidden", !matches);
            if (matches) {
                visibleCount += 1;
            }
        });

        if (cards.length > 0) {
            emptyElement?.classList.toggle("hidden", visibleCount > 0);
        }
    }

    function setCreateButtonLoading(userId, isLoading) {
        const button = usersListElement?.querySelector(`[data-action="create-direct-chat"][data-user-id="${userId}"]`);
        if (!button) {
            return;
        }
        SM.ui.setButtonLoading(button, isLoading, "Создаем...");
    }

    function setComposerDisabled(disabled) {
        [
            messageText,
            messageExpiration,
            pickFileButton,
            clearFileButton,
            refreshHistoryButton,
        ].forEach((element) => {
            if (element) {
                element.disabled = disabled;
            }
        });

        if (sendMessageButton) {
            sendMessageButton.disabled = disabled || state.isSendingText || state.isSendingFile;
        }
    }

    function updateSelectedFileUI() {
        const hasFile = Boolean(state.selectedFile);
        selectedFileBox?.classList.toggle("hidden", !hasFile);

        if (!hasFile) {
            if (selectedFileName) {
                selectedFileName.textContent = "Файл";
            }

            if (selectedFileMeta) {
                selectedFileMeta.textContent = "";
            }

            if (sendMessageButton) {
                sendMessageButton.disabled = !getSelectedChat() || state.isSendingText || state.isSendingFile;
            }
            return;
        }

        if (selectedFileName) {
            selectedFileName.textContent = state.selectedFile.name;
        }

        if (selectedFileMeta) {
            selectedFileMeta.textContent = formatBytes(state.selectedFile.size);
        }

        if (sendMessageButton) {
            sendMessageButton.disabled = !getSelectedChat() || state.isSendingText || state.isSendingFile;
        }
    }

    function setWsBadge(status, meta = {}) {
        if (!wsStatusBadge) {
            return;
        }

        wsStatusBadge.classList.remove(
            "status-badge--ws-connecting",
            "status-badge--ws-connected",
            "status-badge--ws-disconnected"
        );

        if (status === "connected") {
            wsStatusBadge.classList.add("status-badge--ws-connected");
            wsStatusBadge.textContent = "online";
            return;
        }

        if (status === "connecting") {
            wsStatusBadge.classList.add("status-badge--ws-connecting");
            wsStatusBadge.textContent = "connecting";
            return;
        }

        wsStatusBadge.classList.add("status-badge--ws-disconnected");
        wsStatusBadge.textContent = "offline";
    }

    function sortMessages(messages) {
        return [...messages].sort((left, right) => {
            const leftTime = new Date(left?.created_at || 0).getTime() || 0;
            const rightTime = new Date(right?.created_at || 0).getTime() || 0;
            return leftTime - rightTime;
        });
    }

    function mergeSessionTextPreview(message) {
        if (!message?.id) {
            return message;
        }
    
        const normalizedMessage = enrichMessageWithLocalSenderKey(message);
    
        return {
            ...normalizedMessage,
            local_preview_text: state.localTextPreviewByMessageId[normalizedMessage.id] || null,
            decrypted_file_ready: Boolean(state.decryptedFileCacheByMessageId[normalizedMessage.id]),
        };
    }

    function findMessageIndex(messageId, expectedChatId = null) {
        return state.messages.findIndex((message) => {
            const sameId = String(message?.id || message?.temp_id || "") === String(messageId);
            if (!sameId) {
                return false;
            }

            if (expectedChatId === null || expectedChatId === undefined) {
                return true;
            }

            return String(message?.chat_id || "") === String(expectedChatId);
        });
    }

    function getMessageById(messageId, expectedChatId = null) {
        const index = findMessageIndex(messageId, expectedChatId);
        return index >= 0 ? state.messages[index] : null;
    }

    function patchMessage(messageId, patch, expectedChatId = null) {
        const index = findMessageIndex(messageId, expectedChatId);
        if (index < 0) {
            return null;
        }

        const current = state.messages[index];
        const next = {
            ...current,
            ...(typeof patch === "function" ? patch(current) : patch),
        };

        state.messages.splice(index, 1, next);
        state.messages = sortMessages(state.messages);
        renderMessages();
        return next;
    }

    function syncChatPreviewFromMessage(message) {
        if (!message?.id || !message?.chat_id) {
            return;
        }

        const chatIndex = state.chats.findIndex((chat) => String(chat.chat_id) === String(message.chat_id));
        if (chatIndex < 0) {
            return;
        }

        const chat = state.chats[chatIndex];
        if (String(chat.last_message_id || "") !== String(message.id)) {
            return;
        }

        const nextChat = {
            ...chat,
            last_message_preview: SM.chatMessagesPage.getListPreviewFromMessage(message),
        };

        state.chats.splice(chatIndex, 1, nextChat);
        renderChats();

        if (String(state.selectedChatId) === String(message.chat_id)) {
            renderSelectedChat(nextChat);
        }
    }

    function canDecryptTextMessage(message) {
        return Boolean(
            SM.chatDecryptionPage?.canDecryptTextMessage?.(message, state.currentUser?.id)
        );
    }

    function canDecryptFileMessage(message) {
        return Boolean(
            SM.chatDecryptionPage?.canDecryptFileMessage?.(message, state.currentUser?.id)
        );
    }

    async function decryptTextMessageInState(messageId, options = {}) {
        const {
            expectedChatId = state.selectedChatId,
            expectedRequestId = null,
            force = false,
        } = options;
    
        const originalMessage = getMessageById(messageId, expectedChatId);
        const message = enrichMessageWithLocalSenderKey(originalMessage);
        if (!message || !message.id) {
            return null;
        }
    
        if (!force && (message.local_preview_text || !canDecryptTextMessage(message))) {
            return message;
        }
    
        patchMessage(messageId, {
            local_state: "decrypting",
            decryption_error: null,
        }, expectedChatId);
    
        try {
            const result = await SM.chatDecryptionPage.decryptTextMessage(message, {
                privateKey: SM.crypto?.getPrivateKey?.() || null,
            });
    
            if (
                expectedRequestId !== null
                && String(state.historyRequestId) !== String(expectedRequestId)
            ) {
                return null;
            }
    
            state.localTextPreviewByMessageId[message.id] = result.plainText;
    
            const nextMessage = patchMessage(messageId, {
                local_state: null,
                local_preview_text: result.plainText,
                decryption_error: null,
                decrypted_at: new Date().toISOString(),
            }, expectedChatId);
    
            if (nextMessage) {
                syncChatPreviewFromMessage(nextMessage);
            }
    
            return nextMessage;
        } catch (error) {
            return patchMessage(messageId, {
                local_state: null,
                decryption_error: error.message || "Не удалось расшифровать сообщение.",
            }, expectedChatId);
        }
    }

    async function decryptHistoryTextMessages(chatId, requestId) {
        const textMessages = state.messages.filter((message) => (
            String(message?.chat_id || "") === String(chatId)
            && message?.id
            && canDecryptTextMessage(message)
            && !message.local_preview_text
        ));

        for (const message of textMessages) {
            if (
                String(state.historyRequestId) !== String(requestId)
                || String(state.selectedChatId || "") !== String(chatId)
            ) {
                return;
            }

            await decryptTextMessageInState(message.id, {
                expectedChatId: chatId,
                expectedRequestId: requestId,
            });
        }
    }

    async function decryptAndDownloadFileInState(messageId) {
        const originalMessage = getMessageById(messageId, state.selectedChatId);
        const message = enrichMessageWithLocalSenderKey(originalMessage);
        if (!message || !message.id) {
            return null;
        }
    
        if (message.is_expired || message.status === "expired") {
            return patchMessage(messageId, {
                file_decryption_error: "Истекший файл нельзя расшифровать и скачать.",
            }, state.selectedChatId);
        }
    
        if (!canDecryptFileMessage(message)) {
            return patchMessage(messageId, {
                file_decryption_error: String(message?.sender?.id) === String(state.currentUser?.id)
                    ? "Это ваш исходящий файл. После отправки backend хранит только encrypted binary payload без plaintext-копии в браузере."
                    : "Для файла отсутствуют данные, необходимые для client-side decrypt.",
            }, state.selectedChatId);
        }
    
        patchMessage(messageId, {
            local_state: "file_decrypting",
            file_decryption_error: null,
        }, state.selectedChatId);
    
        try {
            const cached = state.decryptedFileCacheByMessageId[message.id];
            if (cached?.blob) {
                SM.chatDecryptionPage.downloadBlob(cached.blob, cached.fileName);
                return patchMessage(messageId, {
                    local_state: null,
                    file_decryption_error: null,
                    decrypted_file_ready: true,
                }, state.selectedChatId);
            }
    
            const result = await SM.chatDecryptionPage.decryptFileMessage(message, {
                privateKey: SM.crypto?.getPrivateKey?.() || null,
                getAccessToken: () => SM.storage.getAccessToken(),
            });
    
            state.decryptedFileCacheByMessageId[message.id] = {
                blob: result.blob,
                fileName: result.fileName,
            };
    
            SM.chatDecryptionPage.downloadBlob(result.blob, result.fileName);
    
            return patchMessage(messageId, {
                local_state: null,
                file_decryption_error: null,
                decrypted_file_ready: true,
                decrypted_file_name: result.fileName,
                decrypted_at: new Date().toISOString(),
            }, state.selectedChatId);
        } catch (error) {
            return patchMessage(messageId, {
                local_state: null,
                file_decryption_error: error.message || "Не удалось расшифровать файл.",
            }, state.selectedChatId);
        }
    }

    function renderChats() {
        if (!chatsListElement) {
            return;
        }

        chatsListElement.innerHTML = "";

        const fragment = document.createDocumentFragment();
        state.chats.forEach((chat) => {
            fragment.appendChild(
                SM.chatListPage.createChatCard(chat, {
                    formatShortDateTime,
                })
            );
        });

        chatsListElement.appendChild(fragment);

        const hasChats = state.chats.length > 0;
        chatsEmpty?.classList.toggle("hidden", hasChats);
        updateActiveChatCard();
        applyFilter(chatsListElement, chatsEmpty, chatsSearch?.value || "");
    }

    function renderUsers() {
        if (!usersListElement) {
            return;
        }

        usersListElement.innerHTML = "";

        const fragment = document.createDocumentFragment();
        const availableUsers = state.users.filter((user) => String(user?.id) !== String(state.currentUser?.id));

        availableUsers.forEach((user) => {
            fragment.appendChild(
                SM.chatUsersPage.createUserCard(user, {
                    formatDateTime,
                    currentUserId: state.currentUser?.id,
                    existingChat: getExistingChatByOtherUserId(user.id),
                })
            );
        });

        usersListElement.appendChild(fragment);

        const hasUsers = availableUsers.length > 0;
        usersEmpty?.classList.toggle("hidden", hasUsers);
        applyFilter(usersListElement, usersEmpty, usersSearch?.value || "");
    }

    function renderSelectedChat(chat) {
        if (!chat) {
            state.selectedChatId = null;
            syncUrl(null);
            updateActiveChatCard();
            setComposerDisabled(true);
            setWsBadge("disconnected", { reason: "Чат не выбран" });
            state.realtimeClient?.disconnect();
            showChatPanelState(placeholderState);
            return;
        }

        state.selectedChatId = chat.chat_id;
        syncUrl(chat.chat_id);
        updateActiveChatCard();

        if (selectedChatAvatar) {
            selectedChatAvatar.textContent = SM.ui.makeInitials(
                chat?.other_user?.username || chat?.other_user?.email || "C"
            );
        }

        if (selectedChatName) {
            selectedChatName.textContent = chat?.other_user?.username || `Chat #${chat.chat_id}`;
        }

        if (selectedChatEmail) {
            selectedChatEmail.textContent = chat?.other_user?.email || "—";
        }

        if (selectedChatCreatedAt) {
            selectedChatCreatedAt.textContent = formatDateTime(chat.created_at);
        }

        if (selectedChatLastMessage) {
            selectedChatLastMessage.textContent = SM.chatListPage.normalizeChatPreview(chat);
        }

        if (selectedChatLastMessageAt) {
            selectedChatLastMessageAt.textContent = chat.last_message_created_at
                ? formatDateTime(chat.last_message_created_at)
                : "—";
        }

        if (chatIdBadge) {
            chatIdBadge.textContent = `Chat #${chat.chat_id}`;
        }

        setComposerDisabled(false);
        updateSelectedFileUI();
        showChatPanelState(chatViewState);
    }

    function renderMessages() {
        if (!messagesList) {
            return;
        }
    
        messagesList.innerHTML = "";
    
        const selectedChatId = String(state.selectedChatId || "");
        const visibleMessages = state.messages.filter(
            (message) => String(message?.chat_id || "") === selectedChatId
        );
    
        if (!visibleMessages.length) {
            showMessagesState(messagesEmpty);
            return;
        }
    
        const fragment = document.createDocumentFragment();
        visibleMessages.forEach((message) => {
            fragment.appendChild(
                SM.chatMessagesPage.createMessageBubble(message, {
                    currentUserId: state.currentUser?.id,
                    formatDateTime,
                    formatTime,
                    formatBytes,
                })
            );
        });
    
        messagesList.appendChild(fragment);
        showMessagesState(messagesList);
        messagesList.scrollTop = messagesList.scrollHeight;
    }

    function updateChatSummary(chatId, message) {
        const chatIndex = state.chats.findIndex((item) => String(item.chat_id) === String(chatId));

        if (chatIndex < 0 || !message) {
            return;
        }

        const current = state.chats[chatIndex];
        const next = {
            ...current,
            last_message_id: message.id || current.last_message_id,
            last_message_preview: SM.chatMessagesPage.getListPreviewFromMessage(message),
            last_message_created_at: message.created_at || current.last_message_created_at,
        };

        state.chats.splice(chatIndex, 1);
        state.chats.unshift(next);
        renderChats();

        if (String(state.selectedChatId) === String(chatId)) {
            renderSelectedChat(next);
        }
    }

    function updateChatPreviewForExpiredMessage(chatId, messageId) {
        const chatIndex = state.chats.findIndex((item) => String(item.chat_id) === String(chatId));

        if (chatIndex < 0) {
            return;
        }

        const current = state.chats[chatIndex];

        if (String(current.last_message_id) !== String(messageId)) {
            return;
        }

        const next = {
            ...current,
            last_message_preview: "Сообщение истекло",
        };

        state.chats.splice(chatIndex, 1, next);
        renderChats();

        if (String(state.selectedChatId) === String(chatId)) {
            renderSelectedChat(next);
        }
    }

    function findMatchingTempMessageIndex(serverMessage) {
        const isOwnMessage = String(serverMessage?.sender?.id) === String(state.currentUser?.id);

        if (!isOwnMessage) {
            return -1;
        }

        return state.messages.findIndex((message) => {
            if (!message.temp_id) {
                return false;
            }

            if (message.message_type !== serverMessage.message_type) {
                return false;
            }

            if (serverMessage.message_type === "text") {
                return message.iv && message.ciphertext
                    && message.iv === serverMessage.iv
                    && message.ciphertext === serverMessage.ciphertext;
            }

            return Boolean(
                (message.iv && serverMessage.iv && message.iv === serverMessage.iv)
                || (
                    (message.file_name || message.local_file_name) === serverMessage.file_name
                    && Number(message.file_size || message.local_file_size || 0) === Number(serverMessage.file_size || 0)
                )
            );
        });
    }

    function upsertServerMessage(serverMessage) {
        if (!serverMessage) {
            return null;
        }

        const normalizedMessage = mergeSessionTextPreview(serverMessage);

        if (normalizedMessage?.id) {
            const existingByIdIndex = state.messages.findIndex(
                (message) => String(message.id) === String(normalizedMessage.id)
            );

            if (existingByIdIndex >= 0) {
                const existingMessage = state.messages[existingByIdIndex];
                const nextMessage = {
                    ...existingMessage,
                    ...normalizedMessage,
                    local_state: null,
                    local_preview_text: normalizedMessage.local_preview_text
                        || existingMessage.local_preview_text
                        || state.localTextPreviewByMessageId[normalizedMessage.id]
                        || null,
                };

                state.messages.splice(existingByIdIndex, 1, nextMessage);
                state.messages = sortMessages(state.messages);
                renderMessages();
                return nextMessage;
            }
        }

        const tempIndex = findMatchingTempMessageIndex(normalizedMessage);

        if (tempIndex >= 0) {
            const tempMessage = state.messages[tempIndex];

            if (tempMessage.local_preview_text && normalizedMessage.id) {
                state.localTextPreviewByMessageId[normalizedMessage.id] = tempMessage.local_preview_text;
            }

            const nextMessage = {
                ...tempMessage,
                ...normalizedMessage,
                local_state: null,
                local_preview_text: normalizedMessage.local_preview_text
                    || tempMessage.local_preview_text
                    || state.localTextPreviewByMessageId[normalizedMessage.id]
                    || null,
            };

            state.messages.splice(tempIndex, 1, nextMessage);
            state.messages = sortMessages(state.messages);
            renderMessages();
            return nextMessage;
        }

        const nextMessage = {
            ...normalizedMessage,
            local_state: normalizedMessage.local_state || null,
        };

        state.messages = sortMessages([...state.messages, nextMessage]);
        renderMessages();
        return nextMessage;
    }

    function applyStatusToMessages(messageIds, status) {
        const normalizedIds = new Set((messageIds || []).map((id) => String(id)));

        if (!normalizedIds.size) {
            return;
        }

        const now = new Date().toISOString();
        let hasChanges = false;

        state.messages = state.messages.map((message) => {
            if (!message?.id || !normalizedIds.has(String(message.id))) {
                return message;
            }

            hasChanges = true;

            return {
                ...message,
                status,
                local_state: null,
                delivered_at: status === "delivered" ? (message.delivered_at || now) : message.delivered_at,
                read_at: status === "read" ? (message.read_at || now) : message.read_at,
            };
        });

        if (hasChanges) {
            renderMessages();
        }
    }

    function markMessageExpired(messageId, chatId) {
        let hasChanges = false;

        state.messages = state.messages.map((message) => {
            if (String(message?.id) !== String(messageId)) {
                return message;
            }

            hasChanges = true;

            return {
                ...message,
                status: "expired",
                is_expired: true,
                local_state: null,
            };
        });

        if (hasChanges) {
            renderMessages();
        }

        updateChatPreviewForExpiredMessage(chatId, messageId);
    }

    function mergeHistoryWithCurrentState(historyMessages, chatId) {
        const normalizedChatId = String(chatId);
        const itemsById = new Map();
        const tempMessages = [];
    
        historyMessages.forEach((message) => {
            if (message?.id) {
                itemsById.set(String(message.id), message);
            }
        });
    
        state.messages.forEach((message) => {
            if (String(message?.chat_id || "") !== normalizedChatId) {
                return;
            }
    
            if (message?.temp_id && !message?.id) {
                tempMessages.push(message);
                return;
            }
    
            if (!message?.id) {
                return;
            }
    
            const key = String(message.id);
            const fromHistory = itemsById.get(key) || {};
            itemsById.set(key, {
                ...fromHistory,
                ...message,
                local_preview_text: message.local_preview_text
                    || fromHistory.local_preview_text
                    || state.localTextPreviewByMessageId[message.id]
                    || null,
            });
        });
    
        return sortMessages([
            ...itemsById.values(),
            ...tempMessages,
        ]);
    }

    function getReadableIncomingMessageIds() {
        return state.messages
            .filter((message) => (
                message?.id
                && String(message?.chat_id || "") === String(state.selectedChatId || "")
                && String(message?.sender?.id) !== String(state.currentUser?.id)
                && !message.is_expired
                && message.status !== "expired"
                && message.status !== "read"
            ))
            .map((message) => Number(message.id))
            .filter((id) => Number.isFinite(id));
    }

    function syncReadState() {
        const messageIds = getReadableIncomingMessageIds();
        if (!messageIds.length) {
            return;
        }
        state.realtimeClient?.markRead(messageIds);
    }

    async function loadChats({ preserveSelection = true } = {}) {
        chatsLoading?.classList.remove("hidden");
        SM.ui.hideAlert(chatsError);

        try {
            const chats = await SM.chatApi.listChats();
            state.chats = Array.isArray(chats) ? chats : [];
            renderChats();

            const requestedChatId = new URLSearchParams(window.location.search).get("chat");
            const preferredChatId = preserveSelection ? state.selectedChatId || requestedChatId : requestedChatId;
            const selectedChat = preferredChatId ? getChatFromState(preferredChatId) : null;

            if (selectedChat) {
                await openChat(selectedChat.chat_id, { showLoader: false });
            } else if (state.selectedChatId && !getChatFromState(state.selectedChatId)) {
                renderSelectedChat(null);
            } else if (!state.selectedChatId && requestedChatId && !selectedChat) {
                showChatPanelState(chatErrorState);
                if (chatErrorText) {
                    chatErrorText.textContent = `Чат #${requestedChatId} не найден в вашем списке.`;
                }
            } else if (!state.selectedChatId) {
                showChatPanelState(placeholderState);
            }
        } catch (error) {
            state.chats = [];
            renderChats();
            SM.ui.showAlert(
                chatsError,
                error.message || "Не удалось загрузить список чатов."
            );
        } finally {
            chatsLoading?.classList.add("hidden");
        }
    }

    async function loadUsers() {
        usersLoading?.classList.remove("hidden");
        SM.ui.hideAlert(usersError);

        try {
            const users = await SM.usersApi.listUsers();
            state.users = Array.isArray(users) ? users : [];
            renderUsers();
        } catch (error) {
            state.users = [];
            renderUsers();
            SM.ui.showAlert(
                usersError,
                error.message || "Не удалось загрузить список пользователей."
            );
        } finally {
            usersLoading?.classList.add("hidden");
        }
    }

    function createTempTextMessage(plainText, expirationType) {
        return {
            temp_id: `temp-text-${Date.now()}`,
            chat_id: state.selectedChatId,
            sender: {
                id: state.currentUser?.id,
                username: state.currentUser?.username || "Вы",
            },
            message_type: "text",
            status: "sent",
            ciphertext: "",
            encrypted_key: "",
            iv: "",
            expiration_type: expirationType,
            expires_at: null,
            is_expired: false,
            created_at: new Date().toISOString(),
            local_state: "encrypting",
            local_preview_text: plainText,
        };
    }

    function createTempFileMessage(file, expirationType) {
        return {
            temp_id: `temp-file-${Date.now()}`,
            chat_id: state.selectedChatId,
            sender: {
                id: state.currentUser?.id,
                username: state.currentUser?.username || "Вы",
            },
            message_type: "file",
            status: "sent",
            encrypted_key: "",
            iv: "",
            file_name: file.name,
            file_size: file.size,
            mime_type: file.type || "application/octet-stream",
            expiration_type: expirationType,
            expires_at: null,
            is_expired: false,
            created_at: new Date().toISOString(),
            local_state: "uploading",
            local_file_name: file.name,
            local_file_size: file.size,
            local_file_type: file.type || "application/octet-stream",
        };
    }

    function addTempMessage(tempMessage) {
        state.messages = sortMessages([...state.messages, tempMessage]);
        renderMessages();
        return tempMessage.temp_id;
    }

    function replaceTempMessage(tempId, nextMessage) {
        const tempIndex = state.messages.findIndex((message) => message.temp_id === tempId);

        if (tempIndex < 0) {
            upsertServerMessage(nextMessage);
            return;
        }

        const tempMessage = state.messages[tempIndex];
        const normalizedMessage = mergeSessionTextPreview(nextMessage);

        if (tempMessage.local_preview_text && normalizedMessage?.id) {
            state.localTextPreviewByMessageId[normalizedMessage.id] = tempMessage.local_preview_text;
        }

        state.messages.splice(tempIndex, 1, {
            ...tempMessage,
            ...normalizedMessage,
            local_state: null,
            local_preview_text: normalizedMessage.local_preview_text
                || tempMessage.local_preview_text
                || state.localTextPreviewByMessageId[normalizedMessage.id]
                || null,
        });
        state.messages = sortMessages(state.messages);
        renderMessages();
    }

    function removeTempMessage(tempId) {
        state.messages = state.messages.filter((message) => message.temp_id !== tempId);
        renderMessages();
    }

    async function loadMessages(chatId) {
        const requestId = Date.now();
        state.historyRequestId = requestId;
        showMessagesState(messagesLoading);
        SM.ui.hideAlert(chatErrorInline);

        try {
            const payload = await SM.chatApi.getMessages(chatId);
            if (state.historyRequestId !== requestId) {
                return;
            }

            const historyMessages = SM.chatMessagesPage
                .normalizeHistoryResponse(payload)
                .map(mergeSessionTextPreview)
                .map((message) => {
                    if (canDecryptTextMessage(message) && !message.local_preview_text) {
                        return {
                            ...message,
                            local_state: "decrypting",
                            decryption_error: null,
                        };
                    }

                    return message;
                });

            state.messages = mergeHistoryWithCurrentState(historyMessages, chatId);
            renderMessages();
            syncReadState();
            await decryptHistoryTextMessages(chatId, requestId);
        } catch (error) {
            if (state.historyRequestId !== requestId) {
                return;
            }
            state.messages = [];
            if (messagesErrorText) {
                messagesErrorText.textContent = error.message || "Не удалось загрузить историю сообщений.";
            }
            showMessagesState(messagesError);
        }
    }

    async function openChat(chatId, options = {}) {
        const { showLoader = true } = options;
        const chat = getChatFromState(chatId);

        if (!chat) {
            showChatPanelState(chatErrorState);
            if (chatErrorText) {
                chatErrorText.textContent = `Чат #${chatId} не найден.`;
            }
            return;
        }

        if (showLoader) {
            showChatPanelState(chatLoadingState);
        }

        renderSelectedChat(chat);
        state.realtimeClient?.switchChat(chat.chat_id);
        await loadMessages(chat.chat_id);
    }

    async function createDirectChat(otherUserId) {
        if (state.creatingUserId) {
            return;
        }

        state.creatingUserId = otherUserId;
        setCreateButtonLoading(otherUserId, true);
        SM.ui.hideAlert(usersError);
        showChatPanelState(chatLoadingState);

        try {
            const existingChat = getExistingChatByOtherUserId(otherUserId);
            const payload = await SM.chatDirectPage.createDirectChat(otherUserId);
            const chatItem = SM.chatDirectPage.mapDirectChatResponseToListItem(payload, existingChat);

            const existingIndex = state.chats.findIndex((chat) => String(chat.chat_id) === String(chatItem.chat_id));
            if (existingIndex >= 0) {
                state.chats.splice(existingIndex, 1, {
                    ...state.chats[existingIndex],
                    ...chatItem,
                });
            } else {
                state.chats.unshift(chatItem);
            }

            renderChats();
            closeUsersModal();
            await openChat(chatItem.chat_id);
        } catch (error) {
            showChatPanelState(chatErrorState);
            if (chatErrorText) {
                chatErrorText.textContent = error.message || "Не удалось создать direct chat.";
            }
            SM.ui.showAlert(
                usersError,
                error.message || "Не удалось создать direct chat."
            );
        } finally {
            state.creatingUserId = null;
            setCreateButtonLoading(otherUserId, false);
        }
    }

    async function handleSendTextMessage() {
        const chat = getSelectedChat();
        const plainText = String(messageText?.value || "").trim();
        const expirationType = messageExpiration?.value || "none";
    
        if (!chat) {
            throw new Error("Сначала выберите чат.");
        }
    
        if (!plainText) {
            throw new Error("Введите текст сообщения.");
        }
    
        if (!chat?.other_user?.public_key) {
            throw new Error("У собеседника отсутствует public key.");
        }
    
        state.isSendingText = true;
        if (sendMessageButton) {
            SM.ui.setButtonLoading(sendMessageButton, true, "...");
        }
        setComposerDisabled(false);
        SM.ui.hideAlert(messageFormError);
    
        const tempId = addTempMessage(createTempTextMessage(plainText, expirationType));
    
        try {
            const encrypted = await SM.crypto.aes.encryptText(plainText);
            const encryptedKey = await SM.crypto.aes.wrapAesKeyWithPublicKey(
                chat.other_user.public_key,
                encrypted.key
            );
            const senderPublicKeyPem = SM.crypto?.getPublicKeyPem?.() || state.currentUser?.public_key || null;
            const localSenderEncryptedKey = senderPublicKeyPem
                ? await SM.crypto.aes.wrapAesKeyWithPublicKey(senderPublicKeyPem, encrypted.key)
                : null;
    
            state.messages = state.messages.map((message) => (
                message.temp_id === tempId
                    ? {
                        ...message,
                        ciphertext: encrypted.ciphertext,
                        encrypted_key: encryptedKey,
                        local_sender_encrypted_key: localSenderEncryptedKey,
                        iv: encrypted.iv,
                        local_state: "sending",
                    }
                    : message
            ));
            renderMessages();
    
            const response = await SM.chatApi.sendTextMessage(chat.chat_id, {
                ciphertext: encrypted.ciphertext,
                encrypted_key: encryptedKey,
                iv: encrypted.iv,
                expiration_type: expirationType,
            });
    
            state.localTextPreviewByMessageId[response.id] = plainText;
            saveLocalSenderEncryptedKey(response.id, localSenderEncryptedKey);
            replaceTempMessage(tempId, {
                ...response,
                local_preview_text: plainText,
                local_sender_encrypted_key: localSenderEncryptedKey,
            });
            updateChatSummary(chat.chat_id, response);
            messageText.value = "";
        } catch (error) {
            removeTempMessage(tempId);
            throw error;
        } finally {
            state.isSendingText = false;
            if (sendMessageButton) {
                SM.ui.setButtonLoading(sendMessageButton, false, "...");
            }
            setComposerDisabled(false);
            updateSelectedFileUI();
        }
    }

    async function handleSendFileMessage() {
        const chat = getSelectedChat();
        const file = state.selectedFile;
        const expirationType = messageExpiration?.value || "none";
    
        if (!chat) {
            throw new Error("Сначала выберите чат.");
        }
    
        if (!file) {
            throw new Error("Выберите файл для отправки.");
        }
    
        if (!chat?.other_user?.public_key) {
            throw new Error("У собеседника отсутствует public key.");
        }
    
        state.isSendingFile = true;
        if (sendMessageButton) {
            SM.ui.setButtonLoading(sendMessageButton, true, "...");
        }
        setComposerDisabled(false);
        SM.ui.hideAlert(messageFormError);
    
        const tempId = addTempMessage(createTempFileMessage(file, expirationType));
    
        try {
            const senderPublicKeyPem = SM.crypto?.getPublicKeyPem?.() || state.currentUser?.public_key || null;
            const encryptedPayload = await SM.chatFileHelpers.createEncryptedFilePayload(
                file,
                chat.other_user.public_key,
                expirationType,
                senderPublicKeyPem
            );
    
            state.messages = state.messages.map((message) => (
                message.temp_id === tempId
                    ? {
                        ...message,
                        encrypted_key: encryptedPayload.messageMeta.encrypted_key,
                        local_sender_encrypted_key: encryptedPayload.messageMeta.local_sender_encrypted_key,
                        iv: encryptedPayload.messageMeta.iv,
                        file_size: encryptedPayload.messageMeta.file_size,
                        mime_type: encryptedPayload.messageMeta.mime_type,
                    }
                    : message
            ));
            renderMessages();
    
            const response = await SM.chatApi.sendFileMessage(chat.chat_id, encryptedPayload.formData);
            saveLocalSenderEncryptedKey(response.id, encryptedPayload.messageMeta.local_sender_encrypted_key);
            replaceTempMessage(tempId, {
                ...response,
                local_sender_encrypted_key: encryptedPayload.messageMeta.local_sender_encrypted_key,
            });
            updateChatSummary(chat.chat_id, response);
    
            state.selectedFile = null;
            if (messageFileInput) {
                messageFileInput.value = "";
            }
            updateSelectedFileUI();
        } catch (error) {
            removeTempMessage(tempId);
            throw error;
        } finally {
            state.isSendingFile = false;
            if (sendMessageButton) {
                SM.ui.setButtonLoading(sendMessageButton, false, "...");
            }
            setComposerDisabled(false);
            updateSelectedFileUI();
        }
    }

    async function handleRealtimeNewMessage(message) {
        if (!message || String(message.chat_id) !== String(state.selectedChatId)) {
            return;
        }

        const nextMessage = upsertServerMessage(message);
        updateChatSummary(message.chat_id, nextMessage || message);

        if (nextMessage?.id && canDecryptTextMessage(nextMessage) && !nextMessage.local_preview_text) {
            await decryptTextMessageInState(nextMessage.id, {
                expectedChatId: nextMessage.chat_id,
            });
        }

        const isIncoming = String(message?.sender?.id) !== String(state.currentUser?.id);
        if (isIncoming) {
            syncReadState();
        }
    }

    function handleRealtimeDelivered(data) {
        if (!data || String(data.chat_id) !== String(state.selectedChatId)) {
            return;
        }

        applyStatusToMessages(data.message_ids || [], data.status || "delivered");
    }

    function handleRealtimeStatusUpdated(data) {
        if (!data || String(data.chat_id) !== String(state.selectedChatId)) {
            return;
        }

        applyStatusToMessages(data.message_ids || [], data.status || "read");
    }

    function handleRealtimeExpired(data) {
        if (!data || String(data.chat_id) !== String(state.selectedChatId)) {
            return;
        }

        markMessageExpired(data.message_id, data.chat_id);
    }

    chatsSearch?.addEventListener("input", (event) => {
        applyFilter(chatsListElement, chatsEmpty, event.target.value);
    });

    usersSearch?.addEventListener("input", (event) => {
        applyFilter(usersListElement, usersEmpty, event.target.value);
    });

    openUsersModalButton?.addEventListener("click", async () => {
        openUsersModal();
        if (!state.users.length) {
            await loadUsers();
        }
    });

    closeUsersModalButtons.forEach((button) => {
        button.addEventListener("click", closeUsersModal);
    });

    refreshChatsButton?.addEventListener("click", () => {
        loadChats();
    });

    refreshUsersButton?.addEventListener("click", () => {
        loadUsers();
    });

    refreshHistoryButton?.addEventListener("click", async () => {
        if (!state.selectedChatId) {
            return;
        }
        await loadMessages(state.selectedChatId);
    });

    chatsListElement?.addEventListener("click", async (event) => {
        const card = event.target.closest("[data-chat-id]");
        if (!card) {
            return;
        }

        await openChat(card.dataset.chatId);
    });

    usersListElement?.addEventListener("click", async (event) => {
        const button = event.target.closest('[data-action="create-direct-chat"]');
        if (!button) {
            return;
        }

        await createDirectChat(button.dataset.userId);
    });

    messagesList?.addEventListener("click", async (event) => {
        const button = event.target.closest("[data-action][data-message-id]");
        if (!button) {
            return;
        }

        const { action, messageId } = button.dataset;
        if (!action || !messageId) {
            return;
        }

        if (action === "retry-text-decrypt") {
            await decryptTextMessageInState(messageId, {
                expectedChatId: state.selectedChatId,
                force: true,
            });
            return;
        }

        if (action === "decrypt-download-file") {
            await decryptAndDownloadFileInState(messageId);
        }
    });

    pickFileButton?.addEventListener("click", () => {
        messageFileInput?.click();
    });

    clearFileButton?.addEventListener("click", () => {
        state.selectedFile = null;
        if (messageFileInput) {
            messageFileInput.value = "";
        }
        updateSelectedFileUI();
    });

    messageFileInput?.addEventListener("change", (event) => {
        const file = event.target.files?.[0] || null;
        state.selectedFile = file;
        updateSelectedFileUI();
    });

    messageForm?.addEventListener("submit", async (event) => {
        event.preventDefault();

        try {
            const hasText = Boolean(String(messageText?.value || "").trim());
            const hasFile = Boolean(state.selectedFile);

            if (!hasText && !hasFile) {
                throw new Error("Введите сообщение или выберите файл.");
            }

            if (hasText) {
                await handleSendTextMessage();
            }

            if (hasFile) {
                await handleSendFileMessage();
            }
        } catch (error) {
            SM.ui.showAlert(
                messageFormError,
                error.message || "Не удалось отправить сообщение."
            );
        }
    });

    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
            syncReadState();
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeUsersModal();
        }
    });

    window.addEventListener("beforeunload", () => {
        state.realtimeClient?.disconnect();
    });

    if (!SM.auth.isAuthenticated()) {
        showRootState(false);
        return;
    }

    try {
        await SM.crypto?.restoreSession?.();
        state.currentUser = await SM.auth.getCurrentUser(true);
        state.realtimeClient = SM.chatRealtimePage.createChatRealtimeClient({
            getAccessToken: () => SM.storage.getAccessToken(),
            onStateChange: (status, meta) => {
                if (String(meta?.chatId || "") !== String(state.selectedChatId || "") && status !== "disconnected") {
                    return;
                }

                setWsBadge(status, meta);

                if (status === "connected") {
                    syncReadState();
                }
            },
            onNewMessage: handleRealtimeNewMessage,
            onMessagesDelivered: handleRealtimeDelivered,
            onMessageStatusUpdated: handleRealtimeStatusUpdated,
            onMessageExpired: handleRealtimeExpired,
        });
        showRootState(true);
        showChatPanelState(placeholderState);
        updateSelectedFileUI();
        setComposerDisabled(true);
        setWsBadge("disconnected", { reason: "Чат не выбран" });
        await Promise.all([loadChats({ preserveSelection: false }), loadUsers()]);
    } catch (error) {
        state.realtimeClient?.disconnect();
        SM.auth.logout();
        showRootState(false);
    }
});
