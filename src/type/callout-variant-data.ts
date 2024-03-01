import { CalloutNavigationSchema } from "@beabee/beabee-common";

export interface CalloutVariantData {
  title: string;
  excerpt: string;
  intro: string;
  thanksTitle: string;
  thanksText: string;
  thanksRedirect: string | null;
  shareTitle: string | null;
  shareDescription: string | null;
  slideNavigation: Record<string, CalloutVariantNavigationData>;
  componentText: Record<string, string>;
}

export type CalloutVariantNavigationData = Pick<
  CalloutNavigationSchema,
  "prevText" | "nextText" | "submitText"
>;
