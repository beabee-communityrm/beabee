import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCalloutResponseCommentTable1678888737358
  implements MigrationInterface
{
  name = "AddCalloutResponseCommentTable1678888737358";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "callout_response_comment" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "text" character varying NOT NULL, "contactId" uuid, "responseId" uuid, CONSTRAINT "PK_8c46a94de180a643d4fcc7a720b" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response_comment" ADD CONSTRAINT "FK_1987a197408e5b0af0c69cb373e" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response_comment" ADD CONSTRAINT "FK_a5eb2766eb7d57c736618edb82c" FOREIGN KEY ("responseId") REFERENCES "callout_response"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "callout_response_comment" DROP CONSTRAINT "FK_a5eb2766eb7d57c736618edb82c"`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response_comment" DROP CONSTRAINT "FK_1987a197408e5b0af0c69cb373e"`
    );
    await queryRunner.query(`DROP TABLE "callout_response_comment"`);
  }
}
