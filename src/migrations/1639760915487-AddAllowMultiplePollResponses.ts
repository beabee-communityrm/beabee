import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAllowMultiplePollResponses1639760915487
  implements MigrationInterface
{
  name = "AddAllowMultiplePollResponses1639760915487";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "poll" ADD "allowMultiple" boolean NOT NULL DEFAULT false`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "poll" DROP COLUMN "allowMultiple"`);
  }
}
