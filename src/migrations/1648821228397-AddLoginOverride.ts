import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLoginOverride1648821228397 implements MigrationInterface {
  name = "AddLoginOverride1648821228397";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "login_override_flow" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "date" TIMESTAMP NOT NULL DEFAULT now(), "memberId" uuid, CONSTRAINT "PK_219c6147cb12d8b530a441bc312" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `ALTER TABLE "login_override_flow" ADD CONSTRAINT "FK_c614df1876e40619c299eb08e52" FOREIGN KEY ("memberId") REFERENCES "member"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "login_override_flow" DROP CONSTRAINT "FK_c614df1876e40619c299eb08e52"`
    );
    await queryRunner.query(`DROP TABLE "login_override_flow"`);
  }
}
