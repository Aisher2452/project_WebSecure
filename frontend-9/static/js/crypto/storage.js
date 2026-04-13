(function () {
    window.SecureMessenger = window.SecureMessenger || {};
    window.SecureMessenger.crypto = window.SecureMessenger.crypto || {};

    const encoding = window.SecureMessenger.crypto.encoding;

    const STORAGE_KEYS = {
        cryptoProfile: "sm_crypto_profile",
        sessionPrivateKeyPkcs8: "sm_crypto_private_key_session_pkcs8",
        sessionMeta: "sm_crypto_session_meta",
    };

    function setJson(storage, key, value) {
        storage.setItem(key, JSON.stringify(value));
    }

    function getJson(storage, key) {
        return encoding.safeJsonParse(storage.getItem(key), null);
    }

    function saveCryptoProfile(profile) {
        window.localStorage.setItem(STORAGE_KEYS.cryptoProfile, JSON.stringify(profile));
    }

    function getCryptoProfile() {
        return getJson(window.localStorage, STORAGE_KEYS.cryptoProfile);
    }

    function clearCryptoProfile() {
        window.localStorage.removeItem(STORAGE_KEYS.cryptoProfile);
    }

    function saveSessionPrivateKeyPkcs8(base64Value) {
        window.sessionStorage.setItem(STORAGE_KEYS.sessionPrivateKeyPkcs8, base64Value);
    }

    function getSessionPrivateKeyPkcs8() {
        return window.sessionStorage.getItem(STORAGE_KEYS.sessionPrivateKeyPkcs8);
    }

    function clearSessionPrivateKeyPkcs8() {
        window.sessionStorage.removeItem(STORAGE_KEYS.sessionPrivateKeyPkcs8);
    }

    function saveSessionMeta(meta) {
        setJson(window.sessionStorage, STORAGE_KEYS.sessionMeta, meta);
    }

    function getSessionMeta() {
        return getJson(window.sessionStorage, STORAGE_KEYS.sessionMeta);
    }

    function clearSessionMeta() {
        window.sessionStorage.removeItem(STORAGE_KEYS.sessionMeta);
    }

    function clearAll() {
        clearCryptoProfile();
        clearSessionPrivateKeyPkcs8();
        clearSessionMeta();
    }

    window.SecureMessenger.crypto.storage = {
        STORAGE_KEYS,
        saveCryptoProfile,
        getCryptoProfile,
        clearCryptoProfile,
        saveSessionPrivateKeyPkcs8,
        getSessionPrivateKeyPkcs8,
        clearSessionPrivateKeyPkcs8,
        saveSessionMeta,
        getSessionMeta,
        clearSessionMeta,
        clearAll,
    };
})();