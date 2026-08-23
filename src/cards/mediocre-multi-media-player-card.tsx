import { HomeAssistant, MediaPlayerEntity } from "@types";
import { MediocreMultiMediaPlayerCardConfig } from "@types";
import { CardWrapper } from "@wrappers";
import { MediocreMultiMediaPlayerCard } from "@components/MediocreMultiMediaPlayerCard";
import { getDidMediaPlayerUpdate } from "@utils";

class MediocreMultiMediaPlayerCardWrapper extends CardWrapper<MediocreMultiMediaPlayerCardConfig> {
  Card = MediocreMultiMediaPlayerCard;
  providePlayerContext = false;

  setConfig(config: MediocreMultiMediaPlayerCardConfig) {
    if (!config.media_players || config.media_players.length === 0) {
      throw new Error("You need to define at least one media player.");
    }
    if (
      !config.entity_id ||
      config.media_players.find(
        player => player.entity_id === config.entity_id
      ) === undefined
    ) {
      config = {
        ...config,
        entity_id: config.media_players[0].entity_id,
      };
    }
    this.config = config;
  }

  shouldUpdate = (
    prevHass: HomeAssistant | null,
    hass: HomeAssistant | null
  ) => {
    if (!hass || !prevHass || !this.config) return true;
    if (!prevHass && hass) return true;
    try {
      return this.config.media_players.some(player => {
        const entityId = player.entity_id;
        const prevPlayerState = prevHass.states?.[
          entityId
        ] as MediaPlayerEntity;
        const currPlayerState = hass.states?.[entityId] as MediaPlayerEntity;
        if (getDidMediaPlayerUpdate(prevPlayerState, currPlayerState)) {
          return true;
        }
        if (player.ma_entity_id) {
          const prevMaState = prevHass.states?.[
            player.ma_entity_id
          ] as MediaPlayerEntity;
          const currMaState = hass.states?.[
            player.ma_entity_id
          ] as MediaPlayerEntity;
          if (getDidMediaPlayerUpdate(prevMaState, currMaState)) {
            return true;
          }
        }
        if (player.lms_entity_id) {
          const prevLmsState = prevHass.states?.[
            player.lms_entity_id
          ] as MediaPlayerEntity;
          const currLmsState = hass.states?.[
            player.lms_entity_id
          ] as MediaPlayerEntity;
          if (getDidMediaPlayerUpdate(prevLmsState, currLmsState)) {
            return true;
          }
        }
        if (player.speaker_group_entity_id) {
          const prevGroupState = prevHass.states?.[
            player.speaker_group_entity_id
          ] as MediaPlayerEntity;
          const currGroupState = hass.states?.[
            player.speaker_group_entity_id
          ] as MediaPlayerEntity;
          if (getDidMediaPlayerUpdate(prevGroupState, currGroupState)) {
            return true;
          }
        }
        return false;
      });
    } catch {
      return true;
    }
  };

  static getConfigElement() {
    return document.createElement(
      import.meta.env.VITE_MULTI_MEDIA_PLAYER_CARD_EDITOR
    );
  }

  static getStubConfig(hass: HomeAssistant) {
    const entities = Object.keys(hass.states);
    const mediaPlayers = entities.filter(
      entity => entity.substr(0, entity.indexOf(".")) === "media_player"
    );

    return {
      entity_id: mediaPlayers[0] ?? "",
      mode: "card",
      size: "large",
      media_players: [
        {
          entity_id: mediaPlayers[0] ?? "",
        },
      ],
    };
  }

  getCardSize() {
    return 2;
  }

  getGridOptions() {
    return {
      columns: 12,
      min_columns: 8,
    };
  }
}

if (!customElements.get(import.meta.env.VITE_MULTI_MEDIA_PLAYER_CARD)) {
  customElements.define(
    import.meta.env.VITE_MULTI_MEDIA_PLAYER_CARD,
    MediocreMultiMediaPlayerCardWrapper
  );
}

if (!customElements.get("mediocre-multi-media-player-card")) {
  customElements.define(
    "mediocre-multi-media-player-card",
    class extends MediocreMultiMediaPlayerCardWrapper {}
  );
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: import.meta.env.VITE_MULTI_MEDIA_PLAYER_CARD,
  name: "Passable Multi Media Player Card",
  preview: true,
  description:
    "A media player card with player grouping and Radio Mix support.",
  documentationURL: "https://github.com/GBear09/passable-media-player",
});
