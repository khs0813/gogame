/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ADFIT_GOGAME_DESKTOP_160X600?: string;
  readonly VITE_ADFIT_GOGAME_MOBILE_320X50?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

