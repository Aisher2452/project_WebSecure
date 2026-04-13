(function () {
    window.SecureMessenger = window.SecureMessenger || {};
    window.SecureMessenger.crypto = window.SecureMessenger.crypto || {};

    const encoding = window.SecureMessenger.crypto.encoding;
    const passwordUtils = window.SecureMessenger.crypto.password;
    const rsa = window.SecureMessenger.crypto.rsa;
    const aes = window.SecureMessenger.crypto.aes;
    const storage = window.SecureMessenger.crypto.storage;

    const PRIVATE_KEY_PAYLOAD_VERSION = 1;

    const runtime = {
        privateKey: null,
        publicKeyPem: null,
        profile: null,
    };

    function isSupported() {
        return Boolean(
            window.crypto &&
            window.crypto.subtle &&
            window.TextEncoder &&
            window.TextDecoder &&
            window.localStorage &&
            window.sessionStorage
        );
    }

    function ensureSupported() {
        if (!isSupported()) {
            throw new Error("Браузер не поддерживает Web Crypto API.");
        }
    }

    function createProfileFromUser(user) {
        if (!user) {
            return null;
        }

        return {
            user_id: user.id,
            username: user.username,
            email: user.email,
            public_key: user.public_key,
            encrypted_private_key: user.encrypted_private_key,
            key_salt: user.key_salt,
            synced_at: new Date().toISOString(),
        };
    }

    function parseEncryptedPrivateKeyPayload(encryptedPrivateKeyValue) {
        const parsed = encoding.safeJsonParse(encryptedPrivateKeyValue, null);

        if (!parsed || typeof parsed !== "object") {
            throw new Error("Неверный формат encrypted_private_key.");
        }

        return parsed;
    }

    async function encryptPrivateKeyWithPassword(privateKey, password) {
        const privateKeyPkcs8 = await rsa.exportPrivateKeyPkcs8(privateKey);
        const salt = passwordUtils.generateSalt();
        const passwordAesKey = await passwordUtils.deriveAesKeyFromPassword(password, salt);
        const encrypted = await aes.encryptBuffer(passwordAesKey, privateKeyPkcs8);

        return {
            encrypted_private_key: JSON.stringify({
                version: PRIVATE_KEY_PAYLOAD_VERSION,
                private_key_format: "pkcs8",
                rsa_algorithm: rsa.RSA_ALGORITHM.name,
                rsa_hash: rsa.RSA_ALGORITHM.hash,
                cipher: aes.AES_GCM.name,
                kdf: passwordUtils.DEFAULTS.algorithm,
                kdf_hash: passwordUtils.DEFAULTS.hash,
                kdf_iterations: passwordUtils.DEFAULTS.iterations,
                iv: encrypted.iv,
                ciphertext: encrypted.ciphertext,
                generated_at: new Date().toISOString(),
            }),
            key_salt: encoding.bufferToBase64(salt),
            private_key_pkcs8_base64: encoding.bufferToBase64(privateKeyPkcs8),
        };
    }

    async function decryptPrivateKeyWithPassword(encryptedPrivateKeyValue, keySalt, password) {
        const payload = parseEncryptedPrivateKeyPayload(encryptedPrivateKeyValue);
        const saltBuffer = encoding.base64ToArrayBuffer(keySalt);
        const passwordAesKey = await passwordUtils.deriveAesKeyFromPassword(
            password,
            saltBuffer,
            ["decrypt"],
            {
                iterations: payload.kdf_iterations,
                hash: payload.kdf_hash,
            }
        );

        const privateKeyPkcs8 = await aes.decryptBuffer(passwordAesKey, {
            iv: payload.iv,
            ciphertext: payload.ciphertext,
        });

        const privateKey = await rsa.importPrivateKeyFromPkcs8(privateKeyPkcs8);

        return {
            privateKey,
            privateKeyPkcs8Base64: encoding.bufferToBase64(privateKeyPkcs8),
            payload,
        };
    }

    async function createRegistrationBundle(password) {
        ensureSupported();

        const keyPair = await rsa.generateEncryptionKeyPair();
        const publicKeyPem = await rsa.exportPublicKeyToPem(keyPair.publicKey);
        const encryptedPrivateKeyBundle = await encryptPrivateKeyWithPassword(
            keyPair.privateKey,
            password
        );

        return {
            public_key: publicKeyPem,
            encrypted_private_key: encryptedPrivateKeyBundle.encrypted_private_key,
            key_salt: encryptedPrivateKeyBundle.key_salt,
            __privateKey: keyPair.privateKey,
            __privateKeyPkcs8Base64: encryptedPrivateKeyBundle.private_key_pkcs8_base64,
            __crypto_meta: parseEncryptedPrivateKeyPayload(
                encryptedPrivateKeyBundle.encrypted_private_key
            ),
        };
    }

    function setRuntimeKeys(privateKey, publicKeyPem, profile) {
        runtime.privateKey = privateKey || null;
        runtime.publicKeyPem = publicKeyPem || null;
        runtime.profile = profile || null;
    }

    async function cachePrivateKeyForSession(privateKey, meta = {}) {
        const privateKeyPkcs8 = await rsa.exportPrivateKeyPkcs8(privateKey);
        const privateKeyPkcs8Base64 = encoding.bufferToBase64(privateKeyPkcs8);

        storage.saveSessionPrivateKeyPkcs8(privateKeyPkcs8Base64);
        storage.saveSessionMeta({
            ...meta,
            cached_at: new Date().toISOString(),
            storage: "sessionStorage",
            extractable: true,
        });

        return privateKeyPkcs8Base64;
    }

    async function restorePrivateKeyFromSession() {
        const privateKeyPkcs8Base64 = storage.getSessionPrivateKeyPkcs8();

        if (!privateKeyPkcs8Base64) {
            return null;
        }

        try {
            return await rsa.importPrivateKeyFromPkcs8(
                encoding.base64ToArrayBuffer(privateKeyPkcs8Base64)
            );
        } catch (error) {
            storage.clearSessionPrivateKeyPkcs8();
            storage.clearSessionMeta();
            return null;
        }
    }

    function persistProfile(profile) {
        if (!profile) {
            return null;
        }

        storage.saveCryptoProfile(profile);
        runtime.profile = profile;
        runtime.publicKeyPem = profile.public_key || null;
        return profile;
    }

    function persistProfileFromUser(user) {
        const profile = createProfileFromUser(user);
        return persistProfile(profile);
    }

    async function restoreSession() {
        ensureSupported();

        const storedProfile = storage.getCryptoProfile();
        const privateKey = await restorePrivateKeyFromSession();

        if (storedProfile) {
            runtime.profile = storedProfile;
            runtime.publicKeyPem = storedProfile.public_key || null;
        }

        if (privateKey) {
            runtime.privateKey = privateKey;
        }

        return {
            profile: storedProfile,
            privateKey,
        };
    }

    async function unlockPrivateKey(user, password) {
        ensureSupported();

        const profile = persistProfileFromUser(user);

        if (!profile) {
            throw new Error("Профиль пользователя с crypto-полями не найден.");
        }

        const decrypted = await decryptPrivateKeyWithPassword(
            profile.encrypted_private_key,
            profile.key_salt,
            password
        );

        await cachePrivateKeyForSession(decrypted.privateKey, {
            user_id: profile.user_id,
            username: profile.username,
            email: profile.email,
            source: "password_unlock",
            payload_version: decrypted.payload.version,
        });

        setRuntimeKeys(decrypted.privateKey, profile.public_key, profile);

        return {
            privateKey: decrypted.privateKey,
            profile,
            payload: decrypted.payload,
        };
    }

    async function rememberRegistrationLocally(bundle, userData = {}) {
        ensureSupported();

        const profile = persistProfile({
            user_id: userData.id || null,
            username: userData.username || null,
            email: userData.email || null,
            public_key: bundle.public_key,
            encrypted_private_key: bundle.encrypted_private_key,
            key_salt: bundle.key_salt,
            synced_at: new Date().toISOString(),
        });

        if (bundle.__privateKey) {
            await cachePrivateKeyForSession(bundle.__privateKey, {
                user_id: userData.id || null,
                username: userData.username || null,
                email: userData.email || null,
                source: "register_flow",
                payload_version: bundle.__crypto_meta?.version || PRIVATE_KEY_PAYLOAD_VERSION,
            });
        }

        setRuntimeKeys(bundle.__privateKey || null, bundle.public_key, profile);
        return profile;
    }

    function getPrivateKey() {
        return runtime.privateKey;
    }

    function getPublicKeyPem() {
        return runtime.publicKeyPem;
    }

    function getPersistedProfile() {
        return runtime.profile || storage.getCryptoProfile();
    }

    function getStatus() {
        const profile = getPersistedProfile();
        const sessionMeta = storage.getSessionMeta();
        const encryptedPayload = profile?.encrypted_private_key
            ? encoding.safeJsonParse(profile.encrypted_private_key, null)
            : null;

        return {
            is_supported: isSupported(),
            has_profile: Boolean(profile),
            has_session_private_key: Boolean(storage.getSessionPrivateKeyPkcs8()),
            is_unlocked: Boolean(runtime.privateKey),
            public_key_storage: "backend(users.public_key) + localStorage(sm_crypto_profile.public_key)",
            encrypted_private_key_storage: "backend(users.encrypted_private_key) + localStorage(sm_crypto_profile.encrypted_private_key)",
            key_salt_storage: "backend(users.key_salt) + localStorage(sm_crypto_profile.key_salt)",
            session_private_key_storage: "sessionStorage(sm_crypto_private_key_session_pkcs8)",
            profile,
            encrypted_payload: encryptedPayload,
            session_meta: sessionMeta,
        };
    }

    function clearSession() {
        storage.clearAll();
        setRuntimeKeys(null, null, null);
    }

    window.SecureMessenger.crypto.client = {
        isSupported,
        ensureSupported,
        createProfileFromUser,
        parseEncryptedPrivateKeyPayload,
        encryptPrivateKeyWithPassword,
        decryptPrivateKeyWithPassword,
        createRegistrationBundle,
        persistProfile,
        persistProfileFromUser,
        restoreSession,
        unlockPrivateKey,
        rememberRegistrationLocally,
        cachePrivateKeyForSession,
        restorePrivateKeyFromSession,
        getPrivateKey,
        getPublicKeyPem,
        getPersistedProfile,
        getStatus,
        clearSession,
    };

    window.SecureMessenger.crypto = {
        ...window.SecureMessenger.crypto,
        client: window.SecureMessenger.crypto.client,
        isSupported,
        ensureSupported,
        parseEncryptedPrivateKeyPayload,
        createRegistrationBundle,
        unlockPrivateKey,
        restoreSession,
        rememberRegistrationLocally,
        getPrivateKey,
        getPublicKeyPem,
        getPersistedProfile,
        getStatus,
        clearSession,
    };
})();