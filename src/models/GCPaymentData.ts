import { Column, Entity, ManyToOne } from "typeorm";
import type Member from "./Member";

@Entity()
export default class GCPaymentData {
  @ManyToOne("Member", { primary: true })
  member!: Member;

  @Column({ type: String, nullable: true })
  customerId!: string | null;

  @Column({ type: String, nullable: true })
  mandateId!: string | null;

  @Column({ type: String, nullable: true })
  subscriptionId!: string | null;

  @Column({ type: Date, nullable: true })
  cancelledAt!: Date | null;

  @Column({ type: Boolean, nullable: true })
  payFee!: boolean | null;
}
