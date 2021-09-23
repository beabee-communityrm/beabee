import { QueryRunner } from "typeorm";

export async function addThenSetNotNull(
  queryRunner: QueryRunner,
  table: string,
  column: string,
  def = ""
) {
  await queryRunner.query(
    `ALTER TABLE "${table}" ADD "${column}" character varying`
  );
  await queryRunner.query(`UPDATE "${table}" SET "${column}"=$1`, [def]);
  await queryRunner.query(
    `ALTER TABLE "${table}" ALTER COLUMN "${column}" SET NOT NULL`
  );
}
