import { MigrationInterface, QueryRunner } from "typeorm";

export class MigrateJoinFlowOptions1639655491472 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    queryRunner.query(
      "UPDATE option SET key='show-absorb-fee' WHERE key='allow-absorb-fee'"
    );
    queryRunner.query(
      "UPDATE option SET key='show-mail-opt-in' WHERE key='delivery-address-prefill'"
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
