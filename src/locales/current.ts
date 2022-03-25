import config from "@config";

import localeDe from "./de.json";
import localeDeInformal from "./de@informal.json";
import localeEn from "./en.json";

const locales = {
  de: localeDe,
  "de@informal": localeDeInformal,
  en: localeEn
} as const;

export default locales[config.locale];
