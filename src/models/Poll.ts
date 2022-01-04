import moment from "moment";
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryColumn
} from "typeorm";
import PollResponse from "./PollResponse";

export type PollTemplate = "custom" | "builder" | "ballot";

export enum PollAccess {
  Member = "member",
  Guest = "guest",
  Anonymous = "anonymous",
  OnlyAnonymous = "only-anonymous"
}

@Entity()
export default class Poll {
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
  image: string | undefined;

  @Column({ type: String, nullable: true })
  mcMergeField: string | undefined;

  @Column({ type: String, nullable: true })
  pollMergeField: string | undefined;

  @Column({ default: true })
  closed!: boolean;

  @Column({ type: Date, nullable: true })
  starts: Date | undefined;

  @Column({ type: Date, nullable: true })
  expires: Date | undefined;

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

  responseCount?: number;

  get active(): boolean {
    const now = moment.utc();
    return (
      !this.closed &&
      (!this.starts || now.isAfter(this.starts)) &&
      (!this.expires || now.isBefore(this.expires))
    );
  }
}
