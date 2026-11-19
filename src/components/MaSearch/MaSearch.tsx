import { Chip, IconButton, Input } from "@components";
import { useCallback, useState } from "preact/hooks";
import { useDebounce } from "@uidotdev/usehooks";
import { searchStyles } from "@components/MediaSearch";
import { MaFilterType, MaEnqueueMode, MaMediaItem } from "./types";
import { useSearchQuery } from "./useSearchQuery";
import { useFavorites } from "./useFavorites";
import { useRecommendations } from "./useRecommendations";
import { filters } from "./constants";
import { MaMediaItemsList } from "./MaMediaItemsList";
import { JSX } from "preact/jsx-runtime";
import { useIntl } from "@components/i18n";
import {
  OverlayMenu,
  OverlayMenuItem,
} from "@components/OverlayMenu/OverlayMenu";
import { useToast } from "@components/Toast";
import { hasMassQueueService } from "@utils";

export type MaSearchProps = {
  maEntityId: string;
  horizontalPadding?: number;
  additionalOptions?: OverlayMenuItem[];
  searchBarPosition?: "top" | "bottom";
  maxHeight?: number;
  renderHeader?: () => JSX.Element;
};

export const MaSearch = ({
  maEntityId,
  horizontalPadding,
  searchBarPosition = "top",
  additionalOptions = [],
  maxHeight = 300,
  renderHeader,
}: MaSearchProps) => {
  const { t } = useIntl();
  const { showToast } = useToast();
  const [query, setQuery] = useState("");
  const [enqueueMode, setEnqueueMode] = useState<MaEnqueueMode>("play");
  const debouncedQuery = useDebounce(query, 600);
  const [activeFilter, setActiveFilter] = useState<MaFilterType>("all");
  const [browseSource, setBrowseSource] = useState<"favorites" | "for-you">(
    "favorites"
  );

  const canShowRecommendations = hasMassQueueService("get_recommendations");

  const {
    results,
    loading: searchLoading,
    playItem,
  } = useSearchQuery(debouncedQuery, activeFilter, maEntityId);

  const { favorites, loading: favoritesLoading } = useFavorites(
    activeFilter,
    query === "" && browseSource === "favorites",
    maEntityId
  );

  const {
    folders: recommendationFolders,
    loading: recommendationsLoading,
    error: recommendationsError,
  } = useRecommendations(
    maEntityId,
    query === "" && browseSource === "for-you"
  );

  const handlePlayWithMode = useCallback(
    async (item: MaMediaItem, mode: MaEnqueueMode) => {
      try {
        await playItem(item, maEntityId, mode);
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
        showToast(`${verb}: ${item.name}`, "success");
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "Playback failed",
          "error"
        );
      }
    },
    [playItem, maEntityId, showToast]
  );

  const renderFilterChips = () => {
    const showCategoryFilters = query !== "" || browseSource === "favorites";
    return (
      <>
        {query === "" && canShowRecommendations && (
          <>
            <Chip
              css={searchStyles.chip}
              style={{
                "--mmpc-chip-horizontal-margin": `${horizontalPadding}px`,
                opacity: browseSource === "favorites" ? 1 : 0.65,
                fontWeight: browseSource === "favorites" ? "bold" : "normal",
              }}
              onClick={() => setBrowseSource("favorites")}
              icon="mdi:heart"
            >
              {t({
                id: "Search.categories.Favorites",
                defaultMessage: "Favorites",
              })}
            </Chip>
            <Chip
              css={searchStyles.chip}
              style={{
                opacity: browseSource === "for-you" ? 1 : 0.65,
                fontWeight: browseSource === "for-you" ? "bold" : "normal",
              }}
              onClick={() => setBrowseSource("for-you")}
              icon="mdi:auto-fix"
            >
              {t({
                id: "Search.categories.ForYou",
                defaultMessage: "For You",
              })}
            </Chip>
            {showCategoryFilters && (
              <div css={searchStyles.verticalChipSeperator} />
            )}
          </>
        )}
        {showCategoryFilters &&
          filters.map(filter => (
            <Chip
              css={searchStyles.chip}
              style={{
                "--mmpc-chip-horizontal-margin": `${horizontalPadding}px`,
                opacity: activeFilter === filter.type ? 1 : 0.6,
                fontWeight: activeFilter === filter.type ? "bold" : "normal",
              }}
              key={filter.type}
              onClick={() => setActiveFilter(filter.type)}
              icon={filter.icon}
            >
              {t({
                id: `Search.categories.${filter.label}`,
                defaultMessage: filter.label,
              })}
            </Chip>
          ))}
      </>
    );
  };

  const renderSearchBar = () => {
    return (
      <div css={searchStyles.searchBarContainer}>
        {!!renderHeader && renderHeader()}
        <div css={searchStyles.inputRow}>
          <Input
            placeholder={t({ id: "Search.input_placeholder" })}
            onChange={setQuery}
            value={query}
            loading={searchLoading}
            css={searchStyles.input}
          />
          <OverlayMenu
            align="end"
            side="bottom"
            menuItems={[
              ...additionalOptions,
              {
                type: "title",
                label: t({
                  id: "Search.enqueue_mode.title",
                  defaultMessage: "Enqueue Mode",
                }),
              },
              {
                label: t({
                  id: "Search.enqueue_mode.play",
                  defaultMessage: "Play",
                }),
                selected: enqueueMode === "play",
                icon: getEnqueModeIcon("play"),
                onClick: () => setEnqueueMode("play"),
              },
              {
                label: t({
                  id: "Search.enqueue_mode.replace",
                  defaultMessage: "Replace Queue",
                }),
                selected: enqueueMode === "replace",
                icon: getEnqueModeIcon("replace"),
                onClick: () => setEnqueueMode("replace"),
              },
              {
                label: t({
                  id: "Search.enqueue_mode.next",
                  defaultMessage: "Add Next",
                }),
                selected: enqueueMode === "next",
                icon: getEnqueModeIcon("next"),
                onClick: () => setEnqueueMode("next"),
              },
              {
                label: t({
                  id: "Search.enqueue_mode.replace_next",
                  defaultMessage: "Replace Next",
                }),
                selected: enqueueMode === "replace_next",
                icon: getEnqueModeIcon("replace_next"),
                onClick: () => setEnqueueMode("replace_next"),
              },
              {
                label: t({
                  id: "Search.enqueue_mode.add",
                  defaultMessage: "Add to Queue",
                }),
                selected: enqueueMode === "add",
                icon: getEnqueModeIcon("add"),
                onClick: () => setEnqueueMode("add"),
              },
            ]}
            renderTrigger={triggerProps => (
              <IconButton
                size="x-small"
                icon={
                  !additionalOptions || additionalOptions.length === 0
                    ? getEnqueModeIcon(enqueueMode)
                    : "mdi:cog"
                }
                {...triggerProps}
              />
            )}
          />
        </div>
        <div css={searchStyles.filterContainer}>{renderFilterChips()}</div>
      </div>
    );
  };

  const isForYouMode =
    query === "" && browseSource === "for-you" && canShowRecommendations;
  const listLoading =
    query !== ""
      ? searchLoading
      : isForYouMode
        ? recommendationsLoading
        : favoritesLoading;

  return (
    <div
      css={searchStyles.root}
      style={{
        "--mmpc-search-padding": `${horizontalPadding}px`,
      }}
    >
      <MaMediaItemsList
        renderHeader={searchBarPosition === "top" ? renderSearchBar : undefined}
        maEntityId={maEntityId}
        loading={listLoading}
        error={isForYouMode ? recommendationsError : null}
        recommendationFolders={isForYouMode ? recommendationFolders : undefined}
        results={
          isForYouMode
            ? undefined
            : query !== "" && results
              ? results
              : favorites
                ? favorites
                : undefined
        }
        onItemClick={item => handlePlayWithMode(item, enqueueMode)}
        onPlayWithMode={handlePlayWithMode}
        style={{
          "--mmpc-search-padding": `${horizontalPadding}px`,
        }}
        maxHeight={maxHeight}
        onHeaderClick={setActiveFilter}
      />
      {searchBarPosition === "bottom" && renderSearchBar()}
    </div>
  );
};

const getEnqueModeIcon = (enqueueMode: MaEnqueueMode) => {
  switch (enqueueMode) {
    case "play": // Play now
      return "mdi:play-circle";
    case "replace": // Replace the existing queue and play now
      return "mdi:playlist-remove";
    case "next": // Add to the current queue after the currently playing item
      return "mdi:playlist-play";
    case "replace_next": // Replace the current queue after the currently playing item
      return "mdi:playlist-edit";
    case "add": // Add to the end of the queue
      return "mdi:playlist-plus";
    default:
      return "mdi:play-circle";
  }
};
