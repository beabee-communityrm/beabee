import { CalloutAccess } from "@enums/callout-access";

import { CalloutResponseViewSchema } from "./callout-response-view-schema";
import { CalloutVariantData } from "./callout-variant-data";
import { CalloutFormData } from "./callout-form-data";

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
  formSchema: CalloutFormData;
  variants: Record<string, CalloutVariantData>;
}
