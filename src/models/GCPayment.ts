import { Column, Entity } from "typeorm";
import { ContributionPeriod } from "@core/utils";
import {
  pendingStatuses,
  successStatuses
} from "@core/utils/payment/gocardless";
import Payment from "./Payment";

@Entity()
export default class GCPayment extends Payment {
  @Column({ unique: true })
  paymentId!: string;

  @Column({ type: String, nullable: true })
  subscriptionId!: string | null;

  @Column({ type: String, nullable: true })
  subscriptionPeriod!: ContributionPeriod | null;

  @Column()
  status!: string;

  get isPending(): boolean {
    return pendingStatuses.indexOf(this.status) > -1;
  }

  get isSuccessful(): boolean {
    return successStatuses.indexOf(this.status) > -1;
  }
}
