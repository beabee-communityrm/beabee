import { MigrationInterface, QueryRunner } from "typeorm";

export class AddContactMfa1698159593990 implements MigrationInterface {
  name = "AddContactMfa1698159593990";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."contact_mfa_type_enum" AS ENUM('totp')`
    );
    await queryRunner.query(
      `CREATE TABLE "contact_mfa" ("type" "public"."contact_mfa_type_enum" NOT NULL, "secret" character varying NOT NULL DEFAULT '', "contactId" uuid NOT NULL, CONSTRAINT "REL_c40227151c460b576a5670bdac" UNIQUE ("contactId"), CONSTRAINT "PK_c40227151c460b576a5670bdac5" PRIMARY KEY ("contactId"))`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response_comment" DROP CONSTRAINT "FK_49079a033f285ccfa789aba2efa"`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response_comment" DROP CONSTRAINT "FK_81b0d2a988cfd8d34ad7fc3bb68"`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response_comment" ALTER COLUMN "contactId" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response_comment" ALTER COLUMN "responseId" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response_comment" ADD CONSTRAINT "FK_49079a033f285ccfa789aba2efa" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response_comment" ADD CONSTRAINT "FK_81b0d2a988cfd8d34ad7fc3bb68" FOREIGN KEY ("responseId") REFERENCES "callout_response"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "contact_mfa" ADD CONSTRAINT "FK_c40227151c460b576a5670bdac5" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "contact_mfa" DROP CONSTRAINT "FK_c40227151c460b576a5670bdac5"`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response_comment" DROP CONSTRAINT "FK_81b0d2a988cfd8d34ad7fc3bb68"`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response_comment" DROP CONSTRAINT "FK_49079a033f285ccfa789aba2efa"`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response_comment" ALTER COLUMN "responseId" DROP NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response_comment" ALTER COLUMN "contactId" DROP NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response_comment" ADD CONSTRAINT "FK_81b0d2a988cfd8d34ad7fc3bb68" FOREIGN KEY ("responseId") REFERENCES "callout_response"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response_comment" ADD CONSTRAINT "FK_49079a033f285ccfa789aba2efa" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(`DROP TABLE "contact_mfa"`);
    await queryRunner.query(`DROP TYPE "public"."contact_mfa_type_enum"`);
  }
}
