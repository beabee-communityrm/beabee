import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameModelReferences1670257047310 implements MigrationInterface {
  name = "RenameModelReferences1670257047310";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "callout_response" RENAME COLUMN "memberId" TO "contactId"`
    );
    await queryRunner.query(
      `ALTER TABLE "contact_profile" RENAME COLUMN "memberId" TO "contactId"`
    );
    await queryRunner.query(
      `ALTER TABLE "payment" RENAME COLUMN "memberId" TO "contactId"`
    );
    await queryRunner.query(
      `ALTER TABLE "payment_data" RENAME COLUMN "memberId" TO "contactId"`
    );
    await queryRunner.query(
      `ALTER TABLE "project_contact" RENAME COLUMN "memberId" TO "contactId"`
    );
    await queryRunner.query(
      `ALTER TABLE "reset_password_flow" RENAME COLUMN "memberId" TO "contactId"`
    );
    await queryRunner.query(
      `ALTER TABLE "segment_contact" RENAME COLUMN "memberId" TO "contactId"`
    );
    await queryRunner.query(
      `ALTER TABLE "contact_role" RENAME COLUMN "permission" TO "type"`
    );
    await queryRunner.query(
      `ALTER TABLE "contact_role" RENAME COLUMN "memberId" TO "contactId"`
    );
    await queryRunner.query(
      `ALTER TABLE "project_engagement" RENAME COLUMN "byMemberId" to "byContactId"`
    );
    await queryRunner.query(
      `ALTER TABLE "project_engagement" RENAME COLUMN "toMemberId" to "toContactId"`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "callout_response" RENAME COLUMN "contactId" TO "memberId"`
    );
    await queryRunner.query(
      `ALTER TABLE "contact_profile" RENAME COLUMN "contactId" TO "memberId"`
    );
    await queryRunner.query(
      `ALTER TABLE "payment" RENAME COLUMN "contactId" TO "memberId"`
    );
    await queryRunner.query(
      `ALTER TABLE "payment_data" RENAME COLUMN "contactId" TO "memberId"`
    );
    await queryRunner.query(
      `ALTER TABLE "project_contact" RENAME COLUMN "contactId" TO "memberId"`
    );
    await queryRunner.query(
      `ALTER TABLE "reset_password_flow" RENAME COLUMN "contactId" TO "memberId"`
    );
    await queryRunner.query(
      `ALTER TABLE "segment_contact" RENAME COLUMN "contactId" TO "memberId"`
    );
    await queryRunner.query(
      `ALTER TABLE "contact_role" RENAME COLUMN "type" TO "permission"`
    );
    await queryRunner.query(
      `ALTER TABLE "contact_role" RENAME COLUMN "contactId" TO "memberId"`
    );
    await queryRunner.query(
      `ALTER TABLE "project_engagement" RENAME COLUMN "byContactId" to "byMemberId"`
    );
    await queryRunner.query(
      `ALTER TABLE "project_engagement" RENAME COLUMN "toContactId" to "toMemberId"`
    );
  }
}
