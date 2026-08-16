import { memo, useEffect } from "react";
import { ensureAdFitSdk } from "./adfit";

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
  useEffect(() => {
    ensureAdFitSdk();
  }, [unitId]);

  return (
    <div
      className={`adfit-unit adfit-unit--${variant}`}
      data-adfit-variant={variant}
      style={{ width, height, minWidth: width, minHeight: height }}
    >
      <ins
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
