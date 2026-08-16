import { memo, useEffect, useState } from "react";
import AdFitSlot from "./AdFitSlot";
import { selectInitialAdVariant, type AdVariant } from "./adfit";

const desktopMediaQuery = "(min-width: 768px)";

export type ResponsiveAdFitPlacement =
  | "home-primary"
  | "home-secondary"
  | "course-primary"
  | "course-secondary"
  | "rules-primary"
  | "rules-secondary";

export interface ResponsiveAdFitProps {
  desktopUnit: string;
  mobileUnit: string;
  placement: ResponsiveAdFitPlacement;
  label: string;
}

function currentVariant(): AdVariant {
  if (typeof window.matchMedia !== "function") return selectInitialAdVariant();
  return window.matchMedia(desktopMediaQuery).matches ? "desktop" : "mobile";
}

function ResponsiveAdFit({ desktopUnit, mobileUnit, placement, label }: ResponsiveAdFitProps) {
  const [variant, setVariant] = useState<AdVariant>(() => currentVariant());

  useEffect(() => {
    const media = window.matchMedia(desktopMediaQuery);
    const update = () => setVariant(media.matches ? "desktop" : "mobile");
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const unitId = variant === "desktop" ? desktopUnit : variant === "mobile" ? mobileUnit : "";
  if (!variant || !unitId) return null;

  const dimensions = variant === "desktop"
    ? { width: 728 as const, height: 90 as const }
    : { width: 320 as const, height: 100 as const };

  return (
    <div
      className={`adfit-slot adfit-slot--${placement}`}
      aria-label={label}
      data-adfit-placement={placement}
      data-adfit-variant={variant}
    >
      <AdFitSlot
        key={`${placement}-${variant}-${unitId}`}
        unitId={unitId}
        width={dimensions.width}
        height={dimensions.height}
        variant={variant}
      />
    </div>
  );
}

export default memo(ResponsiveAdFit);
