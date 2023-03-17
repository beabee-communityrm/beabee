import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveDefaultFormSchema1679064034052
  implements MigrationInterface
{
  name = "RemoveDefaultFormSchema1679064034052";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "callout" ALTER COLUMN "formSchema" DROP DEFAULT`
    );
    await queryRunner.query(
      `UPDATE "callout" SET "formSchema" = '{"components": []}' WHERE "formSchema" = '{}'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "callout" ALTER COLUMN "formSchema" SET DEFAULT '{}'`
    );
  }
}
