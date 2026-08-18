import { useContext, useMemo } from "preact/hooks";
import { css } from "@emotion/react";
import { IconButton, useHass } from "@components";
import { CardContext, CardContextType } from "@components/CardContext";
import { InteractionConfig, MediocreMultiMediaPlayerCardConfig } from "@types";
import { NavigationRoute } from "@components/MediocreLargeMultiMediaPlayerCard";
import { useActionProps, useCanDisplayQueue } from "@hooks";
import { memo } from "preact/compat";
import { getHasMediaBrowser, getHasSearch } from "@utils";
import { useSelectedPlayer } from "@components/SelectedPlayerContext";

const styles = {
  root: css({
    backgroundColor: "transparent",
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 0,
    padding: "10px 16px",
    width: "100%",
    position: "relative",
    boxSizing: "border-box",
    border: "none",
  }),
  footerInCard: css({
    backgroundColor: "transparent",
    border: "none",
    boxShadow: "none",
  }),
};

export type FooterActionsProps = {
  setNavigationRoute: (route: NavigationRoute) => void;
  navigationRoute: NavigationRoute;
  desktopMode?: boolean;
  onOpenSettings?: () => void;
};

export const FooterActions = memo<FooterActionsProps>(
  ({ setNavigationRoute, navigationRoute, desktopMode, onOpenSettings }) => {
    const { rootElement, config } =
      useContext<CardContextType<MediocreMultiMediaPlayerCardConfig>>(
        CardContext
      );
    const { selectedPlayer } = useSelectedPlayer();
    const hass = useHass();

    const {
      entity_id,
      ma_entity_id,
      search,
      custom_buttons,
      media_browser,
      lms_entity_id,
    } = selectedPlayer!;

    const baseName = entity_id.replace("media_player.", "").replace(/_ma$/, "");

    const hasSearch = getHasSearch(search, ma_entity_id);
    const hasMediaBrowser = getHasMediaBrowser(media_browser);
    const hasQueue = useCanDisplayQueue({ ma_entity_id, lms_entity_id });

    const hasNativeSettings = useMemo(() => {
      if (!hass?.states || !baseName) return false;
      const pattern = new RegExp(`^(number|switch|select)\\.${baseName}_`, "i");
      return Object.keys(hass.states).some(k => pattern.test(k));
    }, [hass?.states, baseName]);

    const settingsCustomButton = useMemo(() => {
      return custom_buttons?.find(
        b => b.name?.toLowerCase() === "settings" || b.icon === "mdi:tune"
      );
    }, [custom_buttons]);

    const nonSettingsCustomButtons = useMemo(() => {
      return (
        custom_buttons?.filter(
          b => b.name?.toLowerCase() !== "settings" && b.icon !== "mdi:tune"
        ) ?? []
      );
    }, [custom_buttons]);

    const showSettingsButton = !!settingsCustomButton || hasNativeSettings;

    const hideActionsTab =
      config.options?.hide_actions_tab ??
      config.options?.hide_shortcuts_tab ??
      nonSettingsCustomButtons.length === 0;

    if (config.size && config.size !== "large") return null;

    return (
      <div
        css={[styles.root, config.mode === "in-card" && styles.footerInCard]}
      >
        {!desktopMode && (
          <IconButton
            size="small"
            icon={"mdi:home"}
            onClick={() => setNavigationRoute("massive")}
            selected={navigationRoute === "massive"}
          />
        )}
        {hasSearch && (
          <IconButton
            size="small"
            icon={"mdi:magnify"}
            onClick={() => setNavigationRoute("search")}
            selected={navigationRoute === "search"}
          />
        )}
        {hasMediaBrowser && (
          <IconButton
            size="small"
            icon={"mdi:folder-music"}
            onClick={() => setNavigationRoute("media-browser")}
            selected={navigationRoute === "media-browser"}
          />
        )}
        {hasQueue && (
          <IconButton
            size="small"
            icon={"mdi:playlist-music"}
            onClick={() => setNavigationRoute("queue")}
            selected={navigationRoute === "queue"}
          />
        )}
        {showSettingsButton && (
          <IconButton
            size="small"
            icon={"mdi:tune"}
            onClick={onOpenSettings}
          />
        )}
        {nonSettingsCustomButtons.length === 1 ? (
          <CustomButton
            button={nonSettingsCustomButtons[0]}
            rootElement={rootElement}
            entityId={entity_id}
          />
        ) : null}
        {!hideActionsTab && (
          <IconButton
            size="small"
            icon={"mdi:dots-horizontal"}
            onClick={() => setNavigationRoute("custom-buttons")}
            selected={navigationRoute === "custom-buttons"}
          />
        )}
        <IconButton
          size="small"
          icon={"mdi:speaker-multiple"}
          onClick={() => setNavigationRoute("speaker-grouping")}
          selected={navigationRoute === "speaker-grouping"}
        />
      </div>
    );
  }
);

const CustomButton = ({
  button,
  rootElement,
  entityId,
}: {
  button: InteractionConfig & {
    icon?: string;
    name?: string;
  };
  rootElement: HTMLElement;
  entityId: string;
}) => {
  const { icon: _icon, name: _name, ...actionConfig } = button;
  const actionProps = useActionProps({
    rootElement,
    actionConfig: {
      ...actionConfig,
      entity: entityId,
    },
  });

  return (
    <IconButton
      icon={button.icon ?? "mdi:dots-vertical"}
      size={"small"}
      {...actionProps}
    />
  );
};

