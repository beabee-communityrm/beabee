// TODO: Move this to it's own beabee-locale package because we use it beabee and beabee-frontend

import OptionsService from "@core/services/OptionsService";

import localeDe from "./de.json";
import localeDeInformal from "./de@informal.json";
import localeEn from "./en.json";
import localePt from "./pt.json";
import localeRu from "./ru.json";
import localeIt from "./it.json";

export const locales = {
  de: localeDe,
  "de@informal": localeDeInformal,
  en: localeEn,
  nl: localeEn, // CNR only
  pt: localePt,
  ru: localeRu,
  it: localeIt
} as const;

export type Locale = keyof typeof locales;

export function isLocale(s: string): s is Locale {
  return s in locales;
}

export default function currentLocale() {
  return locales[OptionsService.getText("locale") as Locale];
}
