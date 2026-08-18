/* tslint:disable:no-bitwise */
import { useHass, usePlayer } from "@components";
import { useContext, useMemo } from "preact/hooks";
import { getSupportedFeatures } from "@utils/supportedFeaturesUtils";
import { SelectedPlayerContext } from "@components/SelectedPlayerContext";
import { getHasMassFeatures } from "@utils";
import { MediaPlayerEntity } from "@types";

export function useSupportedFeatures() {
  const { attributes, state, entity_id } = usePlayer();
  const selectedPlayerContext = useContext(SelectedPlayerContext);
  const selectedPlayer = selectedPlayerContext?.selectedPlayer;
  const maEntityId = selectedPlayer?.ma_entity_id;

  const hass = useHass();
  const isMass = maEntityId ? getHasMassFeatures(entity_id, maEntityId) : false;
  const maState = maEntityId
    ? (hass?.states?.[maEntityId] as MediaPlayerEntity | undefined)
    : undefined;

  const effectiveAttributes = useMemo(() => {
    if (isMass && maState) {
      return {
        ...attributes,
        ...maState.attributes,
        supported_features:
          (attributes.supported_features ?? 0) |
          (maState.attributes?.supported_features ?? 0),
      };
    }
    return attributes;
  }, [isMass, maState, attributes]);

  const supportedFeatures = getSupportedFeatures(state, effectiveAttributes);

  return useMemo(
    () => supportedFeatures,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally tracks individual feature flags, not the object reference
    [
      supportedFeatures.supportPreviousTrack,
      supportedFeatures.supportNextTrack,
      supportedFeatures.supportsShuffle,
      supportedFeatures.supportsRepeat,
      supportedFeatures.supportsTogglePlayPause,
      supportedFeatures.supportsPause,
      supportedFeatures.supportsStop,
    ]
  );
}
