import { memo, useEffect } from "react";
import { ensureAdFitSdk } from "./adfit";

export type AdFitPlacement = "desktop-right" | "mobile-bottom";

export interface AdFitSlotProps {
  unitId: string;
  width: 160 | 320;
  height: 600 | 50;
  placement: AdFitPlacement;
}

function AdFitSlot({ unitId, width, height, placement }: AdFitSlotProps) {
  useEffect(() => {
    ensureAdFitSdk();
  }, []);

  return (
    <div
      className={`adfit-slot-shell adfit-slot-shell--${placement}`}
      data-adfit-placement={placement}
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

