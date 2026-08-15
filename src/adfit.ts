export type AdVariant = "desktop" | "mobile" | null;

const ADFIT_SDK_URL = "https://t1.kakaocdn.net/kas/static/ba.min.js";

export function selectAdVariant(width: number): AdVariant {
  if (width >= 1280) return "desktop";
  if (width >= 320) return "mobile";
  return null;
}

export function selectInitialAdVariant(): AdVariant {
  return selectAdVariant(window.innerWidth || document.documentElement.clientWidth);
}

export function ensureAdFitSdk(): void {
  if (document.querySelector(`script[src="${ADFIT_SDK_URL}"]`)) return;

  const script = document.createElement("script");
  script.async = true;
  script.type = "text/javascript";
  script.charset = "utf-8";
  script.src = ADFIT_SDK_URL;
  script.dataset.gogameAdfitSdk = "true";
  document.body.appendChild(script);
}
