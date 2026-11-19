/* tslint:disable:no-bitwise */
import { useMemo } from "preact/hooks";
import { usePlayer } from "@components";
import { getSupportedFeatures } from "@utils/supportedFeaturesUtils";
import { useEffectiveMassPlayer } from "./useEffectiveMassPlayer";

export function useSupportedFeatures() {
  const { attributes, state } = usePlayer();
  const { isMass, maState } = useEffectiveMassPlayer();

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
      supportedFeatures.supportsSeek,
    ]
  );
}
