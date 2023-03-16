import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCalloutResponseAssignee1678884024926
  implements MigrationInterface
{
  name = "AddCalloutResponseAssignee1678884024926";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "callout_response" ADD "assigneeId" uuid`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response" ADD CONSTRAINT "FK_b3010c7f63a4120fc7a417f56ec" FOREIGN KEY ("assigneeId") REFERENCES "contact"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "callout_response" DROP CONSTRAINT "FK_b3010c7f63a4120fc7a417f56ec"`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response" DROP COLUMN "assigneeId"`
    );
  }
}
