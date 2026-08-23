import {
  MediocreChipMediaPlayerGroupCard,
  MediocreChipMediaPlayerGroupCardConfig,
} from "@components";
import { HomeAssistant, MediaPlayerEntity } from "@types";
import { getDidMediaPlayerUpdate } from "@utils";
import { CardWrapper } from "@wrappers";

class MediocreChipMediaPlayerGroupCardWrapper extends CardWrapper<MediocreChipMediaPlayerGroupCardConfig> {
  Card = MediocreChipMediaPlayerGroupCard;

  shouldUpdate = (
    prevHass: HomeAssistant | null,
    hass: HomeAssistant | null
  ) => {
    if (!hass || !prevHass || !this.config) return true;
    if (!prevHass && hass) return true;

    return getDidMediaPlayerUpdate(
      prevHass.states[this.config.entity_id] as MediaPlayerEntity,
      hass.states[this.config.entity_id] as MediaPlayerEntity
    );
  };

  setConfig(config: MediocreChipMediaPlayerGroupCardConfig) {
    if (!config.entity_id) {
      throw new Error("You need to define an entity_id");
    }
    if (!config.entities) {
      throw new Error("You need to define entities");
    }
    this.config = config;
  }

  getCardSize() {
    return 1;
  }

  getLayoutOptions() {
    return {
      grid_rows: 1,
      grid_columns: 6,
      grid_min_rows: 1,
      grid_max_rows: 1,
    };
  }
}

if (!customElements.get(import.meta.env.VITE_CHIP_MEDIA_PLAYER_GROUP_CARD)) {
  customElements.define(
    import.meta.env.VITE_CHIP_MEDIA_PLAYER_GROUP_CARD,
    MediocreChipMediaPlayerGroupCardWrapper
  );
}

if (!customElements.get("mediocre-chip-media-player-group-card")) {
  customElements.define(
    "mediocre-chip-media-player-group-card",
    class extends MediocreChipMediaPlayerGroupCardWrapper {}
  );
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: import.meta.env.VITE_CHIP_MEDIA_PLAYER_GROUP_CARD,
  name: "Passable Chip Media Player Group Card",
  preview: true,
  description: "A compact chip media player group card.",
  documentationURL: "https://github.com/GBear09/passable-media-player",
});
