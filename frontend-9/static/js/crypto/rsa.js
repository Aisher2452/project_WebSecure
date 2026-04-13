(function () {
    window.SecureMessenger = window.SecureMessenger || {};
    window.SecureMessenger.crypto = window.SecureMessenger.crypto || {};

    const encoding = window.SecureMessenger.crypto.encoding;

    const RSA_ALGORITHM = {
        name: "RSA-OAEP",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
    };

    async function generateEncryptionKeyPair() {
        return window.crypto.subtle.generateKey(
            RSA_ALGORITHM,
            true,
            ["encrypt", "decrypt"]
        );
    }

    async function exportPublicKeyToPem(publicKey) {
        const spki = await window.crypto.subtle.exportKey("spki", publicKey);
        return encoding.arrayBufferToPem(spki, "PUBLIC KEY");
    }

    async function exportPrivateKeyPkcs8(privateKey) {
        return window.crypto.subtle.exportKey("pkcs8", privateKey);
    }

    async function importPublicKeyFromPem(publicKeyPem) {
        return window.crypto.subtle.importKey(
            "spki",
            encoding.pemToArrayBuffer(publicKeyPem),
            RSA_ALGORITHM,
            true,
            ["encrypt"]
        );
    }

    async function importPrivateKeyFromPkcs8(pkcs8Buffer) {
        return window.crypto.subtle.importKey(
            "pkcs8",
            encoding.normalizeArrayBuffer(pkcs8Buffer),
            RSA_ALGORITHM,
            true,
            ["decrypt"]
        );
    }

    async function encryptBytesWithPublicKey(publicKey, dataBuffer) {
        return window.crypto.subtle.encrypt(
            { name: RSA_ALGORITHM.name },
            publicKey,
            encoding.normalizeArrayBuffer(dataBuffer)
        );
    }

    async function decryptBytesWithPrivateKey(privateKey, encryptedBuffer) {
        return window.crypto.subtle.decrypt(
            { name: RSA_ALGORITHM.name },
            privateKey,
            encoding.normalizeArrayBuffer(encryptedBuffer)
        );
    }

    window.SecureMessenger.crypto.rsa = {
        RSA_ALGORITHM,
        generateEncryptionKeyPair,
        exportPublicKeyToPem,
        exportPrivateKeyPkcs8,
        importPublicKeyFromPem,
        importPrivateKeyFromPkcs8,
        encryptBytesWithPublicKey,
        decryptBytesWithPrivateKey,
    };
})();