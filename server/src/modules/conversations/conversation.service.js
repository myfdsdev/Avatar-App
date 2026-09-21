import { conversationRepository } from "./conversation.repository.js";

const notFound = () => {
  const err = new Error("Conversation not found");
  err.statusCode = 404;
  return err;
};

export const conversationService = {
  async list(workspaceId, { limit }) {
    const conversations = await conversationRepository.listByWorkspace(workspaceId, { limit });
    const summaries = await conversationRepository.summariseTranscripts(
      workspaceId,
      conversations.map((c) => c._id),
    );
    const byConversation = new Map(summaries.map((s) => [String(s.conversationId), s]));

    return conversations.map((c) => {
      const summary = byConversation.get(String(c._id));
      return {
        ...present(c),
        turnCount: summary?.turnCount || 0,
        preview: summary?.firstUserTurn?.text || null,
      };
    });
  },

  async get(workspaceId, id) {
    const conversation = await conversationRepository.findById(workspaceId, id);
    if (!conversation) throw notFound();

    const transcript = await conversationRepository.findTranscript(workspaceId, conversation._id);
    return {
      conversation: present(conversation),
      transcript: transcript ? { turns: transcript.turns, summary: transcript.summary } : null,
    };
  },
};

/**
 * The avatar comes back populated, or null once it has been deleted - calls
 * outlive the avatars they were with, and the history should say so rather
 * than disappear.
 */
function present({ avatarId, ...conversation }) {
  return {
    ...conversation,
    avatar: avatarId ? { _id: avatarId._id, name: avatarId.name, previewUrl: avatarId.previewUrl } : null,
  };
}
