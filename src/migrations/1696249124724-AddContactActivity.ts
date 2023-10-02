import { MigrationInterface, QueryRunner } from "typeorm";

export class AddContactActivity1696249124724 implements MigrationInterface {
  name = "AddContactActivity1696249124724";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "contact_activity" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "date" TIMESTAMP NOT NULL DEFAULT now(), "type" character varying NOT NULL, "data" jsonb NOT NULL DEFAULT '{}', "contactId" uuid, CONSTRAINT "PK_f9f681421ba15fd3eae568a1c07" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `ALTER TABLE "contact_activity" ADD CONSTRAINT "FK_81a1744c325c05206aa1efd67c1" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "contact_activity" DROP CONSTRAINT "FK_81a1744c325c05206aa1efd67c1"`
    );
    await queryRunner.query(`DROP TABLE "contact_activity"`);
  }
}
