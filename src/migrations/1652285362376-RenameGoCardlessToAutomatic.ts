import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameGoCardlessToAutomatic1652285362376
  implements MigrationInterface
{
  name = "RenameGoCardlessToAutomatic1652285362376";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE member SET "contributionType"='Automatic' WHERE "contributionType"='GoCardless'`
    );
    await queryRunner.query(
      `UPDATE "segment" SET "ruleGroup"=REPLACE("ruleGroup"::text, '"value": "GoCardless"', '"value": "Automatic"')::jsonb WHERE "ruleGroup"::text LIKE '%"value": "GoCardless"%'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "segment" SET "ruleGroup"=REPLACE("ruleGroup"::text, '"value": "Automatic"', '"value": "GoCardless"')::jsonb WHERE "ruleGroup"::text LIKE '%"value": "Automatic"%'`
    );
    await queryRunner.query(
      `UPDATE member SET "contributionType"='GoCardless' WHERE "contributionType"='Automatic'`
    );
  }
}
