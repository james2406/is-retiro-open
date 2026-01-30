/// <reference types="vite/client" />
import { RetiroStatus } from "./types";
import { Locale } from "./i18n";

declare global {
  interface Window {
    __INITIAL_DATA__?: RetiroStatus;
    __INITIAL_LOCALE__?: Locale;
  }
}
