import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn
} from "typeorm";

import type Address from "./Address";
import type Member from "./Member";

export class GiftForm {
  @Column()
  firstname!: string;

  @Column()
  lastname!: string;

  @Column()
  email!: string;

  @Column({ type: "date" })
  startDate!: Date;

  @Column({ nullable: true })
  message: string | undefined;

  @Column()
  fromName!: string;

  @Column()
  fromEmail!: string;

  @Column()
  months!: number;

  @Column({ type: "jsonb", nullable: true })
  giftAddress: Address | undefined;

  @Column({ type: "jsonb", nullable: true })
  deliveryAddress: Address | undefined;
}

@Entity()
export default class GiftFlow {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @CreateDateColumn()
  date!: Date;

  @Column()
  sessionId!: string;

  @Column({ unique: true })
  setupCode!: string;

  @Column(() => GiftForm)
  giftForm!: GiftForm;

  @Column({ default: false })
  completed!: boolean;

  @Column({ default: false })
  processed!: boolean;

  @ManyToOne("Member")
  giftee?: Member;
}
