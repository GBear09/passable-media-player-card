import { CardContext, CardContextType } from "@components/CardContext";
import { MediocreMultiMediaPlayerCardConfig } from "@types";
import {
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "preact/hooks";
import {
  ArtworkColorWrap,
  MediaBrowserView,
  MiniPlayer,
  SearchView,
  SpeakerGrouping,
} from "./components";
import { useMeasure } from "@uidotdev/usehooks";
import { css } from "@emotion/react";
import { FooterActions } from "./components/FooterActions";
import { theme } from "@constants";
import { MassiveViewView } from "./components/MassiveView";
import { AdditionalActionsView } from "./components/AdditionalActionsView";
import { QueueView } from "./components/QueueView";
import { useSelectedPlayer } from "@components/SelectedPlayerContext";
import { SpeakerSettingsBottomSheet } from "@components";

export type NavigationRoute =
  | "search"
  | "media-browser"
  | "massive"
  | "speaker-grouping"
  | "custom-buttons"
  | "queue"
  | "speaker-overview";

const styles = {
  root: css({
    display: "grid",
    minHeight: 0,
    gridTemplateRows: "1fr auto",
    gridTemplateColumns: "1fr",
    rowGap: "0px !important",
    gap: "0px !important",
    margin: "0px !important",
    padding: "0px !important",
    backgroundColor: theme.colors.card,
    borderRadius: "var(--ha-card-border-radius, 12px) !important",
    borderWidth: "var(--ha-card-border-width, 1px) !important",
    borderColor:
      "var(--ha-card-border-color, var(--divider-color, rgba(255, 255, 255, 0.12))) !important",
    borderStyle: "var(--ha-card-border-style, solid) !important",
    overflow: "hidden !important",
    boxSizing: "border-box",
    "*, *:before, *:after": {
      boxSizing: "border-box",
    },
  }),
  rootDesktop: css({
    gridTemplateColumns: "1fr 1fr",
    gridTemplateRows: "1fr auto",
    gridTemplateAreas: `
      "massive content"
      "massive footer"
    `,
    columnGap: 12,
  }),
  rootPanel: css({
    height: "100%",
    padding: 0,
    maxHeight: "calc(100vh - 24px - var(--header-height, 16px))",
    "--ha-card-border-radius": `max(${theme.sizes.cardBorderRadius}, 12px)`,
    "*": {
      "--ha-card-border-radius": "inherit !important",
    },
  }),
  rootCard: css({
    height: 754,
  }),
  rootInCard: css({
    height: 754,
  }),
  contentArea: css({
    alignSelf: "stretch",
    overflow: "hidden",
    minHeight: 0,
    margin: "0px !important",
    padding: "0px !important",
    backgroundColor: "transparent !important",
    borderRadius: "0px !important",
    marginBottom: "0px !important",
    border: "none !important",
    boxShadow: "none !important",
  }),
  contentAreaDesktop: css({
    gridArea: "content",
  }),
  contentAreaDesktopMassive: css({
    gridArea: "massive",
  }),
  contentAreaCard: css({
    borderRadius: "0px !important",
  }),
  contentAreaTransparent: css({
    backgroundColor: "transparent !important",
    borderStyle: "none !important",
  }),
  contentAreaMassiveTransparent: css({
    backgroundColor: "transparent !important",
    borderStyle: "none !important",
  }),
  contentAreaPannelMassiveTransparent: css({
    margin: "0px !important",
  }),
  footer: css({
    alignSelf: "end",
    gap: "0px !important",
    margin: "0px !important",
    padding: "0px !important",
    display: "flex",
    flexDirection: "column",
    borderRadius: "0px !important",
    boxShadow: "none !important",
    borderTop:
      "1px solid var(--ha-card-border-color, var(--divider-color, rgba(255, 255, 255, 0.12))) !important",
    backgroundColor: "rgba(0, 0, 0, 0.2) !important",
  }),
  footerDesktop: css({
    gridArea: "footer",
  }),
  footerCard: css({
    padding: "0px !important",
  }),
  footerInCard: css({
    padding: "0px !important",
  }),
};

type MediocreLargeMultiMediaPlayerCardProps = {
  className?: string;
};

export const MediocreLargeMultiMediaPlayerCard = ({
  className,
}: MediocreLargeMultiMediaPlayerCardProps) => {
  const { config } =
    useContext<CardContextType<MediocreMultiMediaPlayerCardConfig>>(
      CardContext
    );

  const { selectedPlayer, setLastInteraction } = useSelectedPlayer();

  const defaultNavigationRoute = useMemo(
    () =>
      config.size === "large"
        ? (config.options?.default_tab ?? "massive")
        : "massive",
    [config]
  );

  const [navigationRoute, setNavigationRoute] = useState<NavigationRoute>(
    defaultNavigationRoute
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [cardSizeRef, { height: cardHeight, width: cardWidth }] =
    useMeasure<HTMLDivElement>();
  const [contentSizeRef, { height: contentHeight }] =
    useMeasure<HTMLDivElement>();

  const desktopMode = cardWidth ? cardWidth > 800 : false;

  useEffect(() => {
    if (desktopMode && navigationRoute === "massive") {
      setNavigationRoute(
        defaultNavigationRoute !== "massive"
          ? defaultNavigationRoute
          : "speaker-grouping"
      );
    }
  }, [desktopMode, defaultNavigationRoute]); // eslint-disable-line react-hooks/exhaustive-deps -- `navigationRoute` intentionally omitted: this effect should only run when desktop mode changes

  const handleCardClick = useCallback(() => {
    setLastInteraction();
  }, [setLastInteraction]);

  if (config.size && config.size !== "large") return null;
  if (!selectedPlayer) return null;

  return (
    <ArtworkColorWrap
      useArtColors={config.use_art_colors}
      css={[
        styles.root,
        config.mode === "panel" && styles.rootPanel,
        config.mode === "card" && styles.rootCard,
        config.mode === "in-card" && styles.rootInCard,
        desktopMode && styles.rootDesktop,
      ]}
      className={className}
      style={config.height ? { height: config.height } : {}}
      ref={cardSizeRef}
      onClick={handleCardClick}
    >
      {desktopMode ? (
        <div
          css={[
            styles.contentArea,
            styles.contentAreaDesktopMassive,
            config.mode === "card" && styles.contentAreaCard,
            config.options?.transparent_background_on_home &&
              styles.contentAreaMassiveTransparent,
            config.mode === "panel" &&
              config.options?.transparent_background_on_home &&
              styles.contentAreaMassiveTransparent,
          ]}
        >
          <MassiveViewView
            setNavigationRoute={setNavigationRoute}
            navigationRoute={navigationRoute}
          />
        </div>
      ) : null}
      <div
        css={[
          styles.contentArea,
          desktopMode && styles.contentAreaDesktop,
          config.mode === "card" && styles.contentAreaCard,
          navigationRoute === "massive" &&
            config.options?.transparent_background_on_home &&
            styles.contentAreaMassiveTransparent,
          navigationRoute === "massive" &&
            config.mode === "panel" &&
            config.options?.transparent_background_on_home &&
            styles.contentAreaMassiveTransparent,
          config.mode === "in-card" && styles.contentAreaTransparent,
        ]}
        ref={contentSizeRef}
      >
        {navigationRoute === "search" && contentHeight && (
          <SearchView height={contentHeight} />
        )}
        {navigationRoute === "media-browser" && contentHeight && (
          <MediaBrowserView height={contentHeight} />
        )}
        {navigationRoute === "speaker-grouping" && <SpeakerGrouping />}
        {navigationRoute === "queue" && contentHeight && (
          <QueueView height={contentHeight} />
        )}
        {navigationRoute === "massive" && (
          <MassiveViewView
            setNavigationRoute={setNavigationRoute}
            navigationRoute={navigationRoute}
          />
        )}
        {navigationRoute === "custom-buttons" && <AdditionalActionsView />}
      </div>
      <div
        css={[
          styles.footer,
          desktopMode && styles.footerDesktop,
          config.mode === "card" && styles.footerCard,
          config.mode === "in-card" && styles.footerInCard,
        ]}
      >
        {!desktopMode &&
          navigationRoute !== "massive" &&
          cardHeight &&
          cardHeight > 500 && (
            <MiniPlayer
              setNavigationRoute={setNavigationRoute}
              navigationRoute={navigationRoute}
            />
          )}
        <FooterActions
          setNavigationRoute={setNavigationRoute}
          navigationRoute={navigationRoute}
          desktopMode={desktopMode}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      </div>
      <SpeakerSettingsBottomSheet
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </ArtworkColorWrap>
  );
};
