import Contact from "@models/Contact";
import { IsString, IsObject } from "class-validator";

export interface CalloutResponseCommentData {
  calloutResponseId: string;
  text: string;
}

export interface CreateCalloutResponseCommentData
  extends CalloutResponseCommentData {
  contact: Contact;
}

export interface GetCalloutResponseCommentData
  extends CalloutResponseCommentData {
  contact: Contact;
  id: string;
  createdAt: Date;
}

export class CreateCalloutResponseCommentData
  implements CreateCalloutResponseCommentData
{
  @IsObject()
  contact!: Contact;

  @IsString()
  calloutResponseId!: string;

  @IsString()
  text!: string;
}
