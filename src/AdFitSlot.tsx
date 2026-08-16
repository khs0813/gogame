import { memo, useEffect, useRef } from "react";
import { destroyAdFitElement, ensureAdFitSdk } from "./adfit";

export type AdFitVariant = "desktop" | "mobile";
export type AdFitWidth = 728 | 320;
export type AdFitHeight = 90 | 100;

export interface AdFitSlotProps {
  unitId: string;
  width: AdFitWidth;
  height: AdFitHeight;
  variant: AdFitVariant;
}

function AdFitSlot({ unitId, width, height, variant }: AdFitSlotProps) {
  const adElementRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    const element = adElementRef.current;
    const frameId = window.requestAnimationFrame(() => {
      ensureAdFitSdk();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      if (element) destroyAdFitElement(element);
    };
  }, [unitId]);

  return (
    <div
      className={`adfit-unit adfit-unit--${variant}`}
      data-adfit-variant={variant}
      style={{ width, height, minWidth: width, minHeight: height }}
    >
      <ins
        ref={adElementRef}
        className="kakao_ad_area"
        style={{ display: "none", width: "100%" }}
        data-ad-unit={unitId}
        data-ad-width={String(width)}
        data-ad-height={String(height)}
      />
    </div>
  );
}

export default memo(AdFitSlot);
