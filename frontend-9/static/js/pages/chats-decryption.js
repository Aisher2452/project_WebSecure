(function () {
    function getApiBaseUrl() {
        const value = document.body?.dataset?.apiBaseUrl || "";
        return value.endsWith("/") ? value.slice(0, -1) : value;
    }

    function getBackendOrigin() {
        const apiBaseUrl = getApiBaseUrl();

        if (!apiBaseUrl) {
            return window.location.origin;
        }

        try {
            const url = new URL(apiBaseUrl, window.location.origin);
            return `${url.protocol}//${url.host}`;
        } catch (error) {
            return window.location.origin;
        }
    }

    function unique(values) {
        return Array.from(new Set(values.filter(Boolean)));
    }

    function normalizeFilePath(filePath) {
        return String(filePath || "")
            .trim()
            .replace(/\\/g, "/")
            .replace(/^\/+/, "");
    }

    function buildFileUrlCandidates(filePath) {
        const normalizedPath = normalizeFilePath(filePath);

        if (!normalizedPath) {
            return [];
        }

        if (/^https?:\/\//i.test(normalizedPath)) {
            return [normalizedPath];
        }

        const apiBaseUrl = getApiBaseUrl();
        const backendOrigin = getBackendOrigin();
        const candidates = [];

        if (apiBaseUrl) {
            const apiRoot = apiBaseUrl.replace(/\/api\/v\d+$/i, "");
            candidates.push(`${apiRoot}/${normalizedPath}`);
            candidates.push(`${apiBaseUrl}/${normalizedPath}`);
        }

        candidates.push(`${backendOrigin}/${normalizedPath}`);

        const storageSegment = "storage/uploads/";
        const storageIndex = normalizedPath.indexOf(storageSegment);
        if (storageIndex >= 0) {
            candidates.push(`${backendOrigin}/${normalizedPath.slice(storageIndex)}`);
        }

        const fileName = normalizedPath.split("/").pop();
        if (fileName) {
            candidates.push(`${backendOrigin}/storage/uploads/${fileName}`);
        }

        return unique(candidates);
    }

    function buildFetchHeaders(getAccessToken) {
        const headers = {
            Accept: "*/*",
        };

        const accessToken = typeof getAccessToken === "function"
            ? getAccessToken()
            : null;

        if (accessToken) {
            headers.Authorization = `Bearer ${accessToken}`;
        }

        return headers;
    }

    function ensurePrivateKey(privateKey) {
        if (!privateKey) {
            throw new Error("Private key не найден в текущей session. Войдите заново, чтобы разблокировать client decryption.");
        }

        return privateKey;
    }

    function isExpiredMessage(message) {
        return Boolean(message?.is_expired || message?.status === "expired");
    }

    function isOwnMessage(message, currentUserId) {
        return Boolean(
            message
            && message.sender
            && String(message.sender.id) === String(currentUserId)
        );
    }

    function isIncomingMessage(message, currentUserId) {
        return Boolean(
            message
            && message.sender
            && String(message.sender.id) !== String(currentUserId)
            && !isExpiredMessage(message)
        );
    }

    function getMessageEncryptedKey(message) {
        return message?.local_sender_encrypted_key || message?.encrypted_key || "";
    }

    function hasOwnDecryptableKey(message, currentUserId) {
        return Boolean(
            isOwnMessage(message, currentUserId)
            && message?.local_sender_encrypted_key
        );
    }

    function canDecryptTextMessage(message, currentUserId) {
        return Boolean(
            message
            && !isExpiredMessage(message)
            && message.message_type === "text"
            && message.ciphertext
            && message.iv
            && (
                isIncomingMessage(message, currentUserId)
                || hasOwnDecryptableKey(message, currentUserId)
            )
            && getMessageEncryptedKey(message)
        );
    }

    function canDecryptFileMessage(message, currentUserId) {
        return Boolean(
            message
            && !isExpiredMessage(message)
            && message.message_type === "file"
            && message.iv
            && message.file_path
            && (
                isIncomingMessage(message, currentUserId)
                || hasOwnDecryptableKey(message, currentUserId)
            )
            && getMessageEncryptedKey(message)
        );
    }

    async function unwrapMessageAesKey(message, privateKey) {
        return window.SecureMessenger.crypto.aes.unwrapAesKeyWithPrivateKey(
            getMessageEncryptedKey(message),
            ensurePrivateKey(privateKey)
        );
    }

    async function decryptTextMessage(message, options = {}) {
        const { privateKey } = options;
        const aesKey = await unwrapMessageAesKey(message, privateKey);
        const plainText = await window.SecureMessenger.crypto.aes.decryptText(
            {
                ciphertext: message.ciphertext,
                iv: message.iv,
            },
            aesKey
        );

        return {
            plainText,
        };
    }

    async function fetchEncryptedFileBlob(message, options = {}) {
        const { getAccessToken } = options;
        const candidates = buildFileUrlCandidates(message.file_path);

        if (!candidates.length) {
            throw new Error("Backend не вернул file_path для encrypted file.");
        }

        const errors = [];

        for (const candidate of candidates) {
            try {
                const response = await fetch(candidate, {
                    method: "GET",
                    headers: buildFetchHeaders(getAccessToken),
                });

                if (!response.ok) {
                    errors.push(`${candidate} -> HTTP ${response.status}`);
                    continue;
                }

                const blob = await response.blob();
                return {
                    blob,
                    url: candidate,
                };
            } catch (error) {
                errors.push(`${candidate} -> ${error.message}`);
            }
        }

        throw new Error(
            "Не удалось скачать encrypted file с backend. "
            + "Проверьте, что file_path доступен по HTTP. "
            + errors.slice(0, 2).join("; ")
        );
    }

    async function decryptFileMessage(message, options = {}) {
        const { privateKey, getAccessToken } = options;
        const aesKey = await unwrapMessageAesKey(message, privateKey);
        const encryptedFile = await fetchEncryptedFileBlob(message, { getAccessToken });
        const encryptedBuffer = await encryptedFile.blob.arrayBuffer();
        const ciphertext = window.SecureMessenger.crypto.encoding.bufferToBase64(encryptedBuffer);
        const decryptedBlob = await window.SecureMessenger.crypto.aes.decryptFile(
            {
                ciphertext,
                iv: message.iv,
                mime_type: message.mime_type || "application/octet-stream",
            },
            aesKey
        );

        return {
            blob: decryptedBlob,
            fileName: message.file_name || "decrypted-file",
            sourceUrl: encryptedFile.url,
        };
    }

    function downloadBlob(blob, fileName) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName || "decrypted-file";
        link.style.display = "none";

        document.body.appendChild(link);
        link.click();
        link.remove();

        window.setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 1500);
    }

    async function decryptAndDownloadFileMessage(message, options = {}) {
        const result = await decryptFileMessage(message, options);
        downloadBlob(result.blob, result.fileName);
        return result;
    }

    window.SecureMessenger = window.SecureMessenger || {};
    window.SecureMessenger.chatDecryptionPage = {
        getApiBaseUrl,
        getBackendOrigin,
        normalizeFilePath,
        buildFileUrlCandidates,
        isOwnMessage,
        isIncomingMessage,
        canDecryptTextMessage,
        canDecryptFileMessage,
        decryptTextMessage,
        decryptFileMessage,
        decryptAndDownloadFileMessage,
        downloadBlob,
    };
})();