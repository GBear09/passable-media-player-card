import { useHass, usePlayer } from "@components";
import { getHass, getHasMassFeatures } from "@utils";
import { useSupportedFeatures } from "@hooks/useSupportedFeatures";
import { useCallback, useContext, useMemo } from "preact/hooks";
import { SelectedPlayerContext } from "@components/SelectedPlayerContext";
import { MediaPlayerEntity } from "@types";

export const usePlayerActions = () => {
  const player = usePlayer();
  const {
    entity_id,
    state,
    attributes: { shuffle, repeat },
  } = player;

  const selectedPlayerContext = useContext(SelectedPlayerContext);
  const selectedPlayer = selectedPlayerContext?.selectedPlayer;
  const maEntityId = selectedPlayer?.ma_entity_id;

  const hass = useHass();
  const isMass = maEntityId ? getHasMassFeatures(entity_id, maEntityId) : false;
  const maState = maEntityId
    ? (hass?.states?.[maEntityId] as MediaPlayerEntity | undefined)
    : undefined;

  const queueEntityId = isMass && maEntityId ? maEntityId : entity_id;
  const effectiveShuffle =
    isMass && maState?.attributes?.shuffle !== undefined
      ? maState.attributes.shuffle
      : shuffle;
  const effectiveRepeat =
    isMass && maState?.attributes?.repeat !== undefined
      ? maState.attributes.repeat
      : repeat;

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
