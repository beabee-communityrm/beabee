import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn
} from "typeorm";

import type Segment from "./Segment";
import type Email from "./Email";

@Entity()
export default class SegmentOngoingEmail {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @CreateDateColumn()
  date!: Date;

  @Column()
  segmentId!: string;
  @ManyToOne("Segment")
  segment!: Segment;

  @Column()
  trigger!: string;

  @Column()
  emailId!: string;
  @ManyToOne("Email")
  email!: Email;

  @Column({ default: false })
  enabled!: boolean;
}
