import { FunctionComponent, render } from "preact";
import { EmotionContextProvider } from "@components/EmotionContextProvider";
import { CardContextProvider } from "@components/CardContext";
import { HassContextProvider } from "@components/HassContext";
import { PlayerContextProvider } from "@components/PlayerContext";
import { HomeAssistant } from "@types";
import { IntlContextProvider } from "@components/i18n";

export class CardWrapper<
  Config extends { entity_id: string },
> extends HTMLElement {
  Card: FunctionComponent | null = null;
  config: Config | null = null;
  providePlayerContext = true;

  shouldUpdate:
    | ((prevHass: HomeAssistant | null, hass: HomeAssistant | null) => boolean)
    | null = null;

  private _hass: HomeAssistant | null = null;
  private _previousHass: HomeAssistant | null = null;
  private _previousConfig: Config | null = null;
  private _isRendered = false;

  private _render(hass: HomeAssistant) {
    if (!this.Card || !this.config) {
      return;
    }

    try {
      const entityId =
        this.config?.entity_id ||
        (this.config as { media_players?: Array<{ entity_id: string }> })
          ?.media_players?.[0]?.entity_id;

      render(
        <IntlContextProvider locale={hass?.language ?? "en"}>
          <EmotionContextProvider rootElement={this}>
            <CardContextProvider rootElement={this} config={this.config}>
              <HassContextProvider hass={hass}>
                {this.providePlayerContext && entityId ? (
                  <PlayerContextProvider entityId={entityId}>
                    <this.Card />
                  </PlayerContextProvider>
                ) : (
                  <this.Card />
                )}
              </HassContextProvider>
            </CardContextProvider>
          </EmotionContextProvider>
        </IntlContextProvider>,
        this
      );

      this._previousHass = hass;
      this._previousConfig = this.config;
      this._isRendered = true;
    } catch (err) {
      console.warn(
        "[Passable Media Player Card] Error during render hydration:",
        err
      );
    }
  }

  connectedCallback() {
    if (!this._isRendered && this._hass && this.Card && this.config) {
      this._render(this._hass);
    }
  }

  set hass(hass: HomeAssistant) {
    this._hass = hass;

    if (!this.Card || !this.config || !this.isConnected) {
      return;
    }

    try {
      const shouldRender =
        !this._isRendered ||
        !this._previousHass ||
        this.config !== this._previousConfig ||
        !this.shouldUpdate ||
        this.shouldUpdate(this._previousHass, hass);

      if (shouldRender) {
        this._render(hass);
      } else {
        this._previousHass = hass;
      }
    } catch (err) {
      console.warn(
        "[Passable Media Player Card] Error during render hydration:",
        err
      );
    }
  }

  disconnectedCallback() {
    render(null, this);
    this._isRendered = false;
  }

  getCardSize() {
    return 1;
  }
}
