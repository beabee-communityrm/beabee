import { Column, Entity, ManyToOne } from "typeorm";
import type Member from "./Member";

@Entity()
export default class GCPaymentData {
  @ManyToOne("Member", { primary: true })
  member!: Member;

  @Column({ type: String, nullable: true })
  customerId: string | undefined;

  @Column({ type: String, nullable: true })
  mandateId: string | undefined;

  @Column({ type: String, nullable: true })
  subscriptionId: string | undefined;

  @Column({ type: Date, nullable: true })
  cancelledAt: Date | undefined;

  @Column({ type: Boolean, nullable: true })
  payFee: boolean | undefined;
}
