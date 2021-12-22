import { MigrationInterface, QueryRunner } from "typeorm";

export class FormatEmailBody1638448727069 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    queryRunner.query(
      `UPDATE email SET body=REPLACE(body, E'\\r\\n', '<br>');`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
