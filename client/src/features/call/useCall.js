import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { roomApi } from "@/services/room.api";

/**
 * Starting and ending a call with one avatar.
 *
 * Shared by the call room and the avatar page's Chat tab, so both end a call
 * the same way: however it ends - hang-up, time limit, the room closing - the
 * caller lands on its transcript.
 */
export function useCall(avatarId) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [connection, setConnection] = useState(null);
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState(null);
  // Hang-up and the room closing both end up here, often back to back.
  const finished = useRef(false);

  const start = useCallback(async () => {
    setStarting(true);
    setError(null);
    try {
      finished.current = false;
      setConnection(await roomApi.start(avatarId));
    } catch (err) {
      setError(err.message);
    } finally {
      setStarting(false);
    }
  }, [avatarId]);

  const hangUp = useCallback(async () => {
    if (finished.current) return;
    finished.current = true;
    setEnding(true);
    const conversationId = connection?.conversationId;
    try {
      if (conversationId) await roomApi.end(conversationId);
    } catch {
      // The call is over either way; a failed cleanup call must not trap the
      // user on this screen. A queue worker reconciles usage from room events.
    } finally {
      setConnection(null);
      setEnding(false);
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      // Straight to what was just said. The transcript page keeps polling
      // briefly, since the last reply can land a moment after hang-up.
      navigate(conversationId ? `/conversations/${conversationId}` : "/avatars");
    }
  }, [connection, navigate, queryClient]);

  return { connection, starting, ending, error, setError, start, hangUp };
}
