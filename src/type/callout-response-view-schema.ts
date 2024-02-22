import { CalloutMapSchema } from "./callout-map-schema";

export interface CalloutResponseViewSchema {
  buckets: string[];
  titleProp: string;
  imageProp: string;
  imageFilter: string;
  gallery: boolean;
  links: { text: string; url: string }[];
  map: CalloutMapSchema | null;
}
