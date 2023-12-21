import { ContactMfaData } from "./contact-mfa-data";

export interface CreateContactMfaData extends ContactMfaData {
  secret: string;
  token: string;
}
