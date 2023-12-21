import { ContactMfaData } from "./contact-mfa-data";

export interface DeleteContactMfaData extends ContactMfaData {
  token?: string;
}
