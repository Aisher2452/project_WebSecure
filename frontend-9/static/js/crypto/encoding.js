(function () {
    window.SecureMessenger = window.SecureMessenger || {};
    window.SecureMessenger.crypto = window.SecureMessenger.crypto || {};

    const textEncoder = new TextEncoder();
    const textDecoder = new TextDecoder();

    function normalizeArrayBuffer(value) {
        if (value instanceof ArrayBuffer) {
            return value;
        }

        if (ArrayBuffer.isView(value)) {
            return value.buffer.slice(
                value.byteOffset,
                value.byteOffset + value.byteLength
            );
        }

        throw new Error("Value is not an ArrayBuffer or TypedArray");
    }

    function stringToArrayBuffer(value) {
        return textEncoder.encode(String(value)).buffer;
    }

    function arrayBufferToString(value) {
        return textDecoder.decode(normalizeArrayBuffer(value));
    }

    function bufferToBase64(value) {
        const bytes = new Uint8Array(normalizeArrayBuffer(value));
        let binary = "";
        const chunkSize = 0x8000;

        for (let index = 0; index < bytes.length; index += chunkSize) {
            const chunk = bytes.subarray(index, index + chunkSize);
            binary += String.fromCharCode.apply(null, chunk);
        }

        return window.btoa(binary);
    }

    function base64ToArrayBuffer(base64Value) {
        const binary = window.atob(String(base64Value || ""));
        const bytes = new Uint8Array(binary.length);

        for (let index = 0; index < binary.length; index += 1) {
            bytes[index] = binary.charCodeAt(index);
        }

        return bytes.buffer;
    }

    function splitEvery(value, size) {
        const parts = [];

        for (let index = 0; index < value.length; index += size) {
            parts.push(value.slice(index, index + size));
        }

        return parts;
    }

    function arrayBufferToPem(value, label) {
        const base64 = bufferToBase64(value);
        const body = splitEvery(base64, 64).join("\n");
        return `-----BEGIN ${label}-----\n${body}\n-----END ${label}-----`;
    }

    function pemToArrayBuffer(pemValue) {
        const normalized = String(pemValue || "")
            .replace(/-----BEGIN [^-]+-----/g, "")
            .replace(/-----END [^-]+-----/g, "")
            .replace(/\s+/g, "");

        return base64ToArrayBuffer(normalized);
    }

    function safeJsonParse(value, fallback = null) {
        if (typeof value !== "string" || !value.trim()) {
            return fallback;
        }

        try {
            return JSON.parse(value);
        } catch (error) {
            return fallback;
        }
    }

    window.SecureMessenger.crypto.encoding = {
        normalizeArrayBuffer,
        stringToArrayBuffer,
        arrayBufferToString,
        bufferToBase64,
        base64ToArrayBuffer,
        arrayBufferToPem,
        pemToArrayBuffer,
        safeJsonParse,
    };
})();