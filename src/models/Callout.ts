import { CalloutFormSchema } from "@beabee/beabee-common";
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryColumn
} from "typeorm";
import ItemWithStatus from "./ItemWithStatus";
import CalloutResponse from "./CalloutResponse";

export type CalloutTemplate = "custom" | "builder" | "ballot";

export enum CalloutAccess {
  Member = "member",
  Guest = "guest",
  Anonymous = "anonymous",
  OnlyAnonymous = "only-anonymous"
}

export interface CalloutMapSchema {
  style: string;
  center: [number, number];
  bounds: [[number, number], [number, number]];
  minZoom: number;
  maxZoom: number;
  initialZoom: number;
  addressProp: string;
  addressPattern: string;
  addressPatternProp: string;
}

export interface CalloutResponseViewSchema {
  buckets: string[];
  titleProp: string;
  imageProp: string;
  imageFilter: string;
  gallery: boolean;
  links: { text: string; url: string }[];
  map: CalloutMapSchema | null;
}

@Entity()
export default class Callout extends ItemWithStatus {
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

  @Column({ type: "jsonb" })
  formSchema!: CalloutFormSchema;

  @Column({ type: "jsonb", nullable: true })
  responseViewSchema!: CalloutResponseViewSchema | null;

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

  @Column({ default: CalloutAccess.Member })
  access!: CalloutAccess;

  @Column({ default: false })
  hidden!: boolean;

  @OneToMany(() => CalloutResponse, (r) => r.callout)
  responses!: CalloutResponse[];

  @Column({ nullable: true })
  responsePassword?: string;

  hasAnswered?: boolean;
  responseCount?: number;
}
