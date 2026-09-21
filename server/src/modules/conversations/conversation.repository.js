import { Conversation, Transcript } from "../../models/index.js";

/**
 * Workspace-scoped at this layer, like every other repository, so no caller
 * can read another tenant's calls by forgetting a filter.
 */
export const conversationRepository = {
  listByWorkspace: (workspaceId, { limit }) =>
    Conversation.find({ workspaceId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("avatarId", "name previewUrl")
      .lean(),

  findById: (workspaceId, id) =>
    Conversation.findOne({ _id: id, workspaceId }).populate("avatarId", "name previewUrl").lean(),

  findTranscript: (workspaceId, conversationId) =>
    Transcript.findOne({ workspaceId, conversationId }).lean(),

  /**
   * Turn count and the caller's first line for each conversation, without
   * shipping every transcript to the list view.
   */
  summariseTranscripts: (workspaceId, conversationIds) =>
    Transcript.aggregate([
      { $match: { workspaceId, conversationId: { $in: conversationIds } } },
      {
        $project: {
          conversationId: 1,
          turnCount: { $size: "$turns" },
          firstUserTurn: {
            $arrayElemAt: [
              { $filter: { input: "$turns", cond: { $eq: ["$$this.role", "user"] } } },
              0,
            ],
          },
        },
      },
    ]),
};
