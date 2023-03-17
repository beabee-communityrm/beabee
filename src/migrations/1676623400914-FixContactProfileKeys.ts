import { MigrationInterface, QueryRunner } from "typeorm";

export class FixContactProfileKeys1676623400914 implements MigrationInterface {
  name = "FixContactProfileKeys1676623400914";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "contact_profile" DROP CONSTRAINT "FK_f926258b8d2aa36053b4488d3a3"`
    );
    await queryRunner.query(
      `ALTER TABLE "contact_profile" ADD CONSTRAINT "UQ_f926258b8d2aa36053b4488d3a3" UNIQUE ("contactId")`
    );
    await queryRunner.query(
      `ALTER TABLE "contact_profile" ADD CONSTRAINT "FK_f926258b8d2aa36053b4488d3a3" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "contact_profile" DROP CONSTRAINT "FK_f926258b8d2aa36053b4488d3a3"`
    );
    await queryRunner.query(
      `ALTER TABLE "contact_profile" DROP CONSTRAINT "UQ_f926258b8d2aa36053b4488d3a3"`
    );
    await queryRunner.query(
      `ALTER TABLE "contact_profile" ADD CONSTRAINT "FK_f926258b8d2aa36053b4488d3a3" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }
}
