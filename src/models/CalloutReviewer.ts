import { Entity, ManyToOne } from "typeorm";
import type Callout from "./Callout";
import type Contact from "./Contact";

@Entity()
export default class CalloutReviewer {
  @ManyToOne("Callout", { primary: true })
  callout!: Callout;

  @ManyToOne("Contact", { primary: true })
  reviewer!: Contact;
}
