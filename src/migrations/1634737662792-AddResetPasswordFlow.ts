import { MigrationInterface, QueryRunner } from "typeorm";

export class AddResetPasswordFlow1634737662792 implements MigrationInterface {
  name = "AddResetPasswordFlow1634737662792";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "reset_password_flow" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "date" TIMESTAMP NOT NULL DEFAULT now(), "memberId" uuid, CONSTRAINT "PK_792d332c6a52a3b371bb75504a0" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `ALTER TABLE "reset_password_flow" ADD CONSTRAINT "FK_f86d0f751ef1f0fd9efd04910c3" FOREIGN KEY ("memberId") REFERENCES "member"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reset_password_flow" DROP CONSTRAINT "FK_f86d0f751ef1f0fd9efd04910c3"`
    );
    await queryRunner.query(`DROP TABLE "reset_password_flow"`);
  }
}
