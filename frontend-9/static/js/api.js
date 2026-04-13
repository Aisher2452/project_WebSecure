(function () {
    const STORAGE_KEYS = {
        accessToken: "sm_access_token",
        refreshToken: "sm_refresh_token",
        currentUser: "sm_current_user",
    };

    class ApiError extends Error {
        constructor(message, status = 0, payload = null) {
            super(message);
            this.name = "ApiError";
            this.status = status;
            this.payload = payload;
        }
    }

    function getApiBaseUrl() {
        const value = document.body?.dataset?.apiBaseUrl || "";
        return value.endsWith("/") ? value.slice(0, -1) : value;
    }

    function buildUrl(path) {
        const normalizedPath = path.startsWith("/") ? path : `/${path}`;
        return `${getApiBaseUrl()}${normalizedPath}`;
    }

    function parseErrorMessage(payload) {
        if (!payload) {
            return "Request failed";
        }

        if (typeof payload.detail === "string") {
            return payload.detail;
        }

        if (Array.isArray(payload.detail)) {
            return payload.detail
                .map((item) => item.msg || JSON.stringify(item))
                .join("; ");
        }

        if (typeof payload.message === "string") {
            return payload.message;
        }

        return "Request failed";
    }

    async function parseResponse(response) {
        const contentType = response.headers.get("content-type") || "";

        if (contentType.includes("application/json")) {
            return response.json();
        }

        const text = await response.text();
        return text ? { detail: text } : null;
    }

    function getCryptoClient() {
        return window.SecureMessenger?.crypto || null;
    }

    const storage = {
        setTokens(tokenResponse) {
            localStorage.setItem(STORAGE_KEYS.accessToken, tokenResponse.access_token);
            localStorage.setItem(STORAGE_KEYS.refreshToken, tokenResponse.refresh_token);
        },

        getAccessToken() {
            return localStorage.getItem(STORAGE_KEYS.accessToken);
        },

        getRefreshToken() {
            return localStorage.getItem(STORAGE_KEYS.refreshToken);
        },

        clearTokens() {
            localStorage.removeItem(STORAGE_KEYS.accessToken);
            localStorage.removeItem(STORAGE_KEYS.refreshToken);
        },

        setCurrentUser(user) {
            localStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(user));
            getCryptoClient()?.persistProfileFromUser?.(user);
        },

        getCurrentUser() {
            const rawValue = localStorage.getItem(STORAGE_KEYS.currentUser);

            if (!rawValue) {
                return null;
            }

            try {
                return JSON.parse(rawValue);
            } catch (error) {
                localStorage.removeItem(STORAGE_KEYS.currentUser);
                return null;
            }
        },

        clearCurrentUser() {
            localStorage.removeItem(STORAGE_KEYS.currentUser);
        },

        clearAuth() {
            this.clearTokens();
            this.clearCurrentUser();
            getCryptoClient()?.clearSession?.();
        },
    };

    function getDefaultHeaders(extraHeaders = {}) {
        return {
            Accept: "application/json",
            ...extraHeaders,
        };
    }

    let refreshPromise = null;

    async function refreshAccessToken() {
        const refreshToken = storage.getRefreshToken();

        if (!refreshToken) {
            storage.clearAuth();
            throw new ApiError("Refresh token not found", 401, null);
        }

        if (!refreshPromise) {
            refreshPromise = (async () => {
                const response = await fetch(buildUrl("/auth/refresh"), {
                    method: "POST",
                    headers: {
                        ...getDefaultHeaders({
                            "Content-Type": "application/json",
                        }),
                    },
                    body: JSON.stringify({
                        refresh_token: refreshToken,
                    }),
                });

                const payload = await parseResponse(response);

                if (!response.ok) {
                    storage.clearAuth();
                    throw new ApiError(
                        parseErrorMessage(payload),
                        response.status,
                        payload
                    );
                }

                storage.setTokens(payload);
                return payload.access_token;
            })().finally(() => {
                refreshPromise = null;
            });
        }

        return refreshPromise;
    }

    async function apiFetch(path, options = {}, config = {}) {
        const {
            auth = true,
            retry = true,
        } = config;

        const headers = new Headers(getDefaultHeaders(options.headers || {}));
        const isFormDataBody = options.body instanceof FormData;

        if (options.body && !isFormDataBody && !headers.has("Content-Type")) {
            headers.set("Content-Type", "application/json");
        }

        if (auth) {
            const accessToken = storage.getAccessToken();
            if (accessToken) {
                headers.set("Authorization", `Bearer ${accessToken}`);
            }
        }

        let response = await fetch(buildUrl(path), {
            ...options,
            headers,
        });

        if (
            response.status === 401 &&
            auth &&
            retry &&
            storage.getRefreshToken()
        ) {
            const newAccessToken = await refreshAccessToken();
            headers.set("Authorization", `Bearer ${newAccessToken}`);

            response = await fetch(buildUrl(path), {
                ...options,
                headers,
            });
        }

        return response;
    }

    async function requestJson(path, options = {}, config = {}) {
        const response = await apiFetch(path, options, config);
        const payload = await parseResponse(response);

        if (!response.ok) {
            throw new ApiError(
                parseErrorMessage(payload),
                response.status,
                payload
            );
        }

        return payload;
    }

    async function requestFormData(path, formData, config = {}) {
        const response = await apiFetch(
            path,
            {
                method: "POST",
                body: formData,
            },
            config
        );
        const payload = await parseResponse(response);

        if (!response.ok) {
            throw new ApiError(
                parseErrorMessage(payload),
                response.status,
                payload
            );
        }

        return payload;
    }

    const authApi = {
        async register(payload) {
            return requestJson(
                "/auth/register",
                {
                    method: "POST",
                    body: JSON.stringify(payload),
                },
                {
                    auth: false,
                    retry: false,
                }
            );
        },

        async login(payload) {
            return requestJson(
                "/auth/login",
                {
                    method: "POST",
                    body: JSON.stringify(payload),
                },
                {
                    auth: false,
                    retry: false,
                }
            );
        },

        async getMe() {
            return requestJson(
                "/auth/me",
                {
                    method: "GET",
                },
                {
                    auth: true,
                    retry: true,
                }
            );
        },
    };

    const usersApi = {
        async listUsers() {
            return requestJson(
                "/users",
                {
                    method: "GET",
                },
                {
                    auth: true,
                    retry: true,
                }
            );
        },
    };

    const chatsApi = {
        async listChats() {
            return requestJson(
                "/chats",
                {
                    method: "GET",
                },
                {
                    auth: true,
                    retry: true,
                }
            );
        },

        async createDirectChat(payload) {
            return requestJson(
                "/chats/direct",
                {
                    method: "POST",
                    body: JSON.stringify(payload),
                },
                {
                    auth: true,
                    retry: true,
                }
            );
        },

        async getMessages(chatId) {
            return requestJson(
                `/chats/${chatId}/messages`,
                {
                    method: "GET",
                },
                {
                    auth: true,
                    retry: true,
                }
            );
        },

        async sendTextMessage(chatId, payload) {
            return requestJson(
                `/chats/${chatId}/messages/text`,
                {
                    method: "POST",
                    body: JSON.stringify(payload),
                },
                {
                    auth: true,
                    retry: true,
                }
            );
        },

        async sendFileMessage(chatId, formData) {
            return requestFormData(
                `/chats/${chatId}/messages/file`,
                formData,
                {
                    auth: true,
                    retry: true,
                }
            );
        },
    };

    const auth = {
        isAuthenticated() {
            return Boolean(storage.getAccessToken() && storage.getRefreshToken());
        },

        async getCurrentUser(forceRefresh = false) {
            if (!forceRefresh) {
                const cachedUser = storage.getCurrentUser();
                if (cachedUser) {
                    return cachedUser;
                }
            }

            const user = await authApi.getMe();
            storage.setCurrentUser(user);
            return user;
        },

        async login(credentials) {
            const tokenResponse = await authApi.login(credentials);
            storage.setTokens(tokenResponse);
            const user = await this.getCurrentUser(true);
            return {
                tokenResponse,
                user,
            };
        },

        async register(payload) {
            const tokenResponse = await authApi.register(payload);
            storage.setTokens(tokenResponse);
        
            const user = await this.getCurrentUser(true);
        
            return {
                tokenResponse,
                user,
            };
        },

        logout() {
            storage.clearAuth();
        },
    };

    const ui = {
        showAlert(element, message, type = "error") {
            if (!element) {
                return;
            }

            element.textContent = message;
            element.classList.remove("hidden", "alert--error", "alert--success");
            element.classList.add(`alert--${type}`);
        },

        hideAlert(element) {
            if (!element) {
                return;
            }

            element.textContent = "";
            element.classList.add("hidden");
            element.classList.remove("alert--error", "alert--success");
        },

        setButtonLoading(button, isLoading, loadingText) {
            if (!button) {
                return;
            }

            if (!button.dataset.defaultHtml) {
                button.dataset.defaultHtml = button.innerHTML;
            }

            button.disabled = isLoading;
            button.innerHTML = isLoading ? loadingText : button.dataset.defaultHtml;
        },

        maskToken(token) {
            if (!token) {
                return "Не найден";
            }

            if (token.length <= 24) {
                return token;
            }

            return `${token.slice(0, 18)}...${token.slice(-6)}`;
        },

        setText(selector, value) {
            const element = document.querySelector(selector);
            if (!element) {
                return;
            }

            element.textContent = value ?? "—";
        },

        makeInitials(value) {
            const normalized = String(value || "")
                .trim()
                .split(/\s+/)
                .filter(Boolean);

            if (!normalized.length) {
                return "?";
            }

            return normalized
                .slice(0, 2)
                .map((part) => part[0]?.toUpperCase() || "")
                .join("");
        },
    };

    window.SecureMessenger = {
        ...window.SecureMessenger,
        ApiError,
        storage,
        authApi,
        usersApi,
        chatApi: chatsApi,
        auth,
        ui,
    };
})();