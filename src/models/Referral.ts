import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn
} from "typeorm";

import type Member from "./Member";
import ReferralGift from "./ReferralGift";

@Entity()
export default class Referral {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @CreateDateColumn()
  date!: Date;

  @ManyToOne("Member", { nullable: true })
  referrer!: Member | null;

  @ManyToOne("Member")
  referee!: Member;

  @Column()
  refereeAmount!: number;

  @ManyToOne(() => ReferralGift, { nullable: true })
  refereeGift!: ReferralGift | null;

  @Column({ type: "jsonb", nullable: true })
  refereeGiftOptions!: Record<string, string> | null;

  @ManyToOne(() => ReferralGift, { nullable: true })
  referrerGift!: ReferralGift | null;

  @Column({ type: "jsonb", nullable: true })
  referrerGiftOptions!: Record<string, string> | null;

  @Column({ default: false })
  referrerHasSelected!: boolean;
}
