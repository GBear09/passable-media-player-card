import { css } from "@emotion/react";
import { ViewHeader } from "./ViewHeader";
import { useIntl } from "@components/i18n";
import { memo, useCallback, useContext, useMemo } from "preact/compat";
import { IconButton, Queue, useHass, usePlayer } from "@components";
import { theme } from "@constants";
import { useSelectedPlayer } from "@components/SelectedPlayerContext";
import { CardContext, CardContextType } from "@components/CardContext";
import { MediocreMultiMediaPlayerCardConfig } from "@types";
import {
  getHasMassFeatures,
  getIsLmsPlayer,
  transferLmsQueue,
  transferMaQueue,
} from "@utils";
import {
  OverlayMenu,
  OverlayMenuItem,
} from "@components/OverlayMenu/OverlayMenu";
import { useMassQueueInfo } from "@hooks";
import { useToast } from "@components/Toast";

const styles = {
  root: css({
    height: "100%",
    overflowY: "auto",
  }),
  header: css({
    padding: "12px 16px 12px 16px",
  }),
  itemPlaying: css({
    border: `1px solid ${theme.colors.onCardDivider}`,
  }),
  headerActions: css({
    display: "flex",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
  }),
  activeToggle: css({
    color: "var(--primary-color, #03a9f4)",
  }),
};

export type QueueViewProps = {
  height: number;
};

export const QueueView = memo<QueueViewProps>(({ height }) => {
  const { t } = useIntl();
  const { showToast } = useToast();
  const { selectedPlayer, setSelectedPlayer } = useSelectedPlayer();
  const { lms_entity_id, ma_entity_id, entity_id } = selectedPlayer!;
  const { config } =
    useContext<CardContextType<MediocreMultiMediaPlayerCardConfig>>(
      CardContext
    );
  const mediaPlayers = useMemo(
    () => config?.media_players ?? [],
    [config?.media_players]
  );
  const hass = useHass();
  const player = usePlayer();

  const isMainEntityMassPlayer = useMemo(
    () => getHasMassFeatures(player.entity_id, ma_entity_id),
    [player, ma_entity_id]
  );
  const isMainEntityLmsPlayer = useMemo(
    () => lms_entity_id && getIsLmsPlayer(player, lms_entity_id),
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

  const transferQueue = useCallback(
    async (targetEntity: string, targetName: string) => {
      if (!ma_entity_id) return;
      try {
        await transferMaQueue(ma_entity_id, targetEntity);
        showToast(`Transferred queue to ${targetName}`, "success");
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "Failed to transfer queue",
          "error"
        );
      }
    },
    [ma_entity_id, showToast]
  );

  const maTransferMenuItems: OverlayMenuItem[] = useMemo(() => {
    if (!ma_entity_id || !isMainEntityMassPlayer) return [];
    const items: (OverlayMenuItem | null)[] = mediaPlayers.map(mp => {
      if (!mp.ma_entity_id) return null;
      const state = hass.states[mp.entity_id];
      if (!state || state.state === "unavailable" || mp.entity_id === entity_id)
        return null;
      const label = mp.name || state.attributes.friendly_name || mp.entity_id;
      return {
        label,
        onClick: () => {
          if (!mp.ma_entity_id) return;
          transferQueue(mp.ma_entity_id, label);
          setSelectedPlayer(mp);
        },
      };
    });

    return items.filter(item => item !== null) as OverlayMenuItem[];
  }, [
    isMainEntityMassPlayer,
    ma_entity_id,
    entity_id,
    hass.states,
    transferQueue,
    mediaPlayers,
    setSelectedPlayer,
  ]);

  const lmsTransferMenuItems: OverlayMenuItem[] = useMemo(() => {
    if (!lms_entity_id || !isMainEntityLmsPlayer) return [];
    const items: (OverlayMenuItem | null)[] = mediaPlayers.map(mp => {
      if (!mp.lms_entity_id) return null;
      const state = hass.states[mp.entity_id];
      if (!state || state.state === "unavailable" || mp.entity_id === entity_id)
        return null;
      return {
        label: mp.name || state.attributes.friendly_name || mp.entity_id,
        onClick: () => {
          if (!mp.lms_entity_id) return;
          transferLmsQueue(lms_entity_id, mp.lms_entity_id);
          setSelectedPlayer(mp);
        },
      };
    });

    return items.filter(item => item !== null) as OverlayMenuItem[];
  }, [
    isMainEntityLmsPlayer,
    lms_entity_id,
    entity_id,
    hass.states,
    mediaPlayers,
    setSelectedPlayer,
  ]);

  const transferMenuItems = isMainEntityLmsPlayer
    ? lmsTransferMenuItems
    : maTransferMenuItems;

  const renderHeader = useCallback(
    (
      refetch: () => void,
      loading: boolean,
      clearQueue: () => void,
      extras?: { clearUpcoming?: () => void; canClearUpcoming?: boolean }
    ) => (
      <ViewHeader
        title={t({
          id: "MediocreMultiMediaPlayerCard.QueueView.up_next",
          defaultMessage: "Up Next",
        })}
        subtitle={t({
          id: "MediocreMultiMediaPlayerCard.QueueView.up_next_subtitle",
          defaultMessage: "Current playback queue",
        })}
        css={styles.header}
        renderAction={() => (
          <div css={styles.headerActions}>
            {canSetAutoplay && queueInfo && (
              <IconButton
                icon="mdi:infinity"
                size="x-small"
                selected={queueInfo.autoplay_enabled}
                css={
                  queueInfo.autoplay_enabled ? styles.activeToggle : undefined
                }
                disabled={queueInfoUpdating}
                title={t({
                  id: "Queue.autoplay",
                  defaultMessage: "Autoplay (Don't Stop the Music)",
                })}
                aria-label={t({
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
                title={t({
                  id: "Queue.crossfade",
                  defaultMessage: "Crossfade",
                })}
                aria-label={t({
                  id: "Queue.crossfade",
                  defaultMessage: "Crossfade",
                })}
                onClick={toggleCrossfade}
              />
            )}
            {transferMenuItems.length > 0 && (
              <OverlayMenu
                menuItems={transferMenuItems}
                side="bottom"
                align="end"
                renderTrigger={triggerProps => (
                  <IconButton
                    icon="mdi:transfer"
                    size="x-small"
                    disabled={loading}
                    title={t({
                      id: "AdditionalActionsMenu.transfer_queue",
                      defaultMessage: "Transfer Queue",
                    })}
                    {...triggerProps}
                  />
                )}
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
        )}
      />
    ),
    [
      t,
      transferMenuItems,
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
    <div
      css={styles.root}
      style={{ maxHeight: height, "--mmpc-search-padding": `${16}px` }}
    >
      <Queue
        height={height}
        lms_entity_id={lms_entity_id}
        ma_entity_id={ma_entity_id}
        renderHeader={renderHeader}
      />
    </div>
  );
});
