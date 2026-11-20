import { FunctionComponent, render } from "preact";
import { HomeAssistant } from "@types";
import { EmotionContextProvider } from "@components/EmotionContextProvider";
import { GlanceGuard } from "@components/GlanceGuard";
import { HassContextProvider } from "@components/HassContext";

export type EditorCardProps<T> = {
  config: T;
  rootElement: HTMLElement;
  hass: HomeAssistant;
};

export class CardEditorWrapper<T> extends HTMLElement {
  _config: T | null = null;
  Card: FunctionComponent<EditorCardProps<T>> | null = null;
  extraProps: { [key: string]: unknown } = {};
  _hass: HomeAssistant | null = null;
  private _isRendered = false;

  private _render() {
    if (!this.isConnected || !this._hass || !this.Card || !this._config) {
      return;
    }

    render(
      <EmotionContextProvider rootElement={this}>
        <GlanceGuard>
          <HassContextProvider hass={this._hass}>
            <this.Card
              config={this._config}
              hass={this._hass}
              rootElement={this}
              {...this.extraProps}
            />
          </HassContextProvider>
        </GlanceGuard>
      </EmotionContextProvider>,
      this
    );
    this._isRendered = true;
  }

  connectedCallback() {
    if (!this._isRendered) {
      this._render();
    }
  }

  disconnectedCallback() {
    render(null, this);
    this._isRendered = false;
  }

  set hass(hass: HomeAssistant) {
    this._hass = hass;
    if (!this._isRendered) {
      this._render();
    }
  }

  setConfig(config: T) {
    this._config = config;
    this._render();
  }
}
