import { MigrationInterface, QueryRunner } from "typeorm";

export class OptionalFromEmailFields1656001166095
  implements MigrationInterface
{
  name = "OptionalFromEmailFields1656001166095";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "email" ALTER COLUMN "fromName" DROP NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "email" ALTER COLUMN "fromEmail" DROP NOT NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "email" ALTER COLUMN "fromEmail" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "email" ALTER COLUMN "fromName" SET NOT NULL`
    );
  }
}
