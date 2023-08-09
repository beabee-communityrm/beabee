import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUploadFlow1691577150283 implements MigrationInterface {
  name = "AddUploadFlow1691577150283";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "upload_flow" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "date" TIMESTAMP NOT NULL DEFAULT now(), "ipAddress" character varying NOT NULL, "contactId" uuid, CONSTRAINT "PK_dea5af948f12a1e2f6b9eda8fed" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `ALTER TABLE "upload_flow" ADD CONSTRAINT "FK_7fd2ec6c624ff8ece06726443d0" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "upload_flow" DROP CONSTRAINT "FK_7fd2ec6c624ff8ece06726443d0"`
    );
    await queryRunner.query(`DROP TABLE "upload_flow"`);
  }
}
