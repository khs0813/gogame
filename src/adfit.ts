export type AdVariant = "desktop" | "mobile" | null;

const ADFIT_SDK_URL = "https://t1.kakaocdn.net/kas/static/ba.min.js";
const ADFIT_SDK_HOST = "t1.kakaocdn.net";
const ADFIT_SDK_PATH = "/kas/static/ba.min.js";

export function selectAdVariant(width: number): AdVariant {
  return width >= 768 ? "desktop" : "mobile";
}

export function selectInitialAdVariant(): AdVariant {
  return selectAdVariant(window.innerWidth || document.documentElement.clientWidth);
}

function isAdFitSdkScript(script: HTMLScriptElement): boolean {
  try {
    const url = new URL(script.src, window.location.href);
    return url.hostname === ADFIT_SDK_HOST && url.pathname === ADFIT_SDK_PATH;
  } catch {
    return false;
  }
}

export function ensureAdFitSdk(): void {
  if ([...document.scripts].some(isAdFitSdkScript)) return;

  const script = document.createElement("script");
  script.async = true;
  script.type = "text/javascript";
  script.charset = "utf-8";
  script.src = ADFIT_SDK_URL;
  script.dataset.gogameAdfitSdk = "true";
  document.body.appendChild(script);
}
