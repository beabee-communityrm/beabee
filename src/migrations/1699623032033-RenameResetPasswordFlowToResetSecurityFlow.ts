import { MigrationInterface, QueryRunner } from "typeorm";
import { AddResetPasswordFlow1634737662792 } from "./1634737662792-AddResetPasswordFlow";

export class RenameResetPasswordFlowToResetSecurityFlow1699623032033
  implements MigrationInterface
{
  oldMigration = new AddResetPasswordFlow1634737662792();

  name = "RenameResetPasswordFlowToResetSecurityFlow1699623032033";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const oldTableExists = await queryRunner.hasTable("reset_password_flow");
    if (oldTableExists) {
      await this.oldMigration.down(queryRunner);
    }
    await queryRunner.query(
      `CREATE TABLE "reset_security_flow" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "date" TIMESTAMP NOT NULL DEFAULT now(), "type" character varying NOT NULL, "contactId" uuid, CONSTRAINT "PK_4b4e6ea02763fa1a496023d5358" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `ALTER TABLE "reset_security_flow" ADD CONSTRAINT "FK_95804d4501f49efddbdb435a929" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reset_security_flow" DROP CONSTRAINT "FK_95804d4501f49efddbdb435a929"`
    );
    await queryRunner.query(`DROP TABLE "reset_security_flow"`);
    const oldTableExists = await queryRunner.hasTable("reset_password_flow");
    if (!oldTableExists) {
      await this.oldMigration.up(queryRunner);
    }
  }
}
