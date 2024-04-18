import { MigrationInterface, QueryRunner } from "typeorm";

export class FlattenContributionData1713434533086
  implements MigrationInterface
{
  name = "FlattenContributionData1713434533086";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "contact_contribution" DROP CONSTRAINT "FK_a2c17e82f66eefb33d47feb4b55"`
    );
    await queryRunner.query(
      `ALTER TABLE "contact_contribution" ADD "customerId" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "contact_contribution" ADD "mandateId" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "contact_contribution" ADD "subscriptionId" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "contact_contribution" ADD "payFee" boolean`
    );
    await queryRunner.query(
      `ALTER TABLE "contact_contribution" ADD "nextAmount" jsonb`
    );
    await queryRunner.query(
      `UPDATE "contact_contribution" SET
        "nextAmount" = "data"->'nextAmount',
        "payFee" = ("data"->'payFee')::boolean,
        "subscriptionId" = "data"->>'subscriptionId',
        "mandateId" = "data"->>'mandateId',
        "customerId" = "data"->>'customerId'
      WHERE "method" IS NOT NULL`
    );
    await queryRunner.query(
      `UPDATE "contact_contribution" SET "mandateId" = "data"->>'source', "customerId" = "data"->>'reference' WHERE "method" IS NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "contact_contribution" DROP COLUMN "data"`
    );
    await queryRunner.query(
      `ALTER TABLE "contact_contribution" ADD CONSTRAINT "FK_a973ebea461b08dbf2137cb240e" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "contact_contribution" DROP CONSTRAINT "FK_a973ebea461b08dbf2137cb240e"`
    );
    await queryRunner.query(
      `ALTER TABLE "contact_contribution" ADD "data" jsonb NOT NULL DEFAULT '{}'`
    );
    await queryRunner.query(
      `UPDATE "contact_contribution" SET
        "data" = jsonb_build_object(
            'nextAmount', "nextAmount",
            'payFee', "payFee",
            'subscriptionId', "subscriptionId",
            'mandateId', "mandateId",
            'customerId', "customerId"
        )
      WHERE "method" IS NOT NULL`
    );
    await queryRunner.query(
      `UPDATE "contact_contribution" SET "data" = jsonb_build_object( 'source', "mandateId", 'reference', "customerId") WHERE "method" IS NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "contact_contribution" DROP COLUMN "nextAmount"`
    );
    await queryRunner.query(
      `ALTER TABLE "contact_contribution" DROP COLUMN "payFee"`
    );
    await queryRunner.query(
      `ALTER TABLE "contact_contribution" DROP COLUMN "subscriptionId"`
    );
    await queryRunner.query(
      `ALTER TABLE "contact_contribution" DROP COLUMN "mandateId"`
    );
    await queryRunner.query(
      `ALTER TABLE "contact_contribution" DROP COLUMN "customerId"`
    );
    await queryRunner.query(
      `ALTER TABLE "contact_contribution" ADD CONSTRAINT "FK_a2c17e82f66eefb33d47feb4b55" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }
}
