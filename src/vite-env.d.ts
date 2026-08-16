/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ADFIT_HOME_DESKTOP?: string;
  readonly VITE_ADFIT_HOME_MOBILE?: string;
  readonly VITE_ADFIT_COURSE_DESKTOP?: string;
  readonly VITE_ADFIT_COURSE_MOBILE?: string;
  readonly VITE_ADFIT_HOME_SECONDARY_DESKTOP?: string;
  readonly VITE_ADFIT_HOME_SECONDARY_MOBILE?: string;
  readonly VITE_ADFIT_COURSE_SECONDARY_DESKTOP?: string;
  readonly VITE_ADFIT_COURSE_SECONDARY_MOBILE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
