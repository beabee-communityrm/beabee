import { MigrationInterface, QueryRunner } from "typeorm";

export class AddApiKeyModel1685528456765 implements MigrationInterface {
  name = "AddApiKeyModel1685528456765";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "api_key" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "secretHash" character varying NOT NULL, "description" character varying, "creatorId" uuid, CONSTRAINT "PK_b1bd840641b8acbaad89c3d8d11" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `ALTER TABLE "api_key" ADD CONSTRAINT "FK_3e5556043e93d0a1bf59239f9bf" FOREIGN KEY ("creatorId") REFERENCES "contact"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "api_key" DROP CONSTRAINT "FK_3e5556043e93d0a1bf59239f9bf"`
    );
    await queryRunner.query(`DROP TABLE "api_key"`);
  }
}
