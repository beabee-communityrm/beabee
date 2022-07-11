import { PaymentStatus } from "gocardless-nodejs/types/Types";
import { MigrationInterface, QueryRunner } from "typeorm";

export class ConvertPaymentStatuses1656935238800 implements MigrationInterface {
  name = "ConvertPaymentStatuses1656935238800";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const statusMap = [
      [PaymentStatus.PendingCustomerApproval, "pending"],
      [PaymentStatus.PendingSubmission, "pending"],
      [PaymentStatus.Submitted, "pending"],
      [PaymentStatus.Confirmed, "successful"],
      [PaymentStatus.PaidOut, "successful"],
      [PaymentStatus.Failed, "failed"],
      [PaymentStatus.CustomerApprovalDenied, "failed"],
      [PaymentStatus.Cancelled, "cancelled"],
      [PaymentStatus.ChargedBack, "cancelled"]
    ];

    for (const [gcStatus, newStatus] of statusMap) {
      await queryRunner.query("UPDATE payment SET status=$1 WHERE status=$2", [
        newStatus,
        gcStatus
      ]);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
