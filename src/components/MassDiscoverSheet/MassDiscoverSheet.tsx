import { css, keyframes } from "@emotion/react";
import { memo } from "preact/compat";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "preact/hooks";
import {
  Chip,
  Icon,
  IconButton,
  MediaGrid,
  MediaItem,
  MediaTrack,
  Spinner,
} from "@components";
import { useIntl } from "@components/i18n";
import {
  OverlayMenu,
  OverlayMenuItem,
} from "@components/OverlayMenu/OverlayMenu";
import { useToast } from "@components/Toast";
import { theme } from "@constants";
import {
  filterOutSeedTrack,
  formatPlaybackTime,
  getCollectionTracks,
  getSimilarArtists,
  getSimilarTracks,
  hasMassQueueService,
  MaEnqueueMode,
  MassSimilarArtist,
  MassTrackItem,
  playMassMedia,
  playMassTracksProgressive,
  resolveArtistUri,
  resolveCurrentTrackUri,
  startRadioMix,
} from "@utils";
import {
  CollectionFrame,
  SimilarFrame,
  useMassDiscover,
} from "./MassDiscoverContext";

const slideUp = keyframes`
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0%);
    opacity: 1;
  }
`;

const fadeIn = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`;

const styles = {
  overlay: css({
    position: "absolute",
    inset: 0,
    zIndex: 55,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    backdropFilter: "blur(4px)",
    animation: `${fadeIn} 0.2s ease-out`,
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-end",
    overflow: "hidden",
  }),
  overlayFixed: css({
    position: "fixed",
    alignItems: "center",
  }),
  clickableBackdrop: css({
    position: "absolute",
    inset: 0,
    zIndex: 0,
  }),
  bottomSheet: css({
    position: "relative",
    zIndex: 1,
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: "16px",
    borderTopRightRadius: "16px",
    border: "1px solid var(--ha-card-border-color, rgba(255, 255, 255, 0.12))",
    borderBottom: "none",
    maxHeight: "88%",
    width: "100%",
    maxWidth: "540px",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 -8px 32px rgba(0, 0, 0, 0.45)",
    animation: `${slideUp} 0.26s cubic-bezier(0.2, 0.9, 0.3, 1) forwards`,
    overflow: "hidden",
    containerType: "inline-size",
  }),
  handleBar: css({
    width: "36px",
    height: "4px",
    borderRadius: "2px",
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    margin: "8px auto 0 auto",
    flexShrink: 0,
  }),
  header: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 16px 10px 16px",
    borderBottom: "1px solid var(--divider-color, rgba(255, 255, 255, 0.1))",
    flexShrink: 0,
    gap: "8px",
  }),
  headerLeft: css({
    display: "flex",
    alignItems: "center",
    gap: "8px",
    minWidth: 0,
    flex: 1,
  }),
  titleWrap: css({
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  }),
  title: css({
    margin: 0,
    fontSize: "15px",
    fontWeight: 600,
    color: theme.colors.onCard,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  }),
  subtitle: css({
    margin: 0,
    fontSize: "12px",
    color: theme.colors.onCardMuted,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  }),
  tabsRow: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    padding: "10px 16px 6px 16px",
    flexShrink: 0,
    flexWrap: "wrap",
  }),
  tabGroup: css({
    display: "flex",
    alignItems: "center",
    gap: "6px",
  }),
  toolbarRow: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    padding: "6px 16px 8px 16px",
    flexShrink: 0,
    flexWrap: "wrap",
  }),
  toolbarGroup: css({
    display: "flex",
    alignItems: "center",
    gap: "6px",
    flexWrap: "wrap",
  }),
  content: css({
    padding: "4px 16px 16px 16px",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    minHeight: "140px",
  }),
  artistGrid: css({
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "8px",
    "@container (min-width: 480px)": {
      gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    },
  }),
  centeredState: css({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "28px 16px",
    textAlign: "center",
    color: theme.colors.onCardMuted,
    fontSize: "13px",
  }),
};

export type MassDiscoverSheetProps = {
  mode?: "embedded" | "modal";
};

export const MassDiscoverSheet = memo<MassDiscoverSheetProps>(
  ({ mode = "embedded" }) => {
    const { stack, isOpen, goBack, close } = useMassDiscover();
    const { t } = useIntl();

    useEffect(() => {
      if (!isOpen) return;
      const handleKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") close();
      };
      document.addEventListener("keydown", handleKey);
      return () => document.removeEventListener("keydown", handleKey);
    }, [isOpen, close]);

    if (!isOpen || stack.length === 0) return null;

    const currentFrame = stack[stack.length - 1];

    const headerTitle =
      currentFrame.type === "similar"
        ? currentFrame.title ||
          currentFrame.artist ||
          t({
            id: "Discover.title",
            defaultMessage: "Discover",
          })
        : currentFrame.title;

    const headerSubtitle =
      currentFrame.type === "similar"
        ? currentFrame.artist && currentFrame.title
          ? currentFrame.artist
          : t({
              id: "Discover.subtitle",
              defaultMessage: "Similar music in Music Assistant",
            })
        : currentFrame.subtitle;

    return (
      <div css={[styles.overlay, mode === "modal" && styles.overlayFixed]}>
        <div css={styles.clickableBackdrop} onClick={close} />
        <div css={styles.bottomSheet}>
          <div css={styles.handleBar} />
          <div css={styles.header}>
            <div css={styles.headerLeft}>
              {stack.length > 1 ? (
                <IconButton
                  icon="mdi:arrow-left"
                  size="small"
                  title={t({ id: "Discover.back", defaultMessage: "Back" })}
                  onClick={goBack}
                />
              ) : (
                <Icon size="small" icon="mdi:compass-outline" />
              )}
              <div css={styles.titleWrap}>
                <h3 css={styles.title}>{headerTitle}</h3>
                {headerSubtitle && (
                  <span css={styles.subtitle}>{headerSubtitle}</span>
                )}
              </div>
            </div>
            <IconButton
              icon="mdi:close"
              size="small"
              title={t({ id: "Discover.close", defaultMessage: "Close" })}
              onClick={close}
            />
          </div>

          {currentFrame.type === "similar" ? (
            <SimilarFrameView frame={currentFrame} />
          ) : (
            <CollectionFrameView frame={currentFrame} />
          )}
        </div>
      </div>
    );
  }
);

const SimilarFrameView = ({ frame }: { frame: SimilarFrame }) => {
  const { t } = useIntl();
  const { showToast } = useToast();
  const { pushSimilar, pushCollection } = useMassDiscover();

  const canSimilarTracks =
    hasMassQueueService("get_similar_tracks") &&
    Boolean(frame.trackUri || frame.title);
  const canSimilarArtists =
    hasMassQueueService("get_similar_artists") &&
    Boolean(
      frame.artistUri ||
      frame.artist ||
      frame.artistNameFallback ||
      frame.trackUri
    );

  const [activeTab, setActiveTab] = useState<"tracks" | "artists">(
    frame.initialTab
  );
  const [enqueueMode, setEnqueueMode] = useState<MaEnqueueMode>("play");

  const [tracks, setTracks] = useState<MassTrackItem[]>([]);
  const [tracksLoading, setTracksLoading] = useState(false);
  const [tracksError, setTracksError] = useState<string | null>(null);
  const [tracksLoadedKey, setTracksLoadedKey] = useState("");

  const [artists, setArtists] = useState<MassSimilarArtist[]>([]);
  const [artistsLoading, setArtistsLoading] = useState(false);
  const [artistsError, setArtistsError] = useState<string | null>(null);
  const [artistsLoadedKey, setArtistsLoadedKey] = useState("");

  const [resolvedTrackUri, setResolvedTrackUri] = useState<string | null>(
    frame.trackUri ?? null
  );
  const [bulkAction, setBulkAction] = useState<"play" | "add" | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{
    queued: number;
    total: number;
  } | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const frameKey = JSON.stringify({
    maEntityId: frame.maEntityId,
    trackUri: frame.trackUri,
    artistUri: frame.artistUri,
    title: frame.title,
    artist: frame.artist,
    artistNameFallback: frame.artistNameFallback,
  });
  const activeFrameKeyRef = useRef(frameKey);
  activeFrameKeyRef.current = frameKey;

  useEffect(() => {
    const preferred =
      frame.initialTab === "artists" && canSimilarArtists
        ? "artists"
        : frame.initialTab === "tracks" && canSimilarTracks
          ? "tracks"
          : canSimilarTracks
            ? "tracks"
            : "artists";
    setActiveTab(preferred);
    setTracks([]);
    setArtists([]);
    setTracksError(null);
    setArtistsError(null);
    setTracksLoadedKey("");
    setArtistsLoadedKey("");
    setResolvedTrackUri(frame.trackUri ?? null);
    setBulkAction(null);
    setBulkProgress(null);
  }, [
    frameKey,
    frame.initialTab,
    frame.trackUri,
    canSimilarArtists,
    canSimilarTracks,
  ]);

  // Fetch similar tracks lazily when tracks tab is active
  useEffect(() => {
    if (activeTab !== "tracks" || !canSimilarTracks) return;
    if (tracksLoadedKey === frameKey) return;

    let cancelled = false;
    setTracksLoading(true);
    setTracksError(null);

    const run = async () => {
      try {
        const trackUri =
          frame.trackUri ||
          (await resolveCurrentTrackUri(frame.maEntityId, {
            media_title: frame.title,
            media_artist: frame.artist,
          }));

        if (cancelled) return;
        setResolvedTrackUri(trackUri);

        if (!trackUri) {
          setTracksError(
            t({
              id: "Discover.no_track_match",
              defaultMessage: "Could not locate this track in Music Assistant.",
            })
          );
          setTracksLoadedKey(frameKey);
          return;
        }

        const result = await getSimilarTracks(frame.maEntityId, trackUri);
        const filtered = filterOutSeedTrack(result, {
          trackUri,
          alternateTrackUri: frame.trackUri,
          title: frame.title,
          artist: frame.artist,
        });
        if (!cancelled) {
          setTracks(filtered);
          setTracksLoadedKey(frameKey);
        }
      } catch (err) {
        if (!cancelled) {
          setTracksError(
            err instanceof Error ? err.message : "Failed to load similar tracks"
          );
          setTracksLoadedKey(frameKey);
        }
      } finally {
        if (!cancelled) {
          setTracksLoading(false);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [
    activeTab,
    canSimilarTracks,
    frameKey,
    tracksLoadedKey,
    frame.maEntityId,
    frame.trackUri,
    frame.title,
    frame.artist,
    t,
  ]);

  // Fetch similar artists lazily when artists tab is active
  useEffect(() => {
    if (activeTab !== "artists" || !canSimilarArtists) return;
    if (artistsLoadedKey === frameKey) return;

    let cancelled = false;
    setArtistsLoading(true);
    setArtistsError(null);

    const run = async () => {
      try {
        let seedTrackUri = frame.trackUri || resolvedTrackUri;
        if (!frame.artistUri && !seedTrackUri && frame.title) {
          seedTrackUri = await resolveCurrentTrackUri(frame.maEntityId, {
            media_title: frame.title,
            media_artist: frame.artist,
          });
        }

        const artistUri =
          frame.artistUri ||
          (await resolveArtistUri(
            frame.maEntityId,
            frame.artistNameFallback ?? frame.artist,
            seedTrackUri
          ));

        if (cancelled) return;

        if (!artistUri) {
          setArtistsError(
            t({
              id: "Discover.no_artist_match",
              defaultMessage:
                "Could not locate this artist in Music Assistant.",
            })
          );
          setArtistsLoadedKey(frameKey);
          return;
        }

        const result = await getSimilarArtists(frame.maEntityId, artistUri);
        if (!cancelled) {
          setArtists(result);
          setArtistsLoadedKey(frameKey);
        }
      } catch (err) {
        if (!cancelled) {
          setArtistsError(
            err instanceof Error
              ? err.message
              : "Failed to load similar artists"
          );
          setArtistsLoadedKey(frameKey);
        }
      } finally {
        if (!cancelled) {
          setArtistsLoading(false);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [
    activeTab,
    canSimilarArtists,
    frameKey,
    artistsLoadedKey,
    frame.maEntityId,
    frame.artistUri,
    frame.artist,
    frame.artistNameFallback,
    frame.trackUri,
    frame.title,
    resolvedTrackUri,
    t,
  ]);

  const handlePlayTrack = useCallback(
    async (track: MassTrackItem, mode: MaEnqueueMode = enqueueMode) => {
      try {
        await playMassMedia(
          frame.maEntityId,
          track.media_content_id,
          "track",
          mode
        );
        const verb =
          mode === "next"
            ? "Playing next"
            : mode === "add"
              ? "Added to queue"
              : mode === "replace"
                ? "Replaced queue with"
                : mode === "replace_next"
                  ? "Queued next"
                  : "Playing";
        showToast(`${verb}: ${track.media_title}`, "success");
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "Playback failed",
          "error"
        );
      }
    },
    [enqueueMode, frame.maEntityId, showToast]
  );

  const handleBulkPlay = useCallback(
    async (mode: "play" | "add") => {
      if (bulkAction !== null) return;
      const uris = tracks.map(tr => tr.media_content_id).filter(Boolean);
      if (uris.length === 0) return;

      const requestFrameKey = frameKey;
      const isCurrentFrame = () =>
        isMountedRef.current && activeFrameKeyRef.current === requestFrameKey;

      const firstTitle = tracks.find(
        tr => tr.media_content_id === uris[0]
      )?.media_title;

      setBulkAction(mode);
      setBulkProgress({ queued: 0, total: uris.length });
      showToast(
        mode === "play"
          ? "Starting playback…"
          : `Queueing ${uris.length} ${uris.length === 1 ? "track" : "tracks"}…`,
        "info"
      );

      try {
        const result = await playMassTracksProgressive({
          maEntityId: frame.maEntityId,
          uris,
          mode,
          onFirstBatchReady: ({ remainingCount }) => {
            if (mode === "play" && remainingCount > 0) {
              showToast(
                firstTitle
                  ? `Playing ${firstTitle} — queueing ${remainingCount} more…`
                  : `Started playback — queueing ${remainingCount} more…`,
                "success"
              );
            }
          },
          onProgress: ({ queuedCount, totalCount }) => {
            if (isCurrentFrame()) {
              setBulkProgress({ queued: queuedCount, total: totalCount });
            }
          },
        });

        if (!result.cancelled) {
          if (result.failedCount === 0) {
            showToast(
              mode === "add"
                ? `Added ${result.queuedCount} ${result.queuedCount === 1 ? "track" : "tracks"} to queue`
                : result.totalCount === 1
                  ? `Playing ${firstTitle ?? "1 similar track"}`
                  : `Playing ${result.totalCount} similar tracks`,
              "success"
            );
          } else if (mode === "play" && result.queuedCount === 1) {
            showToast(
              `Playing first track, but failed to queue ${result.failedCount} remaining tracks`,
              "error"
            );
          } else {
            showToast(
              `Queued ${result.queuedCount} of ${result.totalCount} tracks (${result.failedCount} failed)`,
              "error"
            );
          }
        }
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "Failed to queue tracks",
          "error"
        );
      } finally {
        if (isCurrentFrame()) {
          setBulkAction(null);
          setBulkProgress(null);
        }
      }
    },
    [bulkAction, tracks, frame.maEntityId, frameKey, showToast]
  );

  const enqueueMenuItems: OverlayMenuItem[] = useMemo(
    () => [
      {
        label: t({ id: "Search.enqueue_mode.play", defaultMessage: "Play" }),
        icon: "mdi:play-circle",
        selected: enqueueMode === "play",
        onClick: () => setEnqueueMode("play"),
      },
      {
        label: t({
          id: "Search.enqueue_mode.next",
          defaultMessage: "Add Next",
        }),
        icon: "mdi:playlist-play",
        selected: enqueueMode === "next",
        onClick: () => setEnqueueMode("next"),
      },
      {
        label: t({
          id: "Search.enqueue_mode.replace_next",
          defaultMessage: "Replace Next",
        }),
        icon: "mdi:playlist-edit",
        selected: enqueueMode === "replace_next",
        onClick: () => setEnqueueMode("replace_next"),
      },
      {
        label: t({
          id: "Search.enqueue_mode.add",
          defaultMessage: "Add to Queue",
        }),
        icon: "mdi:playlist-plus",
        selected: enqueueMode === "add",
        onClick: () => setEnqueueMode("add"),
      },
    ],
    [enqueueMode, t]
  );

  return (
    <>
      {(canSimilarTracks || canSimilarArtists) && (
        <div css={styles.tabsRow}>
          <div css={styles.tabGroup}>
            {canSimilarTracks && (
              <Chip
                size="small"
                icon="mdi:music-note"
                invertedColors={activeTab !== "tracks"}
                border={activeTab !== "tracks"}
                onClick={() => setActiveTab("tracks")}
              >
                {t({
                  id: "Discover.similar_tracks",
                  defaultMessage: "Similar Tracks",
                })}
              </Chip>
            )}
            {canSimilarArtists && (
              <Chip
                size="small"
                icon="mdi:account-music"
                invertedColors={activeTab !== "artists"}
                border={activeTab !== "artists"}
                onClick={() => setActiveTab("artists")}
              >
                {t({
                  id: "Discover.similar_artists",
                  defaultMessage: "Similar Artists",
                })}
              </Chip>
            )}
          </div>
          {activeTab === "tracks" && (
            <OverlayMenu
              align="end"
              side="bottom"
              menuItems={enqueueMenuItems}
              renderTrigger={triggerProps => (
                <Chip
                  size="small"
                  invertedColors
                  border
                  icon="mdi:playlist-play"
                  {...triggerProps}
                >
                  {enqueueMode === "next"
                    ? "Next"
                    : enqueueMode === "add"
                      ? "Add"
                      : enqueueMode === "replace_next"
                        ? "Replace Next"
                        : "Play"}
                  <Icon size="x-small" icon="mdi:chevron-down" />
                </Chip>
              )}
            />
          )}
        </div>
      )}

      {activeTab === "tracks" && tracks.length > 0 && (
        <div css={styles.toolbarRow}>
          <div css={styles.toolbarGroup}>
            <Chip
              size="small"
              icon="mdi:play"
              loading={bulkAction === "play"}
              disabled={bulkAction !== null}
              onClick={() => handleBulkPlay("play")}
            >
              {bulkAction === "play"
                ? bulkProgress &&
                  bulkProgress.queued > 0 &&
                  bulkProgress.total > 1
                  ? `Queueing ${bulkProgress.queued}/${bulkProgress.total}…`
                  : "Starting…"
                : t({ id: "Discover.play_all", defaultMessage: "Play All" })}
            </Chip>
            <Chip
              size="small"
              invertedColors
              border
              icon="mdi:playlist-plus"
              loading={bulkAction === "add"}
              disabled={bulkAction !== null}
              onClick={() => handleBulkPlay("add")}
            >
              {bulkAction === "add" && bulkProgress
                ? bulkProgress.queued > 0
                  ? `Queueing ${bulkProgress.queued}/${bulkProgress.total}…`
                  : "Queueing…"
                : t({ id: "Discover.queue_all", defaultMessage: "Queue All" })}
            </Chip>
          </div>
        </div>
      )}

      <div css={styles.content}>
        {activeTab === "tracks" ? (
          tracksLoading ? (
            <div css={styles.centeredState}>
              <Spinner />
            </div>
          ) : tracksError ? (
            <div css={styles.centeredState}>{tracksError}</div>
          ) : tracks.length === 0 ? (
            <div css={styles.centeredState}>
              {t({
                id: "Discover.no_similar_tracks",
                defaultMessage: "No similar tracks found.",
              })}
            </div>
          ) : (
            tracks.map((track, idx) => (
              <MediaGrid
                key={track.media_content_id || `${track.media_title}-${idx}`}
                numberOfColumns={1}
              >
                <MediaTrack
                  imageUrl={track.local_image_encoded || track.media_image}
                  title={track.media_title}
                  artist={[
                    track.media_artist,
                    track.media_album_name,
                    track.duration ? formatPlaybackTime(track.duration) : null,
                  ]
                    .filter(Boolean)
                    .join(" • ")}
                  onClick={() => handlePlayTrack(track)}
                  buttons={[
                    {
                      icon: "mdi:playlist-play",
                      onClick: () => handlePlayTrack(track, "next"),
                      priority: 2,
                    },
                    {
                      icon: "mdi:playlist-plus",
                      onClick: () => handlePlayTrack(track, "add"),
                      priority: 3,
                    },
                    {
                      icon: "mdi:radio-tower",
                      onClick: () =>
                        pushSimilar({
                          initialTab: "tracks",
                          maEntityId: frame.maEntityId,
                          targetEntityId: frame.targetEntityId,
                          trackUri: track.media_content_id,
                          title: track.media_title,
                          artist: track.media_artist,
                        }),
                    },
                  ]}
                />
              </MediaGrid>
            ))
          )
        ) : artistsLoading ? (
          <div css={styles.centeredState}>
            <Spinner />
          </div>
        ) : artistsError ? (
          <div css={styles.centeredState}>{artistsError}</div>
        ) : artists.length === 0 ? (
          <div css={styles.centeredState}>
            {t({
              id: "Discover.no_similar_artists",
              defaultMessage: "No similar artists found.",
            })}
          </div>
        ) : (
          <div css={styles.artistGrid}>
            {artists.map(artist => {
              const menuItems: OverlayMenuItem[] = [];
              if (hasMassQueueService("get_artist_tracks")) {
                menuItems.push({
                  label: t({
                    id: "Discover.view_top_tracks",
                    defaultMessage: "View Top Tracks",
                  }),
                  icon: "mdi:format-list-bulleted",
                  onClick: () =>
                    pushCollection({
                      maEntityId: frame.maEntityId,
                      targetEntityId: frame.targetEntityId,
                      mediaType: "artist",
                      uri: artist.uri,
                      title: artist.name,
                      subtitle: "Top Tracks",
                      imageUrl: artist.image,
                    }),
                });
              }
              menuItems.push(
                {
                  label: t({
                    id: "Discover.start_artist_radio",
                    defaultMessage: "Start Artist Radio",
                  }),
                  icon: "mdi:radio-tower",
                  onClick: async () => {
                    try {
                      await startRadioMix(
                        frame.targetEntityId,
                        frame.maEntityId,
                        artist.uri,
                        "artist"
                      );
                      showToast(
                        `Started Artist Radio: ${artist.name}`,
                        "success"
                      );
                    } catch (err) {
                      showToast(
                        err instanceof Error
                          ? err.message
                          : "Failed to start Artist Radio",
                        "error"
                      );
                    }
                  },
                },
                {
                  label: t({
                    id: "Search.enqueue_mode.play",
                    defaultMessage: "Play",
                  }),
                  icon: "mdi:play-circle",
                  onClick: async () => {
                    try {
                      await playMassMedia(
                        frame.maEntityId,
                        artist.uri,
                        "artist",
                        "play"
                      );
                      showToast(`Playing ${artist.name}`, "success");
                    } catch (err) {
                      showToast(
                        err instanceof Error ? err.message : "Playback failed",
                        "error"
                      );
                    }
                  },
                },
                {
                  label: t({
                    id: "Search.enqueue_mode.next",
                    defaultMessage: "Add Next",
                  }),
                  icon: "mdi:playlist-play",
                  onClick: async () => {
                    try {
                      await playMassMedia(
                        frame.maEntityId,
                        artist.uri,
                        "artist",
                        "next"
                      );
                      showToast(`Playing next: ${artist.name}`, "success");
                    } catch (err) {
                      showToast(
                        err instanceof Error ? err.message : "Failed to queue",
                        "error"
                      );
                    }
                  },
                },
                {
                  label: t({
                    id: "Search.enqueue_mode.add",
                    defaultMessage: "Add to Queue",
                  }),
                  icon: "mdi:playlist-plus",
                  onClick: async () => {
                    try {
                      await playMassMedia(
                        frame.maEntityId,
                        artist.uri,
                        "artist",
                        "add"
                      );
                      showToast(`Added ${artist.name} to queue`, "success");
                    } catch (err) {
                      showToast(
                        err instanceof Error ? err.message : "Failed to queue",
                        "error"
                      );
                    }
                  },
                },
                {
                  label: t({
                    id: "Discover.similar_artists",
                    defaultMessage: "Similar Artists",
                  }),
                  icon: "mdi:account-group-outline",
                  onClick: () =>
                    pushSimilar({
                      initialTab: "artists",
                      maEntityId: frame.maEntityId,
                      targetEntityId: frame.targetEntityId,
                      artistUri: artist.uri,
                      title: artist.name,
                      artist: artist.name,
                    }),
                }
              );

              return (
                <OverlayMenu
                  key={artist.uri}
                  side="bottom"
                  align="center"
                  menuItems={menuItems}
                  renderTrigger={triggerProps => (
                    <MediaItem
                      imageUrl={artist.image}
                      mdiIcon="mdi:account-music"
                      name={artist.name}
                      {...triggerProps}
                    />
                  )}
                />
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

const CollectionFrameView = ({ frame }: { frame: CollectionFrame }) => {
  const { t } = useIntl();
  const { showToast } = useToast();
  const { pushSimilar } = useMassDiscover();

  const [tracks, setTracks] = useState<MassTrackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<
    "play" | "next" | "radio" | null
  >(null);
  const isMountedRef = useRef(true);
  const activeCollectionUriRef = useRef(frame.uri);
  activeCollectionUriRef.current = frame.uri;

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setTracks([]);
    setActionLoading(null);

    getCollectionTracks(frame.maEntityId, frame.mediaType, frame.uri)
      .then(items => {
        if (!cancelled) {
          setTracks(items);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load tracks"
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [frame.maEntityId, frame.mediaType, frame.uri]);

  const handlePlayItem = useCallback(
    async (item: MassTrackItem, mode: MaEnqueueMode = "play") => {
      const mediaType = frame.mediaType === "podcast" ? undefined : "track";
      try {
        await playMassMedia(
          frame.maEntityId,
          item.media_content_id,
          mediaType,
          mode
        );
        const verb =
          mode === "next"
            ? "Playing next"
            : mode === "add"
              ? "Added to queue"
              : "Playing";
        showToast(`${verb}: ${item.media_title}`, "success");
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "Playback failed",
          "error"
        );
      }
    },
    [frame.maEntityId, frame.mediaType, showToast]
  );

  const handleCollectionAction = useCallback(
    async (mode: "play" | "next" | "add") => {
      if (actionLoading !== null) return;
      const requestUri = frame.uri;
      setActionLoading(mode === "next" ? "next" : "play");
      try {
        await playMassMedia(frame.maEntityId, frame.uri, frame.mediaType, mode);
        const verb =
          mode === "next"
            ? "Playing next"
            : mode === "add"
              ? "Added to queue"
              : "Playing";
        showToast(`${verb}: ${frame.title}`, "success");
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "Playback failed",
          "error"
        );
      } finally {
        if (
          isMountedRef.current &&
          activeCollectionUriRef.current === requestUri
        ) {
          setActionLoading(null);
        }
      }
    },
    [
      actionLoading,
      frame.maEntityId,
      frame.uri,
      frame.mediaType,
      frame.title,
      showToast,
    ]
  );

  const handleCollectionRadio = useCallback(async () => {
    if (actionLoading !== null) return;
    const requestUri = frame.uri;
    setActionLoading("radio");
    try {
      await startRadioMix(
        frame.targetEntityId,
        frame.maEntityId,
        frame.uri,
        frame.mediaType as "artist" | "album"
      );
      showToast(`Started Radio: ${frame.title}`, "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to start Radio Mix",
        "error"
      );
    } finally {
      if (
        isMountedRef.current &&
        activeCollectionUriRef.current === requestUri
      ) {
        setActionLoading(null);
      }
    }
  }, [
    actionLoading,
    frame.targetEntityId,
    frame.maEntityId,
    frame.uri,
    frame.mediaType,
    frame.title,
    showToast,
  ]);

  return (
    <>
      <div css={styles.toolbarRow}>
        <div css={styles.toolbarGroup}>
          <Chip
            size="small"
            icon="mdi:play"
            loading={actionLoading === "play"}
            disabled={actionLoading !== null}
            onClick={() => handleCollectionAction("play")}
          >
            {t({ id: "Discover.play_all", defaultMessage: "Play All" })}
          </Chip>
          <Chip
            size="small"
            invertedColors
            border
            icon="mdi:playlist-play"
            loading={actionLoading === "next"}
            disabled={actionLoading !== null}
            onClick={() => handleCollectionAction("next")}
          >
            {t({ id: "Search.enqueue_mode.next", defaultMessage: "Add Next" })}
          </Chip>
          {(frame.mediaType === "artist" || frame.mediaType === "album") && (
            <Chip
              size="small"
              invertedColors
              border
              icon="mdi:radio-tower"
              loading={actionLoading === "radio"}
              disabled={actionLoading !== null}
              onClick={handleCollectionRadio}
            >
              {t({ id: "Discover.radio", defaultMessage: "Radio" })}
            </Chip>
          )}
          {frame.mediaType === "artist" &&
            hasMassQueueService("get_similar_artists") && (
              <Chip
                size="small"
                invertedColors
                border
                icon="mdi:account-group-outline"
                onClick={() =>
                  pushSimilar({
                    initialTab: "artists",
                    maEntityId: frame.maEntityId,
                    targetEntityId: frame.targetEntityId,
                    artistUri: frame.uri,
                    title: frame.title,
                    artist: frame.title,
                  })
                }
              >
                {t({
                  id: "Discover.similar_artists",
                  defaultMessage: "Similar Artists",
                })}
              </Chip>
            )}
        </div>
      </div>

      <div css={styles.content}>
        {loading ? (
          <div css={styles.centeredState}>
            <Spinner />
          </div>
        ) : error ? (
          <div css={styles.centeredState}>{error}</div>
        ) : tracks.length === 0 ? (
          <div css={styles.centeredState}>
            {t({
              id: "Discover.no_collection_items",
              defaultMessage: "No items found.",
            })}
          </div>
        ) : (
          tracks.map((item, idx) => {
            const buttons: {
              icon: string;
              onClick: () => void;
              priority?: 1 | 2 | 3;
            }[] = [
              {
                icon: "mdi:playlist-play",
                onClick: () => handlePlayItem(item, "next"),
                priority: 2,
              },
              {
                icon: "mdi:playlist-plus",
                onClick: () => handlePlayItem(item, "add"),
                priority: 3,
              },
            ];

            if (
              frame.mediaType !== "podcast" &&
              hasMassQueueService("get_similar_tracks") &&
              item.media_content_id
            ) {
              buttons.push({
                icon: "mdi:radio-tower",
                onClick: () =>
                  pushSimilar({
                    initialTab: "tracks",
                    maEntityId: frame.maEntityId,
                    targetEntityId: frame.targetEntityId,
                    trackUri: item.media_content_id,
                    title: item.media_title,
                    artist: item.media_artist,
                  }),
              });
            }

            const subtitleParts = [
              item.media_artist,
              item.release_date ? item.release_date.split("T")[0] : null,
              item.duration ? formatPlaybackTime(item.duration) : null,
            ].filter(Boolean);

            return (
              <MediaGrid
                key={item.media_content_id || `${item.media_title}-${idx}`}
                numberOfColumns={1}
              >
                <MediaTrack
                  imageUrl={
                    item.local_image_encoded ||
                    item.media_image ||
                    frame.imageUrl
                  }
                  title={item.media_title}
                  artist={subtitleParts.join(" • ")}
                  onClick={() => handlePlayItem(item, "play")}
                  buttons={buttons}
                />
              </MediaGrid>
            );
          })
        )}
      </div>
    </>
  );
};
