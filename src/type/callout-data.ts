import { CalloutAccess } from "@enums/callout-access";

import { CalloutResponseViewSchema } from "./callout-response-view-schema";
import { CalloutVariantData } from "./callout-variant-data";
import { SetCalloutFormSchema } from "@beabee/beabee-common";

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
}

export interface CreateCalloutData extends CalloutData {
  formSchema: SetCalloutFormSchema;
  variants: Record<string, CalloutVariantData>;
}
