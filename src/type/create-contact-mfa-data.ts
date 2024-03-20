import { CONTACT_MFA_TYPE } from "#enums/contact-mfa-type";

export interface CreateContactMfaData {
  type: CONTACT_MFA_TYPE;
  secret: string;
  token: string;
}
