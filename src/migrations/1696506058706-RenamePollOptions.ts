import { MigrationInterface, QueryRunner } from "typeorm";

export class RenamePollOptions1696506058706 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "option" SET "key"='join-survey' WHERE "key"='join-poll'`
    );
    await queryRunner.query(
      `UPDATE "option" SET "key"='cancellation-survey' WHERE "key"='cancellation-poll'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "option" SET "key"='join-poll' WHERE "key"='join-survey'`
    );
    await queryRunner.query(
      `UPDATE "option" SET "key"='cancellation-poll' WHERE "key"='cancellation-survey'`
    );
  }
}
