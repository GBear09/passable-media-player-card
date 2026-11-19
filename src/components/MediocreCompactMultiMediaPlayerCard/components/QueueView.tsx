import { IconButton, Queue, useIntl, usePlayer } from "@components";
import { css } from "@emotion/react";
import { theme } from "@constants";
import { useCallback, useMemo } from "preact/compat";
import { useSelectedPlayer } from "@components/SelectedPlayerContext";
import { useMassQueueInfo } from "@hooks";
import { OverlayMenu } from "@components/OverlayMenu/OverlayMenu";
import { getHasMassFeatures, getIsLmsPlayer } from "@utils";

const styles = {
  root: css({
    maxHeight: 300,
    paddingBottom: 12,
    borderTop: `0.5px solid ${theme.colors.onCardDivider}`,
    overflowY: "auto",
  }),
  title: css({
    fontSize: "16px",
    fontWeight: 500,
    color: theme.colors.onCard,
    padding: 0,
    margin: 0,
  }),
  titleRow: css({
    padding: 12,
    paddingBottom: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  }),
  actions: css({
    display: "flex",
    alignItems: "center",
    gap: 6,
  }),
  activeToggle: css({
    color: "var(--primary-color, #03a9f4)",
  }),
};

export const QueueView = () => {
  const { selectedPlayer: { lms_entity_id, ma_entity_id } = {} } =
    useSelectedPlayer();
  const player = usePlayer();
  const { t } = useIntl();

  const isMainEntityMassPlayer = useMemo(
    () => getHasMassFeatures(player.entity_id, ma_entity_id ?? undefined),
    [player.entity_id, ma_entity_id]
  );
  const isMainEntityLmsPlayer = useMemo(
    () => Boolean(lms_entity_id && getIsLmsPlayer(player, lms_entity_id)),
    [player, lms_entity_id]
  );

  const {
    queueInfo,
    updating: queueInfoUpdating,
    canSetAutoplay,
    canSetCrossfade,
    toggleAutoplay,
    toggleCrossfade,
    refetch: refetchQueueInfo,
  } = useMassQueueInfo(
    ma_entity_id,
    Boolean(ma_entity_id && isMainEntityMassPlayer && !isMainEntityLmsPlayer)
  );

  const renderHeader = useCallback(
    (
      refetch: () => void,
      loading: boolean,
      clearQueue: () => void,
      extras?: { clearUpcoming?: () => void; canClearUpcoming?: boolean }
    ) => (
      <div css={styles.titleRow}>
        <h3 css={styles.title}>
          {t({
            id: "MediocreMediaPlayerCard.QueueView.up_next",
            defaultMessage: "Up Next",
          })}
        </h3>
        <div css={styles.actions}>
          {canSetAutoplay && queueInfo && (
            <IconButton
              icon="mdi:infinity"
              size="x-small"
              selected={queueInfo.autoplay_enabled}
              css={queueInfo.autoplay_enabled ? styles.activeToggle : undefined}
              disabled={queueInfoUpdating}
              title={t({
                id: "Queue.autoplay",
                defaultMessage: "Autoplay (Don't Stop the Music)",
              })}
              onClick={toggleAutoplay}
            />
          )}
          {canSetCrossfade && queueInfo && (
            <IconButton
              icon="mdi:waveform"
              size="x-small"
              selected={queueInfo.crossfade_enabled}
              css={
                queueInfo.crossfade_enabled ? styles.activeToggle : undefined
              }
              disabled={queueInfoUpdating}
              title={t({ id: "Queue.crossfade", defaultMessage: "Crossfade" })}
              onClick={toggleCrossfade}
            />
          )}
          {extras?.canClearUpcoming && extras?.clearUpcoming ? (
            <OverlayMenu
              side="bottom"
              align="end"
              menuItems={[
                {
                  label: t({
                    id: "Queue.clear_upcoming",
                    defaultMessage: "Clear Up Next",
                  }),
                  icon: "mdi:playlist-remove",
                  onClick: extras.clearUpcoming,
                },
                {
                  label: t({
                    id: "Queue.clear_all",
                    defaultMessage: "Clear Entire Queue",
                  }),
                  icon: "mdi:delete-sweep",
                  onClick: clearQueue,
                },
              ]}
              renderTrigger={triggerProps => (
                <IconButton
                  icon="mdi:delete-sweep"
                  size="x-small"
                  disabled={loading}
                  title={t({
                    id: "Queue.clear_queue",
                    defaultMessage: "Clear Queue",
                  })}
                  {...triggerProps}
                />
              )}
            />
          ) : (
            <IconButton
              icon="mdi:delete-sweep"
              onClick={clearQueue}
              size="x-small"
              disabled={loading}
              title={t({
                id: "Queue.clear_queue",
                defaultMessage: "Clear Queue",
              })}
            />
          )}
          <IconButton
            icon="mdi:refresh"
            onClick={() => {
              refetch();
              refetchQueueInfo();
            }}
            size="x-small"
            disabled={loading}
            title={t({ id: "Queue.refresh", defaultMessage: "Refresh" })}
          />
        </div>
      </div>
    ),
    [
      t,
      canSetAutoplay,
      canSetCrossfade,
      queueInfo,
      queueInfoUpdating,
      toggleAutoplay,
      toggleCrossfade,
      refetchQueueInfo,
    ]
  );

  return (
    <div css={styles.root} style={{ "--mmpc-search-padding": `${12}px` }}>
      <Queue
        lms_entity_id={lms_entity_id}
        ma_entity_id={ma_entity_id}
        renderHeader={renderHeader}
      />
    </div>
  );
};
