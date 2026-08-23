import { MediocreMultiMediaPlayerCardEditor } from "@components";
import { MediocreMultiMediaPlayerCardConfig } from "@types";
import { CardEditorWrapper } from "@wrappers";

class MediocreMultiMediaPlayerCardEditorWrapper extends CardEditorWrapper<MediocreMultiMediaPlayerCardConfig> {
  Card = MediocreMultiMediaPlayerCardEditor;
}

if (!customElements.get(import.meta.env.VITE_MULTI_MEDIA_PLAYER_CARD_EDITOR)) {
  customElements.define(
    import.meta.env.VITE_MULTI_MEDIA_PLAYER_CARD_EDITOR,
    MediocreMultiMediaPlayerCardEditorWrapper
  );
}
