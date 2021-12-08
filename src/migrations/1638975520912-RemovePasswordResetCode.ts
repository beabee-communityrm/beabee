import { MigrationInterface, QueryRunner } from "typeorm";

export class RemovePasswordResetCode1638975520912
  implements MigrationInterface
{
  name = "RemovePasswordResetCode1638975520912";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "join_flow" DROP COLUMN "joinFormPasswordResetcode"`
    );
    await queryRunner.query(
      `ALTER TABLE "member" DROP COLUMN "passwordResetcode"`
    );
    await queryRunner.query(
      `ALTER TABLE "member_profile" DROP CONSTRAINT "FK_434917136b073ff315d700c9f54"`
    );
    await queryRunner.query(
      `ALTER TABLE "member_profile" ADD CONSTRAINT "UQ_434917136b073ff315d700c9f54" UNIQUE ("memberId")`
    );
    await queryRunner.query(
      `ALTER TABLE "member_profile" ADD CONSTRAINT "FK_434917136b073ff315d700c9f54" FOREIGN KEY ("memberId") REFERENCES "member"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "member_profile" DROP CONSTRAINT "FK_434917136b073ff315d700c9f54"`
    );
    await queryRunner.query(
      `ALTER TABLE "member_profile" DROP CONSTRAINT "UQ_434917136b073ff315d700c9f54"`
    );
    await queryRunner.query(
      `ALTER TABLE "member_profile" ADD CONSTRAINT "FK_434917136b073ff315d700c9f54" FOREIGN KEY ("memberId") REFERENCES "member"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "member" ADD "passwordResetcode" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "join_flow" ADD "joinFormPasswordResetcode" character varying`
    );
  }
}
