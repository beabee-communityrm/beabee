import { Column, Entity, ManyToOne } from "typeorm";
import type Member from "./Member";

@Entity()
export default class GCPaymentData {
  @ManyToOne("Member", { primary: true })
  member!: Member;

  @Column({ nullable: true })
  customerId: string | undefined;

  @Column({ nullable: true })
  mandateId: string | undefined;

  @Column({ nullable: true })
  subscriptionId: string | undefined;

  @Column({ nullable: true })
  cancelledAt: Date | undefined;

  @Column({ nullable: true })
  payFee: boolean | undefined;
}
