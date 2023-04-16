import { MigrationInterface, QueryRunner } from "typeorm";

export class AddApiKeys1681638985427 implements MigrationInterface {
  name = "AddApiKeys1681638985427";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "user" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "joined" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "api_user" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "joined" TIMESTAMP NOT NULL DEFAULT now(), "creatorId" uuid, "apiKeyId" character varying NOT NULL, "apiKeySecrethash" character varying NOT NULL, CONSTRAINT "PK_8eb953e69be312b10c2d8e060c4" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "user_role" ("type" character varying NOT NULL, "dateAdded" TIMESTAMP NOT NULL DEFAULT now(), "dateExpires" TIMESTAMP, "userId" uuid NOT NULL, CONSTRAINT "PK_103ec7e34dba94d88e1d84becad" PRIMARY KEY ("type", "userId"))`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response_comment" DROP CONSTRAINT "FK_49079a033f285ccfa789aba2efa"`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response_comment" DROP CONSTRAINT "FK_81b0d2a988cfd8d34ad7fc3bb68"`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response_comment" ALTER COLUMN "contactId" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response_comment" ALTER COLUMN "responseId" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "api_user" ADD CONSTRAINT "FK_ffa754cdda66921faf1171cf0ab" FOREIGN KEY ("creatorId") REFERENCES "contact"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response_comment" ADD CONSTRAINT "FK_49079a033f285ccfa789aba2efa" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response_comment" ADD CONSTRAINT "FK_81b0d2a988cfd8d34ad7fc3bb68" FOREIGN KEY ("responseId") REFERENCES "callout_response"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "user_role" ADD CONSTRAINT "FK_ab40a6f0cd7d3ebfcce082131fd" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_role" DROP CONSTRAINT "FK_ab40a6f0cd7d3ebfcce082131fd"`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response_comment" DROP CONSTRAINT "FK_81b0d2a988cfd8d34ad7fc3bb68"`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response_comment" DROP CONSTRAINT "FK_49079a033f285ccfa789aba2efa"`
    );
    await queryRunner.query(
      `ALTER TABLE "api_user" DROP CONSTRAINT "FK_ffa754cdda66921faf1171cf0ab"`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response_comment" ALTER COLUMN "responseId" DROP NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response_comment" ALTER COLUMN "contactId" DROP NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response_comment" ADD CONSTRAINT "FK_81b0d2a988cfd8d34ad7fc3bb68" FOREIGN KEY ("responseId") REFERENCES "callout_response"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response_comment" ADD CONSTRAINT "FK_49079a033f285ccfa789aba2efa" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(`DROP TABLE "user_role"`);
    await queryRunner.query(`DROP TABLE "api_user"`);
    await queryRunner.query(`DROP TABLE "user"`);
  }
}
