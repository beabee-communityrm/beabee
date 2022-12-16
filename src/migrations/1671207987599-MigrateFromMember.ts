import { MigrationInterface, QueryRunner } from "typeorm";

export class MigrateFromMember1671207987599 implements MigrationInterface {
  name = "MigrateFromMember1671207987599";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "login_override_flow" DROP CONSTRAINT "FK_c614df1876e40619c299eb08e52"`
    );
    await queryRunner.query(
      `ALTER TABLE "login_override_flow" RENAME COLUMN "memberId" TO "contactId"`
    );
    await queryRunner.query(
      `ALTER TABLE "login_override_flow" ADD CONSTRAINT "FK_c92061ddc223bbcbd735587d9cb" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "login_override_flow" DROP CONSTRAINT "FK_c92061ddc223bbcbd735587d9cb"`
    );
    await queryRunner.query(
      `ALTER TABLE "login_override_flow" RENAME COLUMN "contactId" TO "memberId"`
    );
    await queryRunner.query(
      `ALTER TABLE "login_override_flow" ADD CONSTRAINT "FK_c614df1876e40619c299eb08e52" FOREIGN KEY ("memberId") REFERENCES "contact"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }
}
