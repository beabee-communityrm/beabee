import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameModels1670242308699 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE member RENAME TO contact");
    await queryRunner.query(
      "ALTER TABLE member_permission RENAME TO contact_role"
    );
    await queryRunner.query(
      "ALTER TABLE member_profile RENAME TO contact_profile"
    );
    await queryRunner.query("ALTER TABLE poll RENAME TO callout");
    await queryRunner.query(
      "ALTER TABLE poll_response RENAME TO callout_response"
    );
    await queryRunner.query(
      "ALTER TABLE project_member RENAME TO project_contact"
    );
    await queryRunner.query(
      "ALTER TABLE segment_member RENAME TO segment_contact"
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE contact RENAME TO member");
    await queryRunner.query(
      "ALTER TABLE contact_role RENAME TO member_permission"
    );
    await queryRunner.query(
      "ALTER TABLE contact_profile RENAME TO member_profile"
    );
    await queryRunner.query("ALTER TABLE callout RENAME TO poll");
    await queryRunner.query(
      "ALTER TABLE callout_response RENAME TO poll_response"
    );
    await queryRunner.query(
      "ALTER TABLE project_contact RENAME TO project_member"
    );
    await queryRunner.query(
      "ALTER TABLE segment_contact RENAME TO segment_member"
    );
  }
}
