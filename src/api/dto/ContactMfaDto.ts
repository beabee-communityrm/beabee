import { IsOptional, IsString } from "class-validator";

import { CONTACT_MFA_TYPE } from "@enums/contact-mfa-type";

import { ContactMfaData } from "@type/contact-mfa-data";
import { CreateContactMfaData } from "@type/create-contact-mfa-data";
import { DeleteContactMfaData } from "@type/delete-contact-mfa-data";

/**
 * Get contact multi factor authentication validation data
 */
export class GetContactMfaDto implements ContactMfaData {
  @IsString()
  type!: CONTACT_MFA_TYPE;
}

/**
 * Create contact multi factor authentication validation data
 */
export class CreateContactMfaDto implements CreateContactMfaData {
  @IsString()
  secret!: string;

  /** The code from the authenticator app */
  @IsString()
  token!: string;

  @IsString()
  type!: CONTACT_MFA_TYPE;
}

export class DeleteContactMfaDto implements DeleteContactMfaData {
  /** The code from the authenticator app, only required by the user itself, not by the admin */
  @IsString()
  @IsOptional()
  token?: string;

  @IsString()
  type!: CONTACT_MFA_TYPE;
}
