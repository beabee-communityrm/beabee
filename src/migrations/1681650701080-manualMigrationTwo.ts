import { MigrationInterface, QueryRunner } from "typeorm";

export class manualMigrationTwo1681650701080 implements MigrationInterface {
  name = "manualMigrationTwo1681650701080";

  public async up(queryRunner: QueryRunner): Promise<void> {}

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
