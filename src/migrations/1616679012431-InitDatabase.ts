import {MigrationInterface, QueryRunner} from "typeorm";

export class InitDatabase1616679012431 implements MigrationInterface {
    name = 'InitDatabase1616679012431'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "email" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "date" TIMESTAMP NOT NULL DEFAULT now(), "name" character varying NOT NULL, "fromName" character varying NOT NULL, "fromEmail" character varying NOT NULL, "subject" character varying NOT NULL, "body" text NOT NULL, CONSTRAINT "PK_1e7ed8734ee054ef18002e29b1c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "email_mailing" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdDate" TIMESTAMP NOT NULL DEFAULT now(), "sentDate" TIMESTAMP, "recipients" jsonb NOT NULL, "emailField" character varying, "nameField" character varying, "mergeFields" json, "emailId" uuid, CONSTRAINT "PK_5350d975601f9741fe91cd2d46f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "export" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" character varying NOT NULL, "description" text NOT NULL, "date" TIMESTAMP NOT NULL DEFAULT now(), "params" jsonb, CONSTRAINT "PK_93dd4c52436ed0da6263e24b3c7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "export_item" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "itemId" character varying NOT NULL, "status" character varying NOT NULL, "exportId" uuid, CONSTRAINT "PK_8e2ad3ed7875156466aa79c1367" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_b5152e07fe3321acd931df5783" ON "export_item" ("exportId", "itemId") `);
        await queryRunner.query(`CREATE TABLE "gc_payment" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "status" character varying NOT NULL, "description" character varying NOT NULL, "amount" real NOT NULL, "amountRefunded" real, "chargeDate" date NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "paymentId" character varying NOT NULL, "subscriptionId" character varying, "subscriptionPeriod" character varying, "memberId" uuid, CONSTRAINT "UQ_ed6cbc101e1b7eb5540ce489c23" UNIQUE ("paymentId"), CONSTRAINT "PK_2f3afc811c70a8436dd906d97f8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "gc_payment_data" ("customerId" character varying, "mandateId" character varying, "subscriptionId" character varying, "cancelledAt" TIMESTAMP, "payFee" boolean, "memberId" uuid NOT NULL, CONSTRAINT "PK_f680cde41cda01033400f738690" PRIMARY KEY ("memberId"))`);
        await queryRunner.query(`CREATE TABLE "gift_flow" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "date" TIMESTAMP NOT NULL DEFAULT now(), "sessionId" character varying NOT NULL, "setupCode" character varying NOT NULL, "completed" boolean NOT NULL DEFAULT false, "processed" boolean NOT NULL DEFAULT false, "gifteeId" uuid, "giftFormFirstname" character varying NOT NULL, "giftFormLastname" character varying NOT NULL, "giftFormEmail" character varying NOT NULL, "giftFormStartdate" date NOT NULL, "giftFormMessage" character varying, "giftFormFromname" character varying NOT NULL, "giftFormFromemail" character varying NOT NULL, "giftFormMonths" integer NOT NULL, "giftFormGiftaddress" jsonb, "giftFormDeliveryaddress" jsonb, CONSTRAINT "UQ_7937ef06d009fce25e5ce4d732c" UNIQUE ("setupCode"), CONSTRAINT "PK_362be23dc8e00b0ea671b3ec982" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "join_flow" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "date" TIMESTAMP NOT NULL DEFAULT now(), "redirectFlowId" character varying NOT NULL, "sessionToken" character varying NOT NULL, "joinFormAmount" integer NOT NULL, "joinFormPeriod" character varying NOT NULL, "joinFormPayfee" boolean NOT NULL, "joinFormProrate" boolean NOT NULL DEFAULT false, "joinFormReferralcode" character varying, "joinFormReferralgift" character varying, "joinFormReferralgiftoptions" jsonb, CONSTRAINT "PK_b3d4ac7f2d17f2125146de30c57" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "manual_payment_data" ("source" character varying NOT NULL, "reference" character varying NOT NULL, "memberId" uuid NOT NULL, CONSTRAINT "PK_39b204a718350c013d443ad7038" PRIMARY KEY ("memberId"))`);
        await queryRunner.query(`CREATE TABLE "member" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "firstname" character varying NOT NULL, "lastname" character varying NOT NULL, "joined" TIMESTAMP NOT NULL DEFAULT now(), "lastSeen" TIMESTAMP, "loginOverride" jsonb, "contributionType" character varying NOT NULL, "contributionPeriod" character varying, "contributionMonthlyAmount" real, "nextContributionMonthlyAmount" real, "referralCode" character varying NOT NULL, "pollsCode" character varying NOT NULL, "passwordHash" character varying NOT NULL, "passwordSalt" character varying NOT NULL, "passwordIterations" integer NOT NULL DEFAULT '1000', "passwordTries" integer NOT NULL DEFAULT '0', "passwordResetcode" character varying, "otpKey" character varying, "otpActivated" boolean NOT NULL DEFAULT false, CONSTRAINT "UQ_4678079964ab375b2b31849456c" UNIQUE ("email"), CONSTRAINT "UQ_7246a7def11f69cab04ebf476bb" UNIQUE ("referralCode"), CONSTRAINT "UQ_728d51b033f037e35d99c6b1952" UNIQUE ("pollsCode"), CONSTRAINT "PK_97cbbe986ce9d14ca5894fdc072" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "member_permission" ("permission" character varying NOT NULL, "dateAdded" TIMESTAMP NOT NULL DEFAULT now(), "dateExpires" TIMESTAMP, "memberId" uuid NOT NULL, CONSTRAINT "PK_f790158c4ace57261b908100653" PRIMARY KEY ("permission", "memberId"))`);
        await queryRunner.query(`CREATE TABLE "member_profile" ("description" character varying NOT NULL DEFAULT '', "bio" text NOT NULL DEFAULT '', "notes" text NOT NULL DEFAULT '', "telephone" character varying NOT NULL DEFAULT '', "twitter" character varying NOT NULL DEFAULT '', "preferredContact" character varying NOT NULL DEFAULT '', "deliveryOptIn" boolean NOT NULL, "deliveryAddress" jsonb, "tags" jsonb NOT NULL DEFAULT '[]', "memberId" uuid NOT NULL, CONSTRAINT "REL_434917136b073ff315d700c9f5" UNIQUE ("memberId"), CONSTRAINT "PK_434917136b073ff315d700c9f54" PRIMARY KEY ("memberId"))`);
        await queryRunner.query(`CREATE TABLE "notice" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "name" character varying NOT NULL, "expires" TIMESTAMP, "enabled" boolean NOT NULL, "text" character varying NOT NULL, "url" character varying, CONSTRAINT "PK_705062b14410ff1a04998f86d72" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "option" ("key" character varying NOT NULL, "value" character varying NOT NULL, CONSTRAINT "PK_e19ad52a146d46abb337f4346f9" PRIMARY KEY ("key"))`);
        await queryRunner.query(`CREATE TABLE "page_settings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "pattern" character varying NOT NULL, "shareUrl" character varying NOT NULL, "shareTitle" character varying NOT NULL, "shareDescription" character varying NOT NULL, "shareImage" character varying NOT NULL, CONSTRAINT "PK_fbb1ad2f481b3b8e438e5ba2bab" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "poll_response" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "guestName" character varying, "guestEmail" character varying, "answers" jsonb NOT NULL, "isPartial" boolean NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "pollSlug" character varying, "memberId" uuid, CONSTRAINT "PK_8c38ebcebc5ce52ce67906b6a2c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "poll" ("slug" character varying NOT NULL, "date" TIMESTAMP NOT NULL DEFAULT now(), "template" character varying NOT NULL, "templateSchema" jsonb NOT NULL DEFAULT '{}', "title" character varying NOT NULL, "mcMergeField" character varying, "pollMergeField" character varying, "closed" boolean NOT NULL DEFAULT true, "starts" TIMESTAMP, "expires" TIMESTAMP, "allowUpdate" boolean NOT NULL, "access" character varying NOT NULL DEFAULT 'member', "hidden" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_37691db8708a2a24cfd6bb21cf3" PRIMARY KEY ("slug"))`);
        await queryRunner.query(`CREATE TABLE "project" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "date" TIMESTAMP NOT NULL DEFAULT now(), "title" character varying NOT NULL, "description" character varying NOT NULL, "status" character varying NOT NULL, "groupName" character varying, "ownerId" uuid, CONSTRAINT "PK_4d68b1358bb5b766d3e78f32f57" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "project_engagement" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "date" TIMESTAMP NOT NULL DEFAULT now(), "type" character varying NOT NULL, "notes" character varying, "projectId" uuid, "byMemberId" uuid, "toMemberId" uuid, CONSTRAINT "PK_000f5f84fcd8f812e5ad2611ee9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "project_member" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tag" character varying, "projectId" uuid, "memberId" uuid, CONSTRAINT "UQ_00377b377c3f444dc856481ae0a" UNIQUE ("projectId", "memberId"), CONSTRAINT "PK_64dba8e9dcf96ce383cfd19d6fb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "referral_gift" ("name" character varying NOT NULL, "label" character varying NOT NULL, "description" character varying NOT NULL, "minAmount" integer NOT NULL, "enabled" boolean NOT NULL DEFAULT false, "options" jsonb NOT NULL DEFAULT '[]', "stock" jsonb NOT NULL DEFAULT '[]', CONSTRAINT "PK_dc4edb7daebc5d18db16b3cd6d1" PRIMARY KEY ("name"))`);
        await queryRunner.query(`CREATE TABLE "referral" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "date" TIMESTAMP NOT NULL DEFAULT now(), "refereeAmount" integer NOT NULL, "refereeGiftOptions" jsonb, "referrerGiftOptions" jsonb, "referrerHasSelected" boolean NOT NULL DEFAULT false, "referrerId" uuid, "refereeId" uuid, "refereeGiftName" character varying, "referrerGiftName" character varying, CONSTRAINT "PK_a2d3e935a6591168066defec5ad" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "restart_flow" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "date" TIMESTAMP NOT NULL DEFAULT now(), "customerId" character varying NOT NULL, "mandateId" character varying NOT NULL, "memberId" uuid, "joinFormAmount" integer NOT NULL, "joinFormPeriod" character varying NOT NULL, "joinFormPayfee" boolean NOT NULL, "joinFormProrate" boolean NOT NULL DEFAULT false, "joinFormReferralcode" character varying, "joinFormReferralgift" character varying, "joinFormReferralgiftoptions" jsonb, CONSTRAINT "PK_02b0274119e907f61b5bf6faaf4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "segment" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" character varying NOT NULL DEFAULT '', "ruleGroup" jsonb NOT NULL, CONSTRAINT "PK_d648ac58d8e0532689dfb8ad7ef" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "segment_member" ("date" TIMESTAMP NOT NULL DEFAULT now(), "segmentId" uuid NOT NULL, "memberId" uuid NOT NULL, CONSTRAINT "PK_77acc05e2833e4f743b2702c5ec" PRIMARY KEY ("segmentId", "memberId"))`);
        await queryRunner.query(`CREATE TABLE "segment_ongoing_email" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "date" TIMESTAMP NOT NULL DEFAULT now(), "trigger" character varying NOT NULL, "emailTemplateId" character varying NOT NULL, "enabled" boolean NOT NULL DEFAULT false, "segmentId" uuid, CONSTRAINT "PK_f85f7b5d3ffe95663c9a76e2567" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "email_mailing" ADD CONSTRAINT "FK_d84a796de936f37086075c8cc0a" FOREIGN KEY ("emailId") REFERENCES "email"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "export_item" ADD CONSTRAINT "FK_5b7cd3804057bcd15f4ae4a751f" FOREIGN KEY ("exportId") REFERENCES "export"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "gc_payment" ADD CONSTRAINT "FK_78369afed75e267da010afeb3d6" FOREIGN KEY ("memberId") REFERENCES "member"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "gc_payment_data" ADD CONSTRAINT "FK_f680cde41cda01033400f738690" FOREIGN KEY ("memberId") REFERENCES "member"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "gift_flow" ADD CONSTRAINT "FK_70cda2b5d560765e318bf3995b0" FOREIGN KEY ("gifteeId") REFERENCES "member"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "manual_payment_data" ADD CONSTRAINT "FK_39b204a718350c013d443ad7038" FOREIGN KEY ("memberId") REFERENCES "member"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "member_permission" ADD CONSTRAINT "FK_d967d4e0dfefc0cad0a355dfcd8" FOREIGN KEY ("memberId") REFERENCES "member"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "member_profile" ADD CONSTRAINT "FK_434917136b073ff315d700c9f54" FOREIGN KEY ("memberId") REFERENCES "member"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "poll_response" ADD CONSTRAINT "FK_1f9d3a0865ea1e7da7d0ed14ffc" FOREIGN KEY ("pollSlug") REFERENCES "poll"("slug") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "poll_response" ADD CONSTRAINT "FK_29b205fb3a80ff9504564018963" FOREIGN KEY ("memberId") REFERENCES "member"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "project" ADD CONSTRAINT "FK_9884b2ee80eb70b7db4f12e8aed" FOREIGN KEY ("ownerId") REFERENCES "member"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "project_engagement" ADD CONSTRAINT "FK_39981c5a5237f7b2003a6d979b4" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "project_engagement" ADD CONSTRAINT "FK_ef398051d223043e08eb22cf741" FOREIGN KEY ("byMemberId") REFERENCES "member"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "project_engagement" ADD CONSTRAINT "FK_2f1cee3582cac4576fa7fa2c97f" FOREIGN KEY ("toMemberId") REFERENCES "member"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "project_member" ADD CONSTRAINT "FK_7115f82a61e31ac95b2681d83e4" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "project_member" ADD CONSTRAINT "FK_6cc942d4e3bde3e3d22c4304267" FOREIGN KEY ("memberId") REFERENCES "member"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "referral" ADD CONSTRAINT "FK_ec295d220eaab068ed5147e8582" FOREIGN KEY ("referrerId") REFERENCES "member"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "referral" ADD CONSTRAINT "FK_91b466a38c1ba22e058a405bbc2" FOREIGN KEY ("refereeId") REFERENCES "member"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "referral" ADD CONSTRAINT "FK_599d77e22e1abaa26d37319cfd2" FOREIGN KEY ("refereeGiftName") REFERENCES "referral_gift"("name") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "referral" ADD CONSTRAINT "FK_ac8644958a9beed80d41916ab19" FOREIGN KEY ("referrerGiftName") REFERENCES "referral_gift"("name") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "restart_flow" ADD CONSTRAINT "FK_3795887708c5278fe85a1aba64b" FOREIGN KEY ("memberId") REFERENCES "member"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "segment_member" ADD CONSTRAINT "FK_1cbab977bf0e854b9290d76b2b3" FOREIGN KEY ("segmentId") REFERENCES "segment"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "segment_member" ADD CONSTRAINT "FK_44b23cd35745b0b9c6da7e1840a" FOREIGN KEY ("memberId") REFERENCES "member"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "segment_ongoing_email" ADD CONSTRAINT "FK_d9725a78330e4f18d3cd55cdf09" FOREIGN KEY ("segmentId") REFERENCES "segment"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "segment_ongoing_email" DROP CONSTRAINT "FK_d9725a78330e4f18d3cd55cdf09"`);
        await queryRunner.query(`ALTER TABLE "segment_member" DROP CONSTRAINT "FK_44b23cd35745b0b9c6da7e1840a"`);
        await queryRunner.query(`ALTER TABLE "segment_member" DROP CONSTRAINT "FK_1cbab977bf0e854b9290d76b2b3"`);
        await queryRunner.query(`ALTER TABLE "restart_flow" DROP CONSTRAINT "FK_3795887708c5278fe85a1aba64b"`);
        await queryRunner.query(`ALTER TABLE "referral" DROP CONSTRAINT "FK_ac8644958a9beed80d41916ab19"`);
        await queryRunner.query(`ALTER TABLE "referral" DROP CONSTRAINT "FK_599d77e22e1abaa26d37319cfd2"`);
        await queryRunner.query(`ALTER TABLE "referral" DROP CONSTRAINT "FK_91b466a38c1ba22e058a405bbc2"`);
        await queryRunner.query(`ALTER TABLE "referral" DROP CONSTRAINT "FK_ec295d220eaab068ed5147e8582"`);
        await queryRunner.query(`ALTER TABLE "project_member" DROP CONSTRAINT "FK_6cc942d4e3bde3e3d22c4304267"`);
        await queryRunner.query(`ALTER TABLE "project_member" DROP CONSTRAINT "FK_7115f82a61e31ac95b2681d83e4"`);
        await queryRunner.query(`ALTER TABLE "project_engagement" DROP CONSTRAINT "FK_2f1cee3582cac4576fa7fa2c97f"`);
        await queryRunner.query(`ALTER TABLE "project_engagement" DROP CONSTRAINT "FK_ef398051d223043e08eb22cf741"`);
        await queryRunner.query(`ALTER TABLE "project_engagement" DROP CONSTRAINT "FK_39981c5a5237f7b2003a6d979b4"`);
        await queryRunner.query(`ALTER TABLE "project" DROP CONSTRAINT "FK_9884b2ee80eb70b7db4f12e8aed"`);
        await queryRunner.query(`ALTER TABLE "poll_response" DROP CONSTRAINT "FK_29b205fb3a80ff9504564018963"`);
        await queryRunner.query(`ALTER TABLE "poll_response" DROP CONSTRAINT "FK_1f9d3a0865ea1e7da7d0ed14ffc"`);
        await queryRunner.query(`ALTER TABLE "member_profile" DROP CONSTRAINT "FK_434917136b073ff315d700c9f54"`);
        await queryRunner.query(`ALTER TABLE "member_permission" DROP CONSTRAINT "FK_d967d4e0dfefc0cad0a355dfcd8"`);
        await queryRunner.query(`ALTER TABLE "manual_payment_data" DROP CONSTRAINT "FK_39b204a718350c013d443ad7038"`);
        await queryRunner.query(`ALTER TABLE "gift_flow" DROP CONSTRAINT "FK_70cda2b5d560765e318bf3995b0"`);
        await queryRunner.query(`ALTER TABLE "gc_payment_data" DROP CONSTRAINT "FK_f680cde41cda01033400f738690"`);
        await queryRunner.query(`ALTER TABLE "gc_payment" DROP CONSTRAINT "FK_78369afed75e267da010afeb3d6"`);
        await queryRunner.query(`ALTER TABLE "export_item" DROP CONSTRAINT "FK_5b7cd3804057bcd15f4ae4a751f"`);
        await queryRunner.query(`ALTER TABLE "email_mailing" DROP CONSTRAINT "FK_d84a796de936f37086075c8cc0a"`);
        await queryRunner.query(`DROP TABLE "segment_ongoing_email"`);
        await queryRunner.query(`DROP TABLE "segment_member"`);
        await queryRunner.query(`DROP TABLE "segment"`);
        await queryRunner.query(`DROP TABLE "restart_flow"`);
        await queryRunner.query(`DROP TABLE "referral"`);
        await queryRunner.query(`DROP TABLE "referral_gift"`);
        await queryRunner.query(`DROP TABLE "project_member"`);
        await queryRunner.query(`DROP TABLE "project_engagement"`);
        await queryRunner.query(`DROP TABLE "project"`);
        await queryRunner.query(`DROP TABLE "poll"`);
        await queryRunner.query(`DROP TABLE "poll_response"`);
        await queryRunner.query(`DROP TABLE "page_settings"`);
        await queryRunner.query(`DROP TABLE "option"`);
        await queryRunner.query(`DROP TABLE "notice"`);
        await queryRunner.query(`DROP TABLE "member_profile"`);
        await queryRunner.query(`DROP TABLE "member_permission"`);
        await queryRunner.query(`DROP TABLE "member"`);
        await queryRunner.query(`DROP TABLE "manual_payment_data"`);
        await queryRunner.query(`DROP TABLE "join_flow"`);
        await queryRunner.query(`DROP TABLE "gift_flow"`);
        await queryRunner.query(`DROP TABLE "gc_payment_data"`);
        await queryRunner.query(`DROP TABLE "gc_payment"`);
        await queryRunner.query(`DROP INDEX "IDX_b5152e07fe3321acd931df5783"`);
        await queryRunner.query(`DROP TABLE "export_item"`);
        await queryRunner.query(`DROP TABLE "export"`);
        await queryRunner.query(`DROP TABLE "email_mailing"`);
        await queryRunner.query(`DROP TABLE "email"`);
    }

}
