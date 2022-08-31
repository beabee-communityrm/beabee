import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateDefaultSegments1650535261889 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "segment" SET "ruleGroup"='{"rules": [{"id": "membershipExpires", "type": "datetime", "field": "membershipExpires", "input": "text", "value": "$now(d:28)", "operator": "less"}, {"id": "contributionType", "type": "string", "field": "contributionType", "input": "select", "value": "GoCardless", "operator": "not_equal"}], "valid": true, "condition": "AND"}' WHERE "id"='ce1b2919-85c1-4134-8231-df6b860c0ae2'`
    );
    await queryRunner.query(
      `UPDATE "segment" SET "ruleGroup"='{"rules": [{"id": "membershipExpires", "type": "datetime", "field": "membershipExpires", "input": "text", "value": ["$now(M:-3)", "$now"], "operator": "between"}], "valid": true, "condition": "AND"}' WHERE "id"='6a233a3b-74f6-4af8-b4cf-e5070a32746a'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
