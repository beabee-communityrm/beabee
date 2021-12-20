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

export type PollResponseAnswers = Record<
  string,
  string | boolean | number | undefined
>;

@Entity()
export default class PollResponse {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne("Poll", "responses")
  poll!: Poll;

  @ManyToOne("Member", { nullable: true })
  member: Member | undefined;

  @Column({ nullable: true })
  guestName: string | undefined;

  @Column({ nullable: true })
  guestEmail: string | undefined;

  @Column({ type: "jsonb" })
  answers!: PollResponseAnswers;

  @Column()
  isPartial!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
