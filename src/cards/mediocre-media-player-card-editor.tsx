import { MediocreMediaPlayerCardEditor } from "@components";
import { MediocreMediaPlayerCardConfig } from "@types";
import { CardEditorWrapper } from "@wrappers";

class MediocreMediaPlayerCardEditorWrapper extends CardEditorWrapper<MediocreMediaPlayerCardConfig> {
  Card = MediocreMediaPlayerCardEditor;
}

if (!customElements.get(import.meta.env.VITE_MEDIA_PLAYER_CARD_EDITOR)) {
  customElements.define(
    import.meta.env.VITE_MEDIA_PLAYER_CARD_EDITOR,
    MediocreMediaPlayerCardEditorWrapper
  );
}
