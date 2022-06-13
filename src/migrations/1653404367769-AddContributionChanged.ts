import { MigrationInterface, QueryRunner } from "typeorm";

export class AddContributionChanged1653404367769 implements MigrationInterface {
  name = "AddContributionChanged1653404367769";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "member" ADD "contributionChanged" TIMESTAMP`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "member" DROP COLUMN "contributionChanged"`
    );
  }
}
