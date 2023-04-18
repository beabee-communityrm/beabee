import { MigrationInterface, QueryRunner } from "typeorm";

export class addApiKeys1681653362007 implements MigrationInterface {
  name = "addApiKeys1681653362007";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_role" DROP CONSTRAINT "FK_5ccff67a6e15b6e2f4287223759"`
    );
    await queryRunner.query(
      `ALTER TABLE "user_role" RENAME COLUMN "appUserId" TO "userId"`
    );
    await queryRunner.query(
      `ALTER TABLE "user_role" RENAME CONSTRAINT "PK_f790158c4ace57261b908100653" TO "PK_103ec7e34dba94d88e1d84becad"`
    );
    await queryRunner.query(
      `ALTER TABLE "app_user" ALTER COLUMN "email" DROP NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "app_user" ALTER COLUMN "firstname" DROP NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "app_user" ALTER COLUMN "lastname" DROP NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "app_user" ALTER COLUMN "contributionType" DROP NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "app_user" ALTER COLUMN "type" DROP DEFAULT`
    );
    await queryRunner.query(
      `ALTER TABLE "app_user" ALTER COLUMN "passwordHash" DROP NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "app_user" ALTER COLUMN "passwordSalt" DROP NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "app_user" ALTER COLUMN "passwordIterations" DROP NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "app_user" ALTER COLUMN "passwordTries" DROP NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "app_user" ALTER COLUMN "otpActivated" DROP NOT NULL`
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
      `ALTER TABLE "app_user" ADD CONSTRAINT "FK_bd474c6e356a20346b749617a10" FOREIGN KEY ("creatorId") REFERENCES "app_user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response_comment" ADD CONSTRAINT "FK_49079a033f285ccfa789aba2efa" FOREIGN KEY ("contactId") REFERENCES "app_user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response_comment" ADD CONSTRAINT "FK_81b0d2a988cfd8d34ad7fc3bb68" FOREIGN KEY ("responseId") REFERENCES "callout_response"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "user_role" ADD CONSTRAINT "FK_ab40a6f0cd7d3ebfcce082131fd" FOREIGN KEY ("userId") REFERENCES "app_user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
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
      `ALTER TABLE "app_user" DROP CONSTRAINT "FK_bd474c6e356a20346b749617a10"`
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
      `ALTER TABLE "callout_response_comment" ADD CONSTRAINT "FK_49079a033f285ccfa789aba2efa" FOREIGN KEY ("contactId") REFERENCES "app_user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "app_user" ALTER COLUMN "otpActivated" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "app_user" ALTER COLUMN "passwordTries" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "app_user" ALTER COLUMN "passwordIterations" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "app_user" ALTER COLUMN "passwordSalt" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "app_user" ALTER COLUMN "passwordHash" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "app_user" ALTER COLUMN "type" SET DEFAULT 'contact'`
    );
    await queryRunner.query(
      `ALTER TABLE "app_user" ALTER COLUMN "contributionType" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "app_user" ALTER COLUMN "lastname" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "app_user" ALTER COLUMN "firstname" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "app_user" ALTER COLUMN "email" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "user_role" RENAME CONSTRAINT "PK_103ec7e34dba94d88e1d84becad" TO "PK_f790158c4ace57261b908100653"`
    );
    await queryRunner.query(
      `ALTER TABLE "user_role" RENAME COLUMN "userId" TO "appUserId"`
    );
    await queryRunner.query(
      `ALTER TABLE "user_role" ADD CONSTRAINT "FK_5ccff67a6e15b6e2f4287223759" FOREIGN KEY ("appUserId") REFERENCES "app_user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }
}
