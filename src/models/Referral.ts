import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn
} from "typeorm";

import type Contact from "./Contact";
import ReferralGift from "./ReferralGift";

@Entity()
export default class Referral {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @CreateDateColumn()
  date!: Date;

  @Column({ type: String, nullable: true })
  referrerId!: string;
  @ManyToOne("Contact", { nullable: true })
  referrer!: Contact | null;

  @Column()
  refereeId!: string;
  @ManyToOne("Contact")
  referee!: Contact;

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
