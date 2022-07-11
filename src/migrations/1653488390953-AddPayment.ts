import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPayment1653488390953 implements MigrationInterface {
  name = "AddPayment1653488390953";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "payment" ("id" character varying NOT NULL, "subscriptionId" character varying, "status" character varying NOT NULL, "description" character varying NOT NULL, "amount" real NOT NULL, "amountRefunded" real, "chargeDate" date NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "memberId" uuid, CONSTRAINT "PK_fcaec7df5adf9cac408c686b2ab" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `ALTER TABLE "payment" ADD CONSTRAINT "FK_89ce346f102c90b97ee97a94d75" FOREIGN KEY ("memberId") REFERENCES "member"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payment" DROP CONSTRAINT "FK_89ce346f102c90b97ee97a94d75"`
    );
    await queryRunner.query(`DROP TABLE "payment"`);
  }
}
