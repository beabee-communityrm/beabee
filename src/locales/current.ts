import OptionsService from "@core/services/OptionsService";

import localeDe from "./de.json";
import localeDeInformal from "./de@informal.json";
import localeEn from "./en.json";

const locales = {
  de: localeDe,
  "de@informal": localeDeInformal,
  en: localeEn
} as const;

export default function currentLocale() {
  return locales[OptionsService.getText("locale") as keyof typeof locales];
}
