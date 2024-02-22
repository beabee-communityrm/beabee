import { CalloutFormSchema } from "@beabee/beabee-common";

import { CalloutAccess } from "@enums/callout-access";

import { CalloutResponseViewSchema } from "./callout-response-view-schema";
import { CalloutVariantData } from "./callout-variant-data";

export interface CalloutData {
  slug?: string;
  // title: string;
  // excerpt: string;
  image: string;
  starts: Date | null;
  expires: Date | null;
  allowUpdate: boolean;
  allowMultiple: boolean;
  access: CalloutAccess;
  hidden: boolean;
  responseViewSchema?: CalloutResponseViewSchema | null;
  formSchema?: CalloutFormSchema;
  variants?: Record<string, CalloutVariantData>;
}
