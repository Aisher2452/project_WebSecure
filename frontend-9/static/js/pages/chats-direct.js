(function () {
    async function createDirectChat(otherUserId) {
        return window.SecureMessenger.chatApi.createDirectChat({
            other_user_id: Number(otherUserId),
        });
    }

    function mapDirectChatResponseToListItem(payload, existingChat = null) {
        const participants = Array.isArray(payload?.participants) ? payload.participants : [];
        const currentUser = window.SecureMessenger.storage.getCurrentUser();
        const otherUser =
            participants.find((participant) => participant.id !== currentUser?.id) ||
            participants[0] ||
            null;

        return {
            chat_id: payload.chat_id,
            created_at: payload.created_at,
            other_user: otherUser,
            last_message_id: existingChat?.last_message_id || null,
            last_message_preview: existingChat?.last_message_preview || null,
            last_message_created_at: existingChat?.last_message_created_at || null,
        };
    }

    window.SecureMessenger = window.SecureMessenger || {};
    window.SecureMessenger.chatDirectPage = {
        createDirectChat,
        mapDirectChatResponseToListItem,
    };
})();