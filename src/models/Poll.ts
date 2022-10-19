import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryColumn
} from "typeorm";
import { ItemWithStatus } from "./ItemStatus";
import PollResponse from "./PollResponse";

export type PollTemplate = "custom" | "builder" | "ballot";

export enum PollAccess {
  Member = "member",
  Guest = "guest",
  Anonymous = "anonymous",
  OnlyAnonymous = "only-anonymous"
}

export interface PollComponentSchema {
  key: string;
  type: string;
  label?: string;
  input?: boolean;
  values?: { label: string; value: string }[];
  components?: PollComponentSchema[];
}

export interface PollFormSchema {
  components: PollComponentSchema[];
}

@Entity()
export default class Poll extends ItemWithStatus {
  @PrimaryColumn()
  slug!: string;

  @CreateDateColumn()
  date!: Date;

  @Column()
  title!: string;

  @Column()
  excerpt!: string;

  @Column()
  image!: string;

  @Column()
  intro!: string;

  @Column()
  thanksTitle!: string;

  @Column()
  thanksText!: string;

  @Column({ type: String, nullable: true })
  thanksRedirect!: string | null;

  @Column({ type: String, nullable: true })
  shareTitle!: string | null;

  @Column({ type: String, nullable: true })
  shareDescription!: string | null;

  @Column({ type: "jsonb", default: "{}" })
  formSchema!: PollFormSchema;

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
