import { createContext, type ComponentChildren } from "preact";
import { useCallback, useContext, useMemo, useState } from "preact/hooks";

export type SimilarFrame = {
  type: "similar";
  initialTab: "tracks" | "artists";
  maEntityId: string;
  targetEntityId: string;
  trackUri?: string | null;
  artistUri?: string | null;
  title?: string;
  artist?: string;
  artistNameFallback?: string;
};

export type CollectionFrame = {
  type: "collection";
  maEntityId: string;
  targetEntityId: string;
  mediaType: "album" | "artist" | "playlist" | "podcast";
  uri: string;
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
};

export type DiscoverFrame = SimilarFrame | CollectionFrame;

export type MassDiscoverContextValue = {
  stack: DiscoverFrame[];
  isOpen: boolean;
  isSupported: boolean;
  openSimilar: (frame: Omit<SimilarFrame, "type">) => void;
  pushSimilar: (frame: Omit<SimilarFrame, "type">) => void;
  openCollection: (frame: Omit<CollectionFrame, "type">) => void;
  pushCollection: (frame: Omit<CollectionFrame, "type">) => void;
  goBack: () => void;
  close: () => void;
};

const fallbackContext: MassDiscoverContextValue = {
  stack: [],
  isOpen: false,
  isSupported: false,
  openSimilar: () => undefined,
  pushSimilar: () => undefined,
  openCollection: () => undefined,
  pushCollection: () => undefined,
  goBack: () => undefined,
  close: () => undefined,
};

export const MassDiscoverContext =
  createContext<MassDiscoverContextValue>(fallbackContext);

export const MassDiscoverProvider = ({
  children,
}: {
  children: ComponentChildren;
}) => {
  const [stack, setStack] = useState<DiscoverFrame[]>([]);

  const openSimilar = useCallback((frame: Omit<SimilarFrame, "type">) => {
    setStack([{ ...frame, type: "similar" }]);
  }, []);

  const pushSimilar = useCallback((frame: Omit<SimilarFrame, "type">) => {
    setStack(prev => [...prev, { ...frame, type: "similar" }]);
  }, []);

  const openCollection = useCallback((frame: Omit<CollectionFrame, "type">) => {
    setStack([{ ...frame, type: "collection" }]);
  }, []);

  const pushCollection = useCallback((frame: Omit<CollectionFrame, "type">) => {
    setStack(prev => [...prev, { ...frame, type: "collection" }]);
  }, []);

  const goBack = useCallback(() => {
    setStack(prev => (prev.length > 1 ? prev.slice(0, -1) : []));
  }, []);

  const close = useCallback(() => {
    setStack([]);
  }, []);

  const value = useMemo(
    () => ({
      stack,
      isOpen: stack.length > 0,
      isSupported: true,
      openSimilar,
      pushSimilar,
      openCollection,
      pushCollection,
      goBack,
      close,
    }),
    [
      stack,
      openSimilar,
      pushSimilar,
      openCollection,
      pushCollection,
      goBack,
      close,
    ]
  );

  return (
    <MassDiscoverContext.Provider value={value}>
      {children}
    </MassDiscoverContext.Provider>
  );
};

export function useMassDiscover(): MassDiscoverContextValue {
  return useContext(MassDiscoverContext);
}
