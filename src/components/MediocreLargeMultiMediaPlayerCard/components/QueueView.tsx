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
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  }),
};

export type QueueViewProps = {
  height: number;
};

export const QueueView = memo<QueueViewProps>(({ height }) => {
  const { t } = useIntl();
  const { selectedPlayer, setSelectedPlayer } = useSelectedPlayer();
  const { lms_entity_id, ma_entity_id, entity_id } = selectedPlayer!;
  const { config } =
    useContext<CardContextType<MediocreMultiMediaPlayerCardConfig>>(
      CardContext
    );
  const mediaPlayers = config?.media_players ?? [];
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

  const transferQueue = useCallback(
    (targetEntity: string) => {
      if (!ma_entity_id) return;
      transferMaQueue(ma_entity_id, targetEntity);
    },
    [ma_entity_id]
  );

  const maTransferMenuItems: OverlayMenuItem[] = useMemo(() => {
    if (!ma_entity_id || !isMainEntityMassPlayer) return [];
    const items: (OverlayMenuItem | null)[] = mediaPlayers.map(mp => {
      if (!mp.ma_entity_id) return null;
      const state = hass.states[mp.entity_id];
      if (!state || state.state === "unavailable" || mp.entity_id === entity_id)
        return null;
      return {
        label: mp.name || state.attributes.friendly_name || mp.entity_id,
        onClick: () => {
          if (!mp.ma_entity_id) return;
          transferQueue(mp.ma_entity_id);
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
    (refetch: () => void, loading: boolean, clearQueue: () => void) => (
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
                    {...triggerProps}
                  />
                )}
              />
            )}
            <IconButton
              icon="mdi:delete-sweep"
              onClick={clearQueue}
              size="x-small"
              disabled={loading}
            />
            <IconButton
              icon="mdi:refresh"
              onClick={refetch}
              size="x-small"
              disabled={loading}
            />
          </div>
        )}
      />
    ),
    [t, transferMenuItems]
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
