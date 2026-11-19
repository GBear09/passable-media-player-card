import { HomeAssistant } from "@types";
import { createContext } from "preact";
import { memo } from "preact/compat";
import { useContext, useMemo } from "preact/hooks";

export type HassContextType = {
  hass: HomeAssistant;
};

export const HassContext = createContext<HassContextType>(
  {} as HassContextType
);

// Make the provider component properly generic
export const HassContextProvider = memo<
  HassContextType & { children: preact.ComponentChildren }
>(
  ({
    hass,
    children,
  }: HassContextType & {
    children: preact.ComponentChildren;
  }): preact.ComponentChildren => {
    const contextValue = useMemo(() => ({ hass }), [hass]);
    return (
      <HassContext.Provider value={contextValue}>
        {children}
      </HassContext.Provider>
    );
  }
);

export const useHass = () => {
  const context = useContext(HassContext);
  if (!context.hass) {
    throw new Error("useHass must be used within a HassContextProvider");
  }
  return context.hass;
};
