import {
  MediaGrid,
  MediaTrack,
  Spinner,
  usePlayer,
  VirtualList,
} from "@components";
import { useIntl } from "@components/i18n";
import { useMassDiscover } from "@components/MassDiscoverSheet";
import { OverlayMenuItem } from "@components/OverlayMenu/OverlayMenu";
import { useToast } from "@components/Toast";
import { theme } from "@constants";
import { css } from "@emotion/react";
import { useMassQueue, useSqueezeboxQueue } from "@hooks";
import { QueueItem } from "@types";
import {
  getCanDisplayLmsQueue,
  getCanDisplayMAQueue,
  getHasMassFeatures,
  getIsLmsPlayer,
  hasMassQueueService,
  startRadioMix,
} from "@utils";
import type { ComponentChildren } from "preact";
import { FC, memo, useCallback, useMemo } from "preact/compat";

type QueueProps = {
  height?: number;
  ma_entity_id?: string | null;
  lms_entity_id?: string | null;
  renderHeader?: (
    refetch: () => void,
    loading: boolean,
    clearQueue: () => void,
    extras?: {
      clearUpcoming?: () => void;
      canClearUpcoming?: boolean;
    }
  ) => ComponentChildren;
};

const styles = {
  itemPlaying: css({
    border: `1px solid ${theme.colors.onCardDivider}`,
  }),
  emptyText: css({
    textAlign: "center",
    padding: "24px 16px",
    color: theme.colors.onCardMuted,
    fontSize: "14px",
  }),
};

export const Queue: FC<QueueProps> = ({
  height,
  ma_entity_id,
  lms_entity_id,
  renderHeader,
}) => {
  const player = usePlayer();
  const { t } = useIntl();

  const isMainEntityLmsPlayer = useMemo(
    () => lms_entity_id && getIsLmsPlayer(player, lms_entity_id),
    [player, lms_entity_id]
  );

  const isMainEntityMAPlayer = useMemo(
    () => getHasMassFeatures(player.entity_id, ma_entity_id ?? undefined),
    [player, ma_entity_id]
  );

  const {
    queue: lmsQueue,
    loading: lmsLoading,
    refetch: lmsRefetch,
    error: lmsError,
    clearQueue: lmsClearQueue,
  } = useSqueezeboxQueue(
    lms_entity_id ?? "",
    !!isMainEntityLmsPlayer && getCanDisplayLmsQueue()
  );

  const {
    queue: maQueue,
    loading: maLoading,
    refetch: maRefetch,
    error: maError,
    clearQueue: maClearQueue,
    clearUpcoming: maClearUpcoming,
    canClearUpcoming: maCanClearUpcoming,
  } = useMassQueue(
    ma_entity_id ?? "",
    !!isMainEntityMAPlayer && getCanDisplayMAQueue()
  );

  const queue = isMainEntityLmsPlayer ? lmsQueue : maQueue;
  const loading = isMainEntityLmsPlayer ? lmsLoading : maLoading;
  const refetch = isMainEntityLmsPlayer ? lmsRefetch : maRefetch;
  const error = isMainEntityLmsPlayer ? lmsError : maError;
  const clearQueue = isMainEntityLmsPlayer ? lmsClearQueue : maClearQueue;
  const clearUpcoming = isMainEntityLmsPlayer ? undefined : maClearUpcoming;
  const canClearUpcoming = isMainEntityLmsPlayer ? false : maCanClearUpcoming;

  const effectiveMaEntityId = isMainEntityLmsPlayer
    ? undefined
    : (ma_entity_id ?? undefined);

  const renderItem = useCallback(
    (item: QueueItem) => {
      return (
        <QueueListItem
          item={item}
          maEntityId={effectiveMaEntityId}
          targetEntityId={player.entity_id}
        />
      );
    },
    [effectiveMaEntityId, player.entity_id]
  );

  return (
    <VirtualList<QueueItem>
      maxHeight={height}
      data={queue}
      renderHeader={
        renderHeader
          ? () =>
              renderHeader(refetch, loading, clearQueue, {
                clearUpcoming,
                canClearUpcoming,
              })
          : undefined
      }
      keyExtractor={item => item.id + item.playlistIndex}
      renderEmpty={
        loading
          ? () => <Spinner />
          : error
            ? () => <div css={styles.emptyText}>{error}</div>
            : () => (
                <div css={styles.emptyText}>
                  {t({
                    id: "Queue.empty",
                    defaultMessage: "No items in queue.",
                  })}
                </div>
              )
      }
      renderItem={renderItem}
    />
  );
};

const QueueListItem = memo<{
  item: QueueItem;
  maEntityId?: string;
  targetEntityId: string;
}>(({ item, maEntityId, targetEntityId }) => {
  const { t } = useIntl();
  const { showToast } = useToast();
  const { openSimilar } = useMassDiscover();

  const actionsMenu: OverlayMenuItem[] = useMemo(() => {
    const items: OverlayMenuItem[] = [];
    if (!item.isPlaying && item.moveItemNext) {
      items.push({
        label: t({
          id: "Queue.play_next",
          defaultMessage: "Play Next",
        }),
        icon: "mdi:playlist-play",
        onClick: () => {
          item.moveItemNext?.();
        },
      });
    }

    if (maEntityId) {
      if (item.uri && hasMassQueueService("get_similar_tracks")) {
        items.push({
          label: t({
            id: "Discover.similar_tracks",
            defaultMessage: "Similar Tracks",
          }),
          icon: "mdi:playlist-music-outline",
          onClick: () =>
            openSimilar({
              initialTab: "tracks",
              maEntityId,
              targetEntityId,
              trackUri: item.uri,
              title: item.title,
              artist: item.artist,
            }),
        });
      }
      if (item.artist && hasMassQueueService("get_similar_artists")) {
        items.push({
          label: t({
            id: "Discover.similar_artists",
            defaultMessage: "Similar Artists",
          }),
          icon: "mdi:account-group-outline",
          onClick: () =>
            openSimilar({
              initialTab: "artists",
              maEntityId,
              targetEntityId,
              trackUri: item.uri,
              title: item.title,
              artist: item.artist,
            }),
        });
      }
      if (item.uri || item.title) {
        items.push({
          label: t({
            id: "AdditionalActionsMenu.song_radio",
            defaultMessage: "Song Radio",
          }),
          icon: "mdi:radio-tower",
          onClick: async () => {
            try {
              await startRadioMix(
                targetEntityId,
                maEntityId,
                item.uri || item.title,
                "track"
              );
              showToast(`Started Song Radio: ${item.title}`, "success");
            } catch (err) {
              showToast(
                err instanceof Error
                  ? err.message
                  : "Failed to start Song Radio",
                "error"
              );
            }
          },
        });
      }
    }

    if (!item.isPlaying && maEntityId) {
      items.push({
        label: t({
          id: "Queue.remove",
          defaultMessage: "Remove from Queue",
        }),
        icon: "mdi:delete",
        onClick: () => {
          item.deleteItem();
        },
      });
    }

    return items;
  }, [item, maEntityId, targetEntityId, openSimilar, showToast, t]);

  const buttons = useMemo(() => {
    if (item.isPlaying) {
      return [];
    }

    const list: {
      icon: string;
      title?: string;
      onClick: () => void;
      disabled?: boolean;
    }[] = [];

    if (!maEntityId) {
      list.push({
        onClick: item.deleteItem,
        icon: "mdi:delete",
        title: t({ id: "Queue.remove", defaultMessage: "Remove from Queue" }),
      });
    }

    const canMoveUp =
      item.canMoveUp !== undefined ? item.canMoveUp : !item.isFirst;

    list.push(
      {
        onClick: () => {
          if (item.moveItem) {
            return item.moveItem(item.playlistIndex - 1);
          }
          if (item.moveItemUp) {
            return item.moveItemUp();
          }
        },
        disabled: !canMoveUp,
        icon: "mdi:arrow-up-bold-outline",
        title: t({ id: "Queue.move_up", defaultMessage: "Move Up" }),
      },
      {
        onClick: () => {
          if (item.moveItem) {
            return item.moveItem(item.playlistIndex + 1);
          }
          if (item.moveItemDown) {
            return item.moveItemDown();
          }
        },
        disabled: item.isLast,
        icon: "mdi:arrow-down-bold-outline",
        title: t({ id: "Queue.move_down", defaultMessage: "Move Down" }),
      }
    );

    return list;
  }, [item, maEntityId, t]);

  const artistLabel = [
    item.artist || "",
    item.album,
    item.favorite ? "♥" : undefined,
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <MediaGrid numberOfColumns={1}>
      <MediaTrack
        css={item.isPlaying ? styles.itemPlaying : undefined}
        imageUrl={item.artworkUrl}
        title={item.title}
        artist={artistLabel}
        onClick={item.skipToItem}
        buttons={buttons}
        actionsMenu={actionsMenu.length > 0 ? actionsMenu : undefined}
      />
    </MediaGrid>
  );
});
