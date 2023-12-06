import { CreateDateColumn, Entity, ManyToOne, PrimaryColumn } from "typeorm";

import type Contact from "./Contact";
import type Segment from "./Segment";

@Entity()
export default class SegmentContact {
  @PrimaryColumn()
  segmentId!: string;
  @ManyToOne("Segment", "contacts")
  segment!: Segment;

  @PrimaryColumn()
  contactId!: string;
  @ManyToOne("Contact")
  contact!: Contact;

  @CreateDateColumn()
  date!: Date;
}
