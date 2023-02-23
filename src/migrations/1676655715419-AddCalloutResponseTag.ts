import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCalloutResponseTag1676655715419 implements MigrationInterface {
  name = "AddCalloutResponseTag1676655715419";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "callout_response_tag" ("date" TIMESTAMP NOT NULL DEFAULT now(), "responseId" uuid NOT NULL, "tagId" uuid NOT NULL, CONSTRAINT "PK_77ab6ecb2c6a56ec6d6904f790d" PRIMARY KEY ("responseId", "tagId"))`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response_tag" ADD CONSTRAINT "FK_77210a0adf6d9a5bf80eb56b56a" FOREIGN KEY ("responseId") REFERENCES "callout_response"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response_tag" ADD CONSTRAINT "FK_1b1b51e6fdc38b7dead79300386" FOREIGN KEY ("tagId") REFERENCES "callout_tag"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "callout_response_tag" DROP CONSTRAINT "FK_1b1b51e6fdc38b7dead79300386"`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response_tag" DROP CONSTRAINT "FK_77210a0adf6d9a5bf80eb56b56a"`
    );
    await queryRunner.query(`DROP TABLE "callout_response_tag"`);
  }
}
