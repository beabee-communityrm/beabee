import Contact from "@models/Contact";
import { IsString } from "class-validator";

export interface CalloutResponseCommentData {
  responseId: string;
  text: string;
}

export interface GetCalloutResponseCommentData
  extends CalloutResponseCommentData {
  contact: Contact;
  id: string;
  createdAt: Date;
}

export class CreateCalloutResponseCommentData
  implements CalloutResponseCommentData
{
  @IsString()
  responseId!: string;

  @IsString()
  text!: string;
}
