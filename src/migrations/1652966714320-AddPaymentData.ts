import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPaymentData1652966714320 implements MigrationInterface {
  name = "AddPaymentData1652966714320";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "payment_data" ("method" character varying, "data" jsonb NOT NULL DEFAULT '{}', "memberId" uuid NOT NULL, CONSTRAINT "REL_a1bac83e58a79755d70afd2a59" UNIQUE ("memberId"), CONSTRAINT "PK_a1bac83e58a79755d70afd2a598" PRIMARY KEY ("memberId"))`
    );
    await queryRunner.query(
      `ALTER TABLE "payment_data" ADD CONSTRAINT "FK_a1bac83e58a79755d70afd2a598" FOREIGN KEY ("memberId") REFERENCES "member"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payment_data" DROP CONSTRAINT "FK_a1bac83e58a79755d70afd2a598"`
    );
    await queryRunner.query(`DROP TABLE "payment_data"`);
  }
}
