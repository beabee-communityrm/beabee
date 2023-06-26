import { MigrationInterface, QueryRunner } from "typeorm";

export class ApiKeyDescriptioNotNull1686233847551
  implements MigrationInterface
{
  name = "ApiKeyDescriptioNotNull1686233847551";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "api_key" ALTER COLUMN "description" SET NOT NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "api_key" ALTER COLUMN "description" DROP NOT NULL`
    );
  }
}
