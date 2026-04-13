(function () {
    window.SecureMessenger = window.SecureMessenger || {};
    window.SecureMessenger.crypto = window.SecureMessenger.crypto || {};

    const encoding = window.SecureMessenger.crypto.encoding;

    const DEFAULTS = {
        algorithm: "PBKDF2",
        hash: "SHA-256",
        iterations: 310000,
        saltLength: 16,
    };

    function generateSalt(length = DEFAULTS.saltLength) {
        const salt = new Uint8Array(length);
        window.crypto.getRandomValues(salt);
        return salt.buffer;
    }

    async function importPasswordKey(password) {
        return window.crypto.subtle.importKey(
            "raw",
            encoding.stringToArrayBuffer(password),
            { name: DEFAULTS.algorithm },
            false,
            ["deriveKey"]
        );
    }

    async function deriveAesKeyFromPassword(password, salt, usages = ["encrypt", "decrypt"], options = {}) {
        const passwordKey = await importPasswordKey(password);

        return window.crypto.subtle.deriveKey(
            {
                name: DEFAULTS.algorithm,
                salt: encoding.normalizeArrayBuffer(salt),
                iterations: options.iterations || DEFAULTS.iterations,
                hash: options.hash || DEFAULTS.hash,
            },
            passwordKey,
            {
                name: "AES-GCM",
                length: 256,
            },
            options.extractable || false,
            usages
        );
    }

    window.SecureMessenger.crypto.password = {
        DEFAULTS,
        generateSalt,
        importPasswordKey,
        deriveAesKeyFromPassword,
    };
})();