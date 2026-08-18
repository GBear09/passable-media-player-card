import { IconButton, useHass, usePlayer } from "@components";
import { useSupportedFeatures } from "@hooks";
import { css } from "@emotion/react";
import { usePlayerActions } from "@hooks/usePlayerActions";
import { useSelectedPlayer } from "@components/SelectedPlayerContext";
import { getHasMassFeatures } from "@utils";
import { MediaPlayerEntity } from "@types";

const styles = {
  root: css({
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    width: "100%",
    maxWidth: "440px",
    paddingLeft: "var(--mmpc-extra-horizontal-padding, 0px)",
    paddingRight: "var(--mmpc-extra-horizontal-padding, 0px)",
  }),
};

export const PlaybackControls = () => {
  const { selectedPlayer } = useSelectedPlayer();
  const player = usePlayer();
  const {
    attributes: { shuffle, repeat },
    state,
    entity_id: entityId,
  } = player;

  const maEntityId = selectedPlayer?.ma_entity_id;
  const isMass = maEntityId ? getHasMassFeatures(entityId, maEntityId) : false;
  const hass = useHass();
  const maState = maEntityId
    ? (hass?.states?.[maEntityId] as MediaPlayerEntity | undefined)
    : undefined;

  const effectiveShuffle =
    isMass && maState?.attributes?.shuffle !== undefined
      ? maState.attributes.shuffle
      : shuffle;
  const effectiveRepeat =
    isMass && maState?.attributes?.repeat !== undefined
      ? maState.attributes.repeat
      : repeat;

  const playing = state === "playing";

  const {
    supportPreviousTrack,
    supportNextTrack,
    supportsShuffle,
    supportsRepeat,
    supportsTogglePlayPause,
    supportsPause,
    supportsStop,
  } = useSupportedFeatures();

  const {
    togglePlayback,
    toggleRepeat,
    toggleShuffle,
    previousTrack,
    nextTrack,
    stop,
  } = usePlayerActions();

  return (
    <div css={styles.root}>
      {supportsShuffle && (
        <IconButton
          size="small"
          onClick={toggleShuffle}
          icon={
            effectiveShuffle ? "mdi:shuffle-variant" : "mdi:shuffle-disabled"
          }
        />
      )}
      {supportPreviousTrack && (
        <IconButton
          size="large"
          onClick={previousTrack}
          icon={"mdi:skip-previous"}
        />
      )}
      {supportsTogglePlayPause ? (
        <IconButton
          size="x-large"
          onClick={togglePlayback}
          icon={
            playing
              ? supportsPause
                ? "mdi:pause-circle"
                : "mdi:stop-circle"
              : "mdi:play-circle"
          }
        />
      ) : supportsStop ? (
        <IconButton size="x-large" onClick={stop} icon={"mdi:stop"} />
      ) : null}
      {supportNextTrack && (
        <IconButton size="large" onClick={nextTrack} icon={"mdi:skip-next"} />
      )}
      {supportsRepeat && (
        <IconButton
          size="small"
          onClick={toggleRepeat}
          icon={
            effectiveRepeat === "one"
              ? "mdi:repeat-once"
              : effectiveRepeat === "all"
                ? "mdi:repeat"
                : "mdi:repeat-off"
          }
        />
      )}
    </div>
  );
};
