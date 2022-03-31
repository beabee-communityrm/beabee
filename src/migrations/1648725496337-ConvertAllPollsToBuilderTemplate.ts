import { MigrationInterface, QueryRunner } from "typeorm";

export class ConvertAllPollsToBuilderTemplate1648725496337
  implements MigrationInterface
{
  name = "ConvertAllPollsToBuilderTemplate1648725496337";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "poll" DROP COLUMN "template"`);
    await queryRunner.query(`ALTER TABLE "poll" ADD "intro" character varying`);
    await queryRunner.query(
      `ALTER TABLE "poll" ADD "thanksTitle" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "poll" ADD "thanksText" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "poll" ADD "thanksRedirect" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "poll" ADD "formSchema" jsonb NOT NULL DEFAULT '{}'`
    );

    // Extract all the values out of templateSchema into their own columns
    await queryRunner.query(`
      UPDATE "poll" SET
        "intro" = COALESCE("templateSchema"->>'intro', ''),
        "thanksTitle" = COALESCE("templateSchema"->>'thanksTitle', ''),
        "thanksText" = COALESCE("templateSchema"->>'thanksText', ''),
        "thanksRedirect" = "templateSchema"->>'thanksRedirect',
        "formSchema" = COALESCE("templateSchema"->>'formSchema', '{}')::jsonb
    `);

    await queryRunner.query(
      `ALTER TABLE "poll" ALTER COLUMN "intro" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "poll" ALTER COLUMN "thanksTitle" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "poll" ALTER COLUMN "thanksText" SET NOT NULL`
    );
    await queryRunner.query(`ALTER TABLE "poll" DROP COLUMN "templateSchema"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "poll" DROP COLUMN "formSchema"`);
    await queryRunner.query(`ALTER TABLE "poll" DROP COLUMN "thanksRedirect"`);
    await queryRunner.query(`ALTER TABLE "poll" DROP COLUMN "thanksText"`);
    await queryRunner.query(`ALTER TABLE "poll" DROP COLUMN "thanksTitle"`);
    await queryRunner.query(`ALTER TABLE "poll" DROP COLUMN "intro"`);
    await queryRunner.query(
      `ALTER TABLE "poll" ADD "templateSchema" jsonb NOT NULL DEFAULT '{}'`
    );
    await queryRunner.query(
      `ALTER TABLE "poll" ADD "template" character varying NOT NULL`
    );
  }
}
