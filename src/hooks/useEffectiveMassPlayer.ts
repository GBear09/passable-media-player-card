import { useHass, usePlayer } from "@components";
import { SelectedPlayerContext } from "@components/SelectedPlayerContext";
import { MediaPlayerEntity } from "@types";
import { getHasMassFeatures } from "@utils";
import { useContext, useMemo } from "preact/hooks";

export type EffectiveMassPlayer = {
  maEntityId?: string;
  maState?: MediaPlayerEntity;
  isMass: boolean;
  queueEntityId: string;
  effectiveShuffle: boolean | undefined;
  effectiveRepeat: MediaPlayerEntity["attributes"]["repeat"];
  isMaTrackSynced: boolean;
};

/**
 * Resolves the effective Music Assistant entity, attributes, and track sync status
 * for hybrid setups (e.g., Sonos primary entity_id paired with an ma_entity_id).
 */
export function useEffectiveMassPlayer(): EffectiveMassPlayer {
  const player = usePlayer();
  const hass = useHass();
  const selectedPlayerContext = useContext(SelectedPlayerContext);
  const selectedPlayer = selectedPlayerContext?.selectedPlayer;
  const maEntityId = selectedPlayer?.ma_entity_id ?? undefined;

  const isMass = useMemo(
    () =>
      maEntityId ? getHasMassFeatures(player.entity_id, maEntityId) : false,
    [player.entity_id, maEntityId]
  );

  const maState = maEntityId
    ? (hass?.states?.[maEntityId] as MediaPlayerEntity | undefined)
    : undefined;

  return useMemo(() => {
    const queueEntityId = isMass && maEntityId ? maEntityId : player.entity_id;

    const effectiveShuffle =
      isMass && maState?.attributes?.shuffle !== undefined
        ? maState.attributes.shuffle
        : player.attributes.shuffle;

    const effectiveRepeat =
      isMass && maState?.attributes?.repeat !== undefined
        ? maState.attributes.repeat
        : player.attributes.repeat;

    const maMediaId = maState?.attributes?.media_content_id;
    const isMaTrackSynced = Boolean(
      isMass &&
      maMediaId &&
      (!player.attributes.media_title ||
        maState?.attributes?.media_title === player.attributes.media_title)
    );

    return {
      maEntityId,
      maState,
      isMass,
      queueEntityId,
      effectiveShuffle,
      effectiveRepeat,
      isMaTrackSynced,
    };
  }, [
    isMass,
    maEntityId,
    maState,
    player.entity_id,
    player.attributes.shuffle,
    player.attributes.repeat,
    player.attributes.media_title,
  ]);
}
