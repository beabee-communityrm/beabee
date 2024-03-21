import { CONTACT_MFA_TYPE } from "#enums/contact-mfa-type";

export interface DeleteContactMfaData {
  type: CONTACT_MFA_TYPE;
  token?: string;
}
