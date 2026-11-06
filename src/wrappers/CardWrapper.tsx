import { FunctionComponent, render } from "preact";
import {
  EmotionContextProvider,
  CardContextProvider,
  HassContextProvider,
} from "@components";
import "@types/emotion.d.ts";
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

  private _previousHass: HomeAssistant | null = null;
  private _previousConfig: Config | null = null;

  set hass(hass: HomeAssistant) {
    if (!this.Card || !this.config) {
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const entityId =
        this.config?.entity_id ||
        (this.config as any)?.media_players?.[0]?.entity_id;

      const shouldRender =
        !this._previousHass ||
        this.config !== this._previousConfig ||
        !this.shouldUpdate ||
        this.shouldUpdate(this._previousHass, hass);

      if (shouldRender) {
        this._previousHass = hass;
        this._previousConfig = this.config;
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
  }

  getCardSize() {
    return 1;
  }
}
