import { usePlayer } from "@components";
import { getHass } from "@utils";
import { useSupportedFeatures } from "@hooks/useSupportedFeatures";
import { useCallback, useMemo } from "preact/hooks";
import { useEffectiveMassPlayer } from "./useEffectiveMassPlayer";

export const usePlayerActions = () => {
  const player = usePlayer();
  const { entity_id, state } = player;
  const { queueEntityId, effectiveShuffle, effectiveRepeat } =
    useEffectiveMassPlayer();

  const { supportsPause, supportsStop } = useSupportedFeatures();

  const stop = useCallback(() => {
    getHass().callService("media_player", "media_stop", {
      entity_id,
    });
  }, [entity_id]);

  const togglePlayback = useCallback(() => {
    if (supportsPause) {
      getHass().callService("media_player", "media_play_pause", { entity_id });
    } else if (state === "playing") {
      getHass().callService(
        "media_player",
        supportsStop ? "media_stop" : "media_pause",
        { entity_id }
      );
    } else {
      getHass().callService("media_player", "media_play", { entity_id });
    }
  }, [entity_id, state, supportsPause, supportsStop]);

  const nextTrack = useCallback(() => {
    getHass().callService("media_player", "media_next_track", {
      entity_id: queueEntityId,
    });
  }, [queueEntityId]);

  const previousTrack = useCallback(() => {
    getHass().callService("media_player", "media_previous_track", {
      entity_id: queueEntityId,
    });
  }, [queueEntityId]);

  const toggleShuffle = useCallback(() => {
    getHass().callService("media_player", "shuffle_set", {
      entity_id: queueEntityId,
      shuffle: !effectiveShuffle,
    });
  }, [queueEntityId, effectiveShuffle]);

  const toggleRepeat = useCallback(() => {
    const newRepeat =
      effectiveRepeat === "off"
        ? "one"
        : effectiveRepeat === "one"
          ? "all"
          : "off";
    getHass().callService("media_player", "repeat_set", {
      entity_id: queueEntityId,
      repeat: newRepeat,
    });
  }, [queueEntityId, effectiveRepeat]);

  const togglePower = useCallback(() => {
    getHass().callService("media_player", "toggle", {
      entity_id,
    });
  }, [entity_id]);

  return useMemo(
    () => ({
      stop,
      togglePlayback,
      nextTrack,
      previousTrack,
      toggleShuffle,
      toggleRepeat,
      togglePower,
    }),
    [
      stop,
      togglePlayback,
      nextTrack,
      previousTrack,
      toggleShuffle,
      toggleRepeat,
      togglePower,
    ]
  );
};
