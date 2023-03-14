import { MigrationInterface, QueryRunner } from "typeorm";

type RuleOperator = string;
type RuleValue = string | number | boolean;

interface Rule {
  field: string;
  operator: RuleOperator;
  value: RuleValue | RuleValue[];
}

interface RuleGroup {
  condition: "AND" | "OR";
  rules: (Rule | RuleGroup)[];
}

interface Segment {
  [k: string]: unknown;
  id: string;
  ruleGroup: RuleGroup;
}

// Removes any extra properties on the group
function updateRuleValues(group: RuleGroup): RuleGroup {
  return {
    ...group,
    rules: group.rules.map((rule) =>
      "condition" in rule
        ? updateRuleValues(rule)
        : {
            ...rule,
            value: Array.isArray(rule.value) ? rule.value : [rule.value]
          }
    )
  };
}

export class UpdateRuleValues1667846310950 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const segments: Segment[] = await queryRunner.query(
      'SELECT * FROM "segment"'
    );

    for (const segment of segments) {
      const newRuleGroup = updateRuleValues(segment.ruleGroup);
      await queryRunner.query(
        'UPDATE "segment" SET "ruleGroup" = $1 WHERE "id" = $2',
        [JSON.stringify(newRuleGroup), segment.id]
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
