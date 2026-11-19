import { css } from "@emotion/react";
import { Spinner } from "@components/Spinner";
import { IconButton } from "@components/IconButton";
import {
  MaAlbum,
  MaEnqueueMode,
  MaMediaItem,
  MaMediaType,
  MaSearchResponse,
  MaTrack,
} from "./types";
import {
  searchStyles,
  MediaItem,
  MediaSectionTitle,
} from "@components/MediaSearch";
import { VirtualList, VirtualListProps } from "@components/VirtualList";
import { MediaTrack, usePlayer } from "@components";
import { useCallback, useMemo, useState } from "preact/hooks";
import { labelMap, responseKeyMediaTypeMap } from "./constants";
import { MediaGrid } from "@components/MediaSearch/components/MediaGrid";
import { useIntl } from "@components/i18n";
import { useMassDiscover } from "@components/MassDiscoverSheet";
import {
  OverlayMenu,
  OverlayMenuItem,
} from "@components/OverlayMenu/OverlayMenu";
import { useToast } from "@components/Toast";
import {
  hasMassQueueService,
  MassRecommendationFolder,
  startRadioMix,
} from "@utils";

const styles = {
  itemWrap: css({
    position: "relative",
    display: "flex",
    flexDirection: "column",
  }),
  menuAnchor: css({
    position: "absolute",
    top: "4px",
    right: "4px",
    zIndex: 2,
    borderRadius: "50%",
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  }),
};

export type MaMediaItemsListProps = Omit<
  VirtualListProps<MaMediaListItem>,
  "renderItem" | "data"
> & {
  onItemClick: (item: MaMediaItem) => void | Promise<void>;
  onPlayWithMode?: (
    item: MaMediaItem,
    mode: MaEnqueueMode
  ) => void | Promise<void>;
  onHeaderClick?: (mediaType: MaMediaType) => void;
  maEntityId?: string;
  loading?: boolean;
  error?: string | null;
  results?: MaSearchResponse;
  recommendationFolders?: MassRecommendationFolder[];
};

type MaMediaListItem =
  | {
      type: "header";
      mediaType: MaMediaType; // placed between items of different media_types
    }
  | {
      type: "folderHeader";
      title: string;
    }
  | {
      type: "item"; // if item has media_class: track
      item: MaMediaItem;
    }
  | {
      type: "itemsRow"; // if item has other media_class should be in chunks of chunkSize items
      items: MaMediaItem[];
    };

export const MaMediaItemsList = ({
  onItemClick,
  onPlayWithMode,
  onHeaderClick,
  maEntityId,
  loading = false,
  error = null,
  results,
  recommendationFolders,
  ...listProps
}: MaMediaItemsListProps) => {
  const { t } = useIntl();
  const { showToast } = useToast();
  const {
    openSimilar,
    openCollection,
    isSupported: isDiscoverSupported,
  } = useMassDiscover();
  const player = usePlayer();
  const [chunkSize, setChunkSize] = useState(4);

  const getTrackArtistsText = (mediaItem: MaMediaItem): string | undefined => {
    const track = mediaItem as Partial<MaTrack>;
    if (Array.isArray(track.artists) && track.artists.length > 0) {
      return track.artists.map(a => a.name).join(", ");
    }
    return undefined;
  };

  const getAlbumArtistsText = (mediaItem: MaMediaItem): string | undefined => {
    const album = mediaItem as Partial<MaAlbum>;
    if (Array.isArray(album.artists) && album.artists.length > 0) {
      return album.artists.map(a => a.name).join(", ");
    }
    return undefined;
  };

  const buildItemMenu = useCallback(
    (mediaItem: MaMediaItem): OverlayMenuItem[] => {
      if (!maEntityId) return [];
      const menu: OverlayMenuItem[] = [];
      const targetEntityId = player?.entity_id || maEntityId;
      const playMode = onPlayWithMode ?? ((item, _mode) => onItemClick(item));

      menu.push(
        {
          label: t({ id: "Search.enqueue_mode.play", defaultMessage: "Play" }),
          icon: "mdi:play-circle",
          onClick: () => playMode(mediaItem, "play"),
        },
        {
          label: t({
            id: "Search.enqueue_mode.next",
            defaultMessage: "Add Next",
          }),
          icon: "mdi:playlist-play",
          onClick: () => playMode(mediaItem, "next"),
        },
        {
          label: t({
            id: "Search.enqueue_mode.add",
            defaultMessage: "Add to Queue",
          }),
          icon: "mdi:playlist-plus",
          onClick: () => playMode(mediaItem, "add"),
        }
      );

      if (isDiscoverSupported) {
        if (
          mediaItem.media_type === "track" &&
          hasMassQueueService("get_similar_tracks")
        ) {
          menu.push({
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
                trackUri: mediaItem.uri,
                title: mediaItem.name,
                artist: getTrackArtistsText(mediaItem),
              }),
          });
        }

        if (
          mediaItem.media_type === "artist" &&
          hasMassQueueService("get_similar_artists")
        ) {
          menu.push({
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
                artistUri: mediaItem.uri,
                title: mediaItem.name,
                artist: mediaItem.name,
              }),
          });
        }

        if (
          mediaItem.media_type === "artist" &&
          hasMassQueueService("get_artist_tracks")
        ) {
          menu.push({
            label: t({
              id: "Discover.view_top_tracks",
              defaultMessage: "View Top Tracks",
            }),
            icon: "mdi:format-list-bulleted",
            onClick: () =>
              openCollection({
                maEntityId,
                targetEntityId,
                mediaType: "artist",
                uri: mediaItem.uri,
                title: mediaItem.name,
                subtitle: "Top Tracks",
                imageUrl: mediaItem.image,
              }),
          });
        }

        if (
          mediaItem.media_type === "album" &&
          hasMassQueueService("get_album_tracks")
        ) {
          menu.push({
            label: t({
              id: "Discover.view_tracks",
              defaultMessage: "View Tracks",
            }),
            icon: "mdi:format-list-bulleted",
            onClick: () =>
              openCollection({
                maEntityId,
                targetEntityId,
                mediaType: "album",
                uri: mediaItem.uri,
                title: mediaItem.name,
                subtitle: getAlbumArtistsText(mediaItem),
                imageUrl: mediaItem.image,
              }),
          });
        }

        if (
          mediaItem.media_type === "playlist" &&
          hasMassQueueService("get_playlist_tracks")
        ) {
          menu.push({
            label: t({
              id: "Discover.view_tracks",
              defaultMessage: "View Tracks",
            }),
            icon: "mdi:format-list-bulleted",
            onClick: () =>
              openCollection({
                maEntityId,
                targetEntityId,
                mediaType: "playlist",
                uri: mediaItem.uri,
                title: mediaItem.name,
                subtitle: "Playlist",
                imageUrl: mediaItem.image,
              }),
          });
        }

        if (
          mediaItem.media_type === "podcast" &&
          hasMassQueueService("get_podcast_episodes")
        ) {
          menu.push({
            label: t({
              id: "Discover.view_episodes",
              defaultMessage: "View Episodes",
            }),
            icon: "mdi:podcast",
            onClick: () =>
              openCollection({
                maEntityId,
                targetEntityId,
                mediaType: "podcast",
                uri: mediaItem.uri,
                title: mediaItem.name,
                subtitle: "Episodes",
                imageUrl: mediaItem.image,
              }),
          });
        }
      }

      if (
        mediaItem.media_type === "track" ||
        mediaItem.media_type === "artist" ||
        mediaItem.media_type === "album"
      ) {
        const radioSeedType = mediaItem.media_type;
        menu.push({
          label: t({
            id: "AdditionalActionsMenu.start_radio_mix",
            defaultMessage: "Start Radio Mix",
          }),
          icon: "mdi:radio-tower",
          onClick: async () => {
            try {
              await startRadioMix(
                targetEntityId,
                maEntityId,
                mediaItem.uri,
                radioSeedType
              );
              showToast(`Started Radio: ${mediaItem.name}`, "success");
            } catch (err) {
              showToast(
                err instanceof Error
                  ? err.message
                  : "Failed to start Radio Mix",
                "error"
              );
            }
          },
        });
      }

      return menu;
    },
    [
      maEntityId,
      player?.entity_id,
      onPlayWithMode,
      onItemClick,
      isDiscoverSupported,
      openSimilar,
      openCollection,
      showToast,
      t,
    ]
  );

  const data: MaMediaListItem[] = useMemo(() => {
    const newItems: MaMediaListItem[] = [];

    if (recommendationFolders) {
      recommendationFolders.forEach(folder => {
        if (!folder.items || folder.items.length === 0) return;
        newItems.push({ type: "folderHeader", title: folder.name });
        const folderItems: MaMediaItem[] = folder.items.map(item => ({
          media_type: item.media_type as MaMediaType,
          uri: item.uri,
          name: item.name,
          version: "",
          image: item.image ?? null,
        }));
        const tracks = folderItems.filter(i => i.media_type === "track");
        const nonTracks = folderItems.filter(i => i.media_type !== "track");
        tracks.forEach(item => newItems.push({ type: "item", item }));
        for (let i = 0; i < nonTracks.length; i += chunkSize) {
          newItems.push({
            type: "itemsRow",
            items: nonTracks.slice(i, i + chunkSize),
          });
        }
      });
      return newItems;
    }

    if (!results) return newItems;

    const groupedResults: { mediaType: MaMediaType; items: MaMediaItem[] }[] =
      Object.entries(results)
        .map(([mediaType, mediaItems]) => ({
          mediaType: responseKeyMediaTypeMap[mediaType],
          items: mediaItems,
        }))
        .filter(groupedResult => groupedResult.items.length > 0);

    groupedResults.forEach(({ mediaType, items: mediaItems }) => {
      if (mediaItems.length === 0) return;

      // Add header for the media type
      if (groupedResults.length > 1) {
        newItems.push({
          type: "header",
          mediaType,
        });
      }

      // If media class is track, add as individual items
      if (mediaItems[0].media_type === "track") {
        mediaItems.forEach((item: MaMediaItem) => {
          newItems.push({
            type: "item",
            item,
          });
        });
      } else {
        // Other media types are grouped in rows of chunkSize
        for (let i = 0; i < mediaItems.length; i += chunkSize) {
          const chunk = mediaItems.slice(i, i + chunkSize);
          newItems.push({
            type: "itemsRow",
            items: chunk,
          });
        }
      }
    });
    return newItems;
  }, [results, recommendationFolders, chunkSize]);

  const renderMediaTile = (mediaItem: MaMediaItem) => {
    const handleClick = async () => {
      await onItemClick(mediaItem);
    };

    if (mediaItem.media_type === "track") {
      const menu = buildItemMenu(mediaItem);
      return (
        <MediaTrack
          key={mediaItem.uri}
          imageUrl={
            (mediaItem as Partial<MaTrack>).image ??
            (mediaItem as Partial<MaTrack>).album?.image
          }
          title={mediaItem.name}
          artist={getTrackArtistsText(mediaItem)}
          onClick={handleClick}
          actionsMenu={menu.length > 0 ? menu : undefined}
        />
      );
    }

    const menu = buildItemMenu(mediaItem);
    const tile = (
      <MediaItem
        key={mediaItem.uri}
        imageUrl={mediaItem.image}
        name={mediaItem.name}
        artist={getAlbumArtistsText(mediaItem)}
        onClick={handleClick}
      />
    );

    if (menu.length === 0) {
      return tile;
    }

    return (
      <div key={mediaItem.uri} css={styles.itemWrap}>
        {tile}
        <div
          css={styles.menuAnchor}
          onClick={e => {
            e.stopPropagation();
          }}
        >
          <OverlayMenu
            align="end"
            side="bottom"
            menuItems={menu}
            renderTrigger={triggerProps => (
              <IconButton
                icon="mdi:dots-vertical"
                size="xx-small"
                type="button"
                title="Item actions"
                aria-label="Item actions"
                {...triggerProps}
              />
            )}
          />
        </div>
      </div>
    );
  };

  const renderItem = (item: MaMediaListItem) => {
    switch (item.type) {
      case "header": {
        return (
          <MediaSectionTitle onClick={() => onHeaderClick?.(item.mediaType)}>
            {t({
              id: `Search.categories.${labelMap[item.mediaType]}`,
              defaultMessage: labelMap[item.mediaType],
            })}
          </MediaSectionTitle>
        );
      }

      case "folderHeader": {
        return <MediaSectionTitle>{item.title}</MediaSectionTitle>;
      }

      case "item": {
        return (
          <MediaGrid numberOfColumns={chunkSize}>
            {renderMediaTile(item.item)}
          </MediaGrid>
        );
      }

      case "itemsRow":
        return (
          <MediaGrid numberOfColumns={chunkSize}>
            {item.items.map(mediaItem => renderMediaTile(mediaItem))}
          </MediaGrid>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return <Spinner />;
  }

  if (error) {
    return <p css={searchStyles.mediaEmptyText}>{error}</p>;
  }

  return (
    <VirtualList
      onLayout={({ width }) => {
        if (width > 800) {
          setChunkSize(6);
        } else if (width > 390) {
          setChunkSize(4);
        } else {
          setChunkSize(3);
        }
      }}
      data={data}
      renderItem={renderItem}
      renderEmpty={() => (
        <p css={searchStyles.mediaEmptyText}>
          {t({
            id: "Search.no_results",
            defaultMessage: "No results found.",
          })}
        </p>
      )}
      {...listProps}
    />
  );
};
