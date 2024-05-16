import { MigrationInterface, QueryRunner } from "typeorm";

export class ImproveContactFieldTypes1715355140741
  implements MigrationInterface
{
  name = "ImproveContactFieldTypes1715355140741";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "contact_mfa" DROP CONSTRAINT "FK_c40227151c460b576a5670bdac5"`
    );
    await queryRunner.query(
      `ALTER TABLE "contact_mfa" ALTER COLUMN "contactId" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "project" DROP CONSTRAINT "FK_9884b2ee80eb70b7db4f12e8aed"`
    );
    await queryRunner.query(
      `ALTER TABLE "project" ALTER COLUMN "ownerId" DROP NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "contact_mfa" ADD CONSTRAINT "FK_c40227151c460b576a5670bdac5" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "project" ADD CONSTRAINT "FK_9884b2ee80eb70b7db4f12e8aed" FOREIGN KEY ("ownerId") REFERENCES "contact"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "project" DROP CONSTRAINT "FK_9884b2ee80eb70b7db4f12e8aed"`
    );
    await queryRunner.query(
      `ALTER TABLE "contact_mfa" DROP CONSTRAINT "FK_c40227151c460b576a5670bdac5"`
    );
    await queryRunner.query(
      `ALTER TABLE "project" ALTER COLUMN "ownerId" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "project" ADD CONSTRAINT "FK_9884b2ee80eb70b7db4f12e8aed" FOREIGN KEY ("ownerId") REFERENCES "contact"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "contact_mfa" ALTER COLUMN "contactId" DROP NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "contact_mfa" ADD CONSTRAINT "FK_c40227151c460b576a5670bdac5" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }
}
