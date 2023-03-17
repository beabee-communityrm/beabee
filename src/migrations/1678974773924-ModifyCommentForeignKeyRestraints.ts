import { MigrationInterface, QueryRunner } from "typeorm";

export class ModifyCommentForeignKeyRestraints1678974773924
  implements MigrationInterface
{
  name = "ModifyCommentForeignKeyRestraints1678974773924";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "callout_response_comment" DROP CONSTRAINT "FK_a5eb2766eb7d57c736618edb82c"`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response_comment" DROP CONSTRAINT "FK_1987a197408e5b0af0c69cb373e"`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response_comment" ADD CONSTRAINT "FK_49079a033f285ccfa789aba2efa" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response_comment" ADD CONSTRAINT "FK_81b0d2a988cfd8d34ad7fc3bb68" FOREIGN KEY ("responseId") REFERENCES "callout_response"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "callout_response_comment" DROP CONSTRAINT "FK_81b0d2a988cfd8d34ad7fc3bb68"`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response_comment" DROP CONSTRAINT "FK_49079a033f285ccfa789aba2efa"`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response_comment" ADD CONSTRAINT "FK_1987a197408e5b0af0c69cb373e" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response_comment" ADD CONSTRAINT "FK_a5eb2766eb7d57c736618edb82c" FOREIGN KEY ("responseId") REFERENCES "callout_response"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }
}
