import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryColumn
} from "typeorm";
import ItemStatus, { ItemWithStatus } from "./ItemStatus";
import PollResponse from "./PollResponse";

export type PollTemplate = "custom" | "builder" | "ballot";

export enum PollAccess {
  Member = "member",
  Guest = "guest",
  Anonymous = "anonymous",
  OnlyAnonymous = "only-anonymous"
}

@Entity()
export default class Poll extends ItemWithStatus {
  @PrimaryColumn()
  slug!: string;

  @CreateDateColumn()
  date!: Date;

  @Column()
  template!: PollTemplate;

  @Column({ type: "jsonb", default: "{}" })
  templateSchema!: Record<string, unknown>;

  @Column()
  title!: string;

  @Column()
  excerpt!: string;

  @Column({ type: String, nullable: true })
  image!: string | null;

  @Column({ type: String, nullable: true })
  mcMergeField!: string | null;

  @Column({ type: String, nullable: true })
  pollMergeField!: string | null;

  @Column({ type: Date, nullable: true })
  starts!: Date | null;

  @Column({ type: Date, nullable: true })
  expires!: Date | null;

  @Column()
  allowUpdate!: boolean;

  @Column({ default: false })
  allowMultiple!: boolean;

  @Column({ default: PollAccess.Member })
  access!: PollAccess;

  @Column({ default: false })
  hidden!: boolean;

  @OneToMany(() => PollResponse, (r) => r.poll)
  responses!: PollResponse[];

  @Column({ nullable: true })
  responsePassword?: string;

  hasAnswered?: boolean;
  responseCount?: number;
}
