import { HomeAssistant } from "@types";

export function getHass(): HomeAssistant {
  const ha = document.querySelector("home-assistant") as {
    hass?: HomeAssistant;
  } | null;
  return ha?.hass as HomeAssistant;
}
