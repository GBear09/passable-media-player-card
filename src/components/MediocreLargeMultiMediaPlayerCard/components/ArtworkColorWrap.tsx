import { useArtworkColors } from "@hooks";
import { HTMLAttributes, memo, forwardRef } from "preact/compat";

type ArtworkColorWrapProps = {
  useArtColors?: boolean;
} & HTMLAttributes<HTMLDivElement>;

export const ArtworkColorWrap = memo<ArtworkColorWrapProps>(
  forwardRef<HTMLDivElement, ArtworkColorWrapProps>(
    ({ style, useArtColors, ...props }: ArtworkColorWrapProps, ref) => {
      const { artVars, haVars } = useArtworkColors(Boolean(useArtColors));

      return (
        <ha-card
          {...props}
          style={{
            overflow: "hidden",
            padding: 0,
            ...(artVars ?? {}),
            ...(haVars && useArtColors ? haVars : {}),
            ...(typeof style === "object" ? style : {}),
          }}
          ref={ref as never}
        />
      );
    }
  )
);
