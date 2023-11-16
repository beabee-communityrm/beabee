import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameResetPasswordFlowToResetSecurityFlow1700131647453 implements MigrationInterface {
    name = 'RenameResetPasswordFlowToResetSecurityFlow1700131647453'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "reset_password_flow" DROP CONSTRAINT "FK_06c9d2d78e460f9a8ecdba5a592"`);
        await queryRunner.query(`DROP TABLE "reset_password_flow"`);

        await queryRunner.query(`CREATE TABLE "reset_security_flow" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "date" TIMESTAMP NOT NULL DEFAULT now(), "type" character varying NOT NULL, "contactId" uuid, CONSTRAINT "PK_4b4e6ea02763fa1a496023d5358" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "reset_security_flow" ADD CONSTRAINT "FK_95804d4501f49efddbdb435a929" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "reset_security_flow" DROP CONSTRAINT "FK_95804d4501f49efddbdb435a929"`);
        await queryRunner.query(`DROP TABLE "reset_security_flow"`);

        await queryRunner.query(`CREATE TABLE "reset_password_flow" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "date" TIMESTAMP NOT NULL DEFAULT now(), "contactId" uuid, CONSTRAINT "PK_792d332c6a52a3b371bb75504a0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "reset_password_flow" ADD CONSTRAINT "FK_06c9d2d78e460f9a8ecdba5a592" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
