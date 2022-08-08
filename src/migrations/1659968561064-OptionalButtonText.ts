import { MigrationInterface, QueryRunner } from "typeorm";

export class OptionalButtonText1659968561064 implements MigrationInterface {
  name = "OptionalButtonText1659968561064";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notice" ALTER COLUMN "buttonText" DROP NOT NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notice" ALTER COLUMN "buttonText" SET NOT NULL`
    );
  }
}
