import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "preact/hooks";
import { Icon, IconButton, ProgressBar, usePlayer } from "@components";
import { CardContext, CardContextType } from "@components/CardContext";
import { useToast } from "@components/Toast";
import { css } from "@emotion/react";
import { theme } from "@constants";
import {
  OverlayMenu,
  OverlayMenuItem,
} from "@components/OverlayMenu/OverlayMenu";
import { useEffectiveMassPlayer, useSupportedFeatures } from "@hooks";
import { MediocreMultiMediaPlayerCardConfig } from "@types";
import {
  calculatePlaybackPosition,
  formatPlaybackTime,
  getHass,
  getSourceIcon,
  hasMassQueueService,
  shouldShowSkipControls,
  skipMassQueue,
} from "@utils";

const styles = {
  root: css({
    paddingLeft: "var(--mmpc-extra-horizontal-padding, 0px)",
    paddingRight: "var(--mmpc-extra-horizontal-padding, 0px)",
    width: "100%",
  }),
  timeWrap: css({
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: "4px",
    color: theme.colors.onDialogMuted,
    height: "22px",
    marginBottom: "-4px",
    gap: "4px",
  }),
  timeWrapNoSource: css({
    marginBottom: "-20px",
  }),
  timeSide: css({
    display: "flex",
    alignItems: "center",
    gap: "2px",
    minWidth: "36px",
  }),
  timeSideRight: css({
    justifyContent: "flex-end",
  }),
  skipBtn: css({
    color: theme.colors.onDialogMuted,
    opacity: 0.85,
    "&:hover": {
      opacity: 1,
    },
  }),
  sourceSelect: css({
    background: "none",
    border: "none",
    color: theme.colors.onDialogMuted,
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
    padding: 0,
    display: "flex",
    gap: "4px",
    alignItems: "center",
    marginLeft: "auto",
    marginRight: "auto",
    opacity: 0.8,
    "&:hover": {
      opacity: 1,
    },
  }),
};

function getSkipIcon(direction: "back" | "forward", seconds: number): string {
  if (direction === "back") {
    if (seconds === 10) return "mdi:rewind-10";
    if (seconds === 15) return "mdi:rewind-15";
    if (seconds === 30) return "mdi:rewind-30";
    return "mdi:rewind";
  }
  if (seconds === 10) return "mdi:fast-forward-10";
  if (seconds === 15) return "mdi:fast-forward-15";
  if (seconds === 30) return "mdi:fast-forward-30";
  return "mdi:fast-forward";
}

export const Track = () => {
  const player = usePlayer();
  const { config } =
    useContext<CardContextType<MediocreMultiMediaPlayerCardConfig>>(
      CardContext
    );
  const { maEntityId, maState, isMass, queueEntityId, isMaTrackSynced } =
    useEffectiveMassPlayer();
  const { supportsSeek } = useSupportedFeatures();
  const { showToast } = useToast();

  const [tick, setTick] = useState(0);
  const [scrubPosition, setScrubPosition] = useState<number | null>(null);
  const [optimisticSeek, setOptimisticSeek] = useState<{
    value: number;
    setAt: number;
  } | null>(null);
  const isPlaying = player.state === "playing";

  const mediaPosition = player.attributes?.media_position ?? null;
  const mediaPositionUpdatedAt =
    player.attributes?.media_position_updated_at ?? null;
  const mediaDuration = player.attributes?.media_duration ?? null;

  // Clear optimistic seek once real HA state updates or after 4s timeout
  useEffect(() => {
    setOptimisticSeek(null);
  }, [mediaPosition, mediaPositionUpdatedAt, player.attributes?.media_title]);

  useEffect(() => {
    if (!optimisticSeek) return;
    const timer = window.setTimeout(() => setOptimisticSeek(null), 4000);
    return () => window.clearTimeout(timer);
  }, [optimisticSeek]);

  // Set up tick that updates once per second, but only when playing
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setTick(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying]);

  const position = useMemo(() => {
    const posInput = optimisticSeek ? optimisticSeek.value : mediaPosition;
    const updatedInput = optimisticSeek
      ? new Date(optimisticSeek.setAt).toISOString()
      : mediaPositionUpdatedAt;

    return calculatePlaybackPosition({
      state: player.state,
      mediaPosition: posInput,
      mediaPositionUpdatedAt: updatedInput,
      mediaDuration,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `tick` is an intentional render trigger (incremented by setInterval) to recalculate elapsed position each second
  }, [
    player.state,
    mediaPosition,
    mediaPositionUpdatedAt,
    mediaDuration,
    optimisticSeek,
    tick,
  ]);

  const skipMode = config?.options?.skip_controls ?? "auto";
  const skipBackwardSeconds = Math.abs(
    config?.options?.skip_backward_seconds ?? 15
  );
  const skipForwardSeconds = Math.abs(
    config?.options?.skip_forward_seconds ?? 30
  );

  const effectiveAttrs = useMemo(
    () =>
      isMaTrackSynced && maState
        ? { ...player.attributes, ...maState.attributes }
        : player.attributes,
    [isMaTrackSynced, maState, player.attributes]
  );

  const canMassSkip = Boolean(
    isMass && maEntityId && hasMassQueueService("skip")
  );
  const showSkipControls =
    shouldShowSkipControls(skipMode, effectiveAttrs) &&
    (canMassSkip || supportsSeek) &&
    position !== null;

  const handleSeek = useCallback(
    async (seconds: number) => {
      const clamped =
        position && position.mediaDuration > 0
          ? Math.min(position.mediaDuration, Math.max(0, seconds))
          : Math.max(0, seconds);
      setOptimisticSeek({ value: clamped, setAt: Date.now() });
      try {
        await getHass().callService("media_player", "media_seek", {
          entity_id: queueEntityId,
          seek_position: Math.round(clamped),
        });
      } catch (err) {
        setOptimisticSeek(null);
        showToast(
          err instanceof Error ? err.message : "Failed to seek",
          "error"
        );
      }
    },
    [position, queueEntityId, showToast]
  );

  const handleSkip = useCallback(
    async (deltaSeconds: number) => {
      const targetPos = position
        ? Math.min(
            position.mediaDuration,
            Math.max(0, position.currentPosition + deltaSeconds)
          )
        : undefined;
      if (targetPos !== undefined) {
        setOptimisticSeek({ value: targetPos, setAt: Date.now() });
      }
      try {
        await skipMassQueue(
          isMass ? maEntityId : undefined,
          deltaSeconds,
          queueEntityId,
          position?.currentPosition,
          position?.mediaDuration
        );
      } catch (err) {
        setOptimisticSeek(null);
        showToast(err instanceof Error ? err.message : "Skip failed", "error");
      }
    },
    [position, isMass, maEntityId, queueEntityId, showToast]
  );

  const sourceSelectMenuItems: OverlayMenuItem[] = useMemo(() => {
    return (player.attributes.source_list ?? []).map(source => ({
      label: source,
      onClick: () => {
        getHass().callService("media_player", "select_source", {
          entity_id: player.entity_id,
          source,
        });
      },
    }));
  }, [player.attributes.source_list, player.entity_id]);

  const displayedNow =
    scrubPosition !== null
      ? formatPlaybackTime(scrubPosition)
      : position?.prettyNow;

  return (
    <div css={styles.root}>
      {position && (
        <ProgressBar
          value={position.currentPosition}
          min={0}
          max={position.mediaDuration}
          onSeek={supportsSeek ? handleSeek : undefined}
          onScrubChange={supportsSeek ? setScrubPosition : undefined}
        />
      )}
      <div
        css={[
          styles.timeWrap,
          !player.attributes.source &&
            !showSkipControls &&
            styles.timeWrapNoSource,
        ]}
      >
        <div css={styles.timeSide}>
          {displayedNow && <span>{displayedNow}</span>}
          {showSkipControls && (
            <IconButton
              size="xx-small"
              icon={getSkipIcon("back", skipBackwardSeconds)}
              css={styles.skipBtn}
              title={`Skip back ${skipBackwardSeconds}s`}
              aria-label={`Skip back ${skipBackwardSeconds} seconds`}
              onClick={() => handleSkip(-skipBackwardSeconds)}
            />
          )}
        </div>
        {sourceSelectMenuItems.length > 0 && player.attributes.source && (
          <OverlayMenu
            align="center"
            menuItems={sourceSelectMenuItems}
            renderTrigger={triggerProps => (
              <button {...triggerProps} css={styles.sourceSelect}>
                <Icon
                  size="xx-small"
                  icon={getSourceIcon({
                    source: player.attributes.source ?? "",
                    fallbackIcon: "mdi:import",
                  })}
                />
                {player.attributes.source}
                <Icon size="xx-small" icon="mdi:chevron-down" />
              </button>
            )}
          />
        )}
        <div css={[styles.timeSide, styles.timeSideRight]}>
          {showSkipControls && (
            <IconButton
              size="xx-small"
              icon={getSkipIcon("forward", skipForwardSeconds)}
              css={styles.skipBtn}
              title={`Skip forward ${skipForwardSeconds}s`}
              aria-label={`Skip forward ${skipForwardSeconds} seconds`}
              onClick={() => handleSkip(skipForwardSeconds)}
            />
          )}
          {position && <span>{position.prettyEnd}</span>}
        </div>
      </div>
    </div>
  );
};
