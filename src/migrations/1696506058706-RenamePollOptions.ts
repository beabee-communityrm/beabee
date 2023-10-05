import { MigrationInterface, QueryRunner } from "typeorm";

export class RenamePollOptions1696506058706 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    queryRunner.query(
      `UPDATE "option" SET "key"='join-survey' WHERE "key"='join-poll'`
    );
    queryRunner.query(
      `UPDATE "option" SET "key"='cancellation-survey' WHERE "key"='cancellation-poll'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    queryRunner.query(
      `UPDATE "option" SET "key"='join-poll' WHERE "key"='join-survey'`
    );
    queryRunner.query(
      `UPDATE "option" SET "key"='cancellation-poll' WHERE "key"='cancellation-survey'`
    );
  }
}
