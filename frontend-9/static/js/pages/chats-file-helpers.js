(function () {
    async function createEncryptedFilePayload(
        file,
        recipientPublicKey,
        expirationType = "none",
        senderPublicKey = null
    ) {
        if (!file) {
            throw new Error("Файл не выбран.");
        }

        if (!recipientPublicKey) {
            throw new Error("У выбранного пользователя отсутствует public key.");
        }

        const SM = window.SecureMessenger;
        const encrypted = await SM.crypto.aes.encryptFile(file);
        const encryptedKey = await SM.crypto.aes.wrapAesKeyWithPublicKey(
            recipientPublicKey,
            encrypted.key
        );
        const senderEncryptedKey = senderPublicKey
            ? await SM.crypto.aes.wrapAesKeyWithPublicKey(senderPublicKey, encrypted.key)
            : null;
        const ciphertextBuffer = SM.crypto.encoding.base64ToArrayBuffer(encrypted.ciphertext);

        const encryptedFile = new File(
            [ciphertextBuffer],
            file.name,
            {
                type: file.type || "application/octet-stream",
                lastModified: Date.now(),
            }
        );

        const formData = new FormData();
        formData.append("encrypted_key", encryptedKey);
        formData.append("iv", encrypted.iv);
        formData.append("expiration_type", expirationType || "none");
        formData.append("file", encryptedFile, encryptedFile.name);

        return {
            formData,
            messageMeta: {
                encrypted_key: encryptedKey,
                local_sender_encrypted_key: senderEncryptedKey,
                iv: encrypted.iv,
                file_name: file.name,
                file_size: encryptedFile.size,
                mime_type: file.type || "application/octet-stream",
                expiration_type: expirationType || "none",
            },
        };
    }

    window.SecureMessenger = window.SecureMessenger || {};
    window.SecureMessenger.chatFileHelpers = {
        createEncryptedFilePayload,
    };
})();