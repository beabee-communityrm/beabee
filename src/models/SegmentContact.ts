import { CreateDateColumn, Entity, ManyToOne } from "typeorm";

import type Contact from "./Contact";
import type Segment from "./Segment";

@Entity()
export default class SegmentContact {
  @ManyToOne("Segment", "contacts", { primary: true })
  segment!: Segment;

  @ManyToOne("Contact", { primary: true })
  contact!: Contact;

  @CreateDateColumn()
  date!: Date;
}
