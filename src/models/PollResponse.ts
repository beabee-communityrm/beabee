import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from "typeorm";

import type Member from "./Member";
import type Poll from "./Poll";

export type PollResponseAnswer =
  | string
  | boolean
  | number
  | null
  | undefined
  | Record<string, boolean>;
export type PollResponseAnswers = Record<string, PollResponseAnswer>;

@Entity()
export default class PollResponse {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne("Poll", "responses")
  poll!: Poll;

  @ManyToOne("Member", { nullable: true })
  member!: Member | null;

  @Column({ type: String, nullable: true })
  guestName!: string | null;

  @Column({ type: String, nullable: true })
  guestEmail!: string | null;

  @Column({ type: "jsonb" })
  answers!: PollResponseAnswers;

  @Column()
  isPartial!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
