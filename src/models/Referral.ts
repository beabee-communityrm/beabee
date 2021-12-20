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
  referrer: Member | undefined;

  @ManyToOne("Member")
  referee!: Member;

  @Column()
  refereeAmount!: number;

  @ManyToOne(() => ReferralGift, { nullable: true })
  refereeGift: ReferralGift | undefined;

  @Column({ type: "jsonb", nullable: true })
  refereeGiftOptions: Record<string, string> | undefined;

  @ManyToOne(() => ReferralGift, { nullable: true })
  referrerGift: ReferralGift | undefined;

  @Column({ type: "jsonb", nullable: true })
  referrerGiftOptions: Record<string, string> | undefined;

  @Column({ default: false })
  referrerHasSelected!: boolean;
}
