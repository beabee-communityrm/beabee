import { MigrationInterface, QueryRunner } from "typeorm";

export class AddContactMfa1698219871601 implements MigrationInterface {
  name = "AddContactMfa1698219871601";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "contact_mfa" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" "public"."contact_mfa_type_enum" NOT NULL, "secret" character varying NOT NULL DEFAULT '', "contactId" uuid, CONSTRAINT "REL_c40227151c460b576a5670bdac" UNIQUE ("contactId"), CONSTRAINT "PK_d40458d0b855b5337eab082f69c" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `ALTER TABLE "contact_mfa" ADD CONSTRAINT "FK_c40227151c460b576a5670bdac5" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "contact_mfa" DROP CONSTRAINT "FK_c40227151c460b576a5670bdac5"`
    );
    await queryRunner.query(`DROP TABLE "contact_mfa"`);
  }
}
