(function () {
    function buildWsUrl(path) {
        const apiBaseUrl = document.body?.dataset?.apiBaseUrl || "";
        const normalizedApiBaseUrl = apiBaseUrl.endsWith("/") ? apiBaseUrl.slice(0, -1) : apiBaseUrl;
        const normalizedPath = path.startsWith("/") ? path : `/${path}`;

        if (normalizedApiBaseUrl.startsWith("https://")) {
            return `wss://${normalizedApiBaseUrl.slice("https://".length)}${normalizedPath}`;
        }

        if (normalizedApiBaseUrl.startsWith("http://")) {
            return `ws://${normalizedApiBaseUrl.slice("http://".length)}${normalizedPath}`;
        }

        return `${normalizedApiBaseUrl}${normalizedPath}`;
    }

    function createChatRealtimeClient(options = {}) {
        const SM = window.SecureMessenger;
        const PING_INTERVAL_MS = 25000;
        const RECONNECT_DELAY_MS = 2000;

        let socket = null;
        let currentChatId = null;
        let connectAttemptId = 0;
        let reconnectTimerId = null;
        let pingTimerId = null;
        let shouldReconnect = false;
        let hasRefreshRetry = false;

        function clearReconnectTimer() {
            if (reconnectTimerId) {
                window.clearTimeout(reconnectTimerId);
                reconnectTimerId = null;
            }
        }

        function clearPingTimer() {
            if (pingTimerId) {
                window.clearInterval(pingTimerId);
                pingTimerId = null;
            }
        }

        function notifyState(status, meta = {}) {
            options.onStateChange?.(status, {
                chatId: currentChatId,
                ...meta,
            });
        }

        function safeClose(code = 1000, reason = "Normal close") {
            if (!socket) {
                return;
            }

            const activeSocket = socket;
            socket = null;

            try {
                activeSocket.close(code, reason);
            } catch (error) {
                // ignore close errors
            }
        }

        function scheduleReconnect(reason = "Соединение потеряно") {
            clearReconnectTimer();
            clearPingTimer();

            if (!shouldReconnect || !currentChatId) {
                return;
            }

            notifyState("disconnected", { reason });
            reconnectTimerId = window.setTimeout(() => {
                connect(currentChatId);
            }, RECONNECT_DELAY_MS);
        }

        async function resolveAccessToken() {
            const currentToken = options.getAccessToken?.() || SM.storage.getAccessToken();
            if (currentToken) {
                return currentToken;
            }

            if (!SM.storage.getRefreshToken()) {
                return null;
            }

            return SM.api.refreshAccessToken();
        }

        function startPingLoop() {
            clearPingTimer();
            pingTimerId = window.setInterval(() => {
                if (!socket || socket.readyState !== WebSocket.OPEN) {
                    return;
                }

                socket.send(JSON.stringify({
                    event: "ping",
                    data: {
                        timestamp: new Date().toISOString(),
                    },
                }));
            }, PING_INTERVAL_MS);
        }

        async function connect(chatId) {
            if (!chatId) {
                return;
            }

            connectAttemptId += 1;
            const attemptId = connectAttemptId;
            currentChatId = chatId;
            shouldReconnect = true;
            clearReconnectTimer();
            clearPingTimer();
            notifyState("connecting");

            const accessToken = await resolveAccessToken();

            if (attemptId !== connectAttemptId) {
                return;
            }

            if (!accessToken) {
                notifyState("disconnected", { reason: "Access token не найден" });
                return;
            }

            const wsUrl = buildWsUrl(`/ws/chats/${chatId}?token=${encodeURIComponent(accessToken)}`);

            safeClose(1000, "Switching connection");

            try {
                socket = new WebSocket(wsUrl);
            } catch (error) {
                scheduleReconnect("Не удалось открыть WebSocket");
                return;
            }

            socket.addEventListener("open", () => {
                if (attemptId !== connectAttemptId || !socket) {
                    return;
                }

                hasRefreshRetry = false;
                notifyState("connected");
                startPingLoop();
            });

            socket.addEventListener("message", (event) => {
                let payload = null;

                try {
                    payload = JSON.parse(event.data);
                } catch (error) {
                    return;
                }

                const eventName = payload?.event;
                const data = payload?.data || {};

                if (eventName === "connected" || eventName === "pong") {
                    notifyState("connected");
                    return;
                }

                if (eventName === "new_message") {
                    options.onNewMessage?.(data);
                    return;
                }

                if (eventName === "messages_delivered") {
                    options.onMessagesDelivered?.(data);
                    return;
                }

                if (eventName === "message_status_updated") {
                    options.onMessageStatusUpdated?.(data);
                    return;
                }

                if (eventName === "message_expired") {
                    options.onMessageExpired?.(data);
                    return;
                }

                if (eventName === "notification") {
                    options.onNotification?.(data);
                    return;
                }

                if (eventName === "error") {
                    options.onError?.(data);
                }
            });

            socket.addEventListener("close", async (event) => {
                clearPingTimer();

                if (attemptId !== connectAttemptId) {
                    return;
                }

                socket = null;

                if (!shouldReconnect || !currentChatId) {
                    notifyState("disconnected", { reason: "WebSocket закрыт" });
                    return;
                }

                const canRetryWithRefresh = !hasRefreshRetry
                    && [1008, 1006, 1011].includes(event.code)
                    && Boolean(SM.storage.getRefreshToken());

                if (canRetryWithRefresh) {
                    hasRefreshRetry = true;

                    try {
                        await SM.api.refreshAccessToken();
                        if (attemptId === connectAttemptId && currentChatId) {
                            connect(currentChatId);
                            return;
                        }
                    } catch (error) {
                        // fallback to regular reconnect below
                    }
                }

                scheduleReconnect(event.reason || `WebSocket closed (${event.code})`);
            });

            socket.addEventListener("error", () => {
                notifyState("disconnected", { reason: "WebSocket error" });
            });
        }

        function switchChat(chatId) {
            if (!chatId) {
                disconnect();
                return;
            }

            if (
                String(currentChatId) === String(chatId)
                && socket
                && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)
            ) {
                return;
            }

            connect(chatId);
        }

        function disconnect() {
            shouldReconnect = false;
            currentChatId = null;
            connectAttemptId += 1;
            clearReconnectTimer();
            clearPingTimer();
            safeClose(1000, "Disconnect requested");
            notifyState("disconnected", { reason: "Чат не выбран" });
        }

        function markRead(messageIds = []) {
            const normalizedIds = Array.from(new Set(
                messageIds
                    .map((id) => Number(id))
                    .filter((id) => Number.isFinite(id) && id > 0)
            ));

            if (!normalizedIds.length) {
                return;
            }

            if (!socket || socket.readyState !== WebSocket.OPEN) {
                return;
            }

            socket.send(JSON.stringify({
                event: "mark_read",
                data: {
                    message_ids: normalizedIds,
                },
            }));
        }

        return {
            switchChat,
            disconnect,
            markRead,
            isConnected() {
                return Boolean(socket && socket.readyState === WebSocket.OPEN);
            },
            getCurrentChatId() {
                return currentChatId;
            },
        };
    }

    window.SecureMessenger = window.SecureMessenger || {};
    window.SecureMessenger.chatRealtimePage = {
        createChatRealtimeClient,
    };
})();