(function () {
    window.SecureMessenger = window.SecureMessenger || {};
    window.SecureMessenger.crypto = window.SecureMessenger.crypto || {};

    const encoding = window.SecureMessenger.crypto.encoding;
    const rsa = window.SecureMessenger.crypto.rsa;

    const AES_GCM = {
        name: "AES-GCM",
        length: 256,
        ivLength: 12,
    };

    function generateIv(length = AES_GCM.ivLength) {
        const iv = new Uint8Array(length);
        window.crypto.getRandomValues(iv);
        return iv.buffer;
    }

    async function generateAesKey() {
        return window.crypto.subtle.generateKey(AES_GCM, true, ["encrypt", "decrypt"]);
    }

    async function exportRawAesKey(aesKey) {
        return window.crypto.subtle.exportKey("raw", aesKey);
    }

    async function importRawAesKey(rawKeyBuffer) {
        return window.crypto.subtle.importKey(
            "raw",
            encoding.normalizeArrayBuffer(rawKeyBuffer),
            AES_GCM,
            true,
            ["encrypt", "decrypt"]
        );
    }

    async function encryptBuffer(aesKey, dataBuffer) {
        const iv = generateIv();
        const ciphertext = await window.crypto.subtle.encrypt(
            {
                name: AES_GCM.name,
                iv: encoding.normalizeArrayBuffer(iv),
            },
            aesKey,
            encoding.normalizeArrayBuffer(dataBuffer)
        );

        return {
            algorithm: AES_GCM.name,
            iv: encoding.bufferToBase64(iv),
            ciphertext: encoding.bufferToBase64(ciphertext),
        };
    }

    async function decryptBuffer(aesKey, payload) {
        const decrypted = await window.crypto.subtle.decrypt(
            {
                name: AES_GCM.name,
                iv: encoding.normalizeArrayBuffer(
                    encoding.base64ToArrayBuffer(payload.iv)
                ),
            },
            aesKey,
            encoding.normalizeArrayBuffer(
                encoding.base64ToArrayBuffer(payload.ciphertext)
            )
        );

        return decrypted;
    }

    async function encryptText(plainText, aesKey = null) {
        const workingKey = aesKey || (await generateAesKey());
        const encrypted = await encryptBuffer(
            workingKey,
            encoding.stringToArrayBuffer(plainText)
        );

        return {
            ...encrypted,
            encrypted_key: null,
            key: workingKey,
        };
    }

    async function decryptText(payload, aesKey) {
        const decryptedBuffer = await decryptBuffer(aesKey, payload);
        return encoding.arrayBufferToString(decryptedBuffer);
    }

    async function encryptFile(file, aesKey = null) {
        const workingKey = aesKey || (await generateAesKey());
        const fileBuffer = await file.arrayBuffer();
        const encrypted = await encryptBuffer(workingKey, fileBuffer);

        return {
            ...encrypted,
            encrypted_key: null,
            key: workingKey,
            file_name: file.name,
            mime_type: file.type || "application/octet-stream",
            size: file.size,
        };
    }

    async function decryptFile(payload, aesKey) {
        const decryptedBuffer = await decryptBuffer(aesKey, payload);
        return new Blob(
            [decryptedBuffer],
            {
                type: payload.mime_type || "application/octet-stream",
            }
        );
    }

    async function wrapAesKeyWithPublicKey(publicKeyPem, aesKey) {
        const publicKey = await rsa.importPublicKeyFromPem(publicKeyPem);
        const rawKey = await exportRawAesKey(aesKey);
        const wrapped = await rsa.encryptBytesWithPublicKey(publicKey, rawKey);
        return encoding.bufferToBase64(wrapped);
    }

    async function unwrapAesKeyWithPrivateKey(encryptedKeyBase64, privateKey) {
        const decryptedRawKey = await rsa.decryptBytesWithPrivateKey(
            privateKey,
            encoding.base64ToArrayBuffer(encryptedKeyBase64)
        );

        return importRawAesKey(decryptedRawKey);
    }

    window.SecureMessenger.crypto.aes = {
        AES_GCM,
        generateAesKey,
        exportRawAesKey,
        importRawAesKey,
        encryptBuffer,
        decryptBuffer,
        encryptText,
        decryptText,
        encryptFile,
        decryptFile,
        wrapAesKeyWithPublicKey,
        unwrapAesKeyWithPrivateKey,
    };
})();