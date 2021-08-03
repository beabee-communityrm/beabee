import {MigrationInterface, QueryRunner} from 'typeorm';

export class AddDefaultSegments1616694307645 implements MigrationInterface {

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`INSERT INTO public.segment (id, name, description, "ruleGroup", "order") VALUES ('81664449-adf2-4c3a-aee2-145a96d67726', 'Active members', '', '{"rules": [{"id": "activeMembership", "type": "boolean", "field": "activeMembership", "input": "radio", "value": true, "operator": "equal"}], "valid": true, "condition": "AND"}', 0)`);
		await queryRunner.query(`INSERT INTO public.segment (id, name, description, "ruleGroup", "order") VALUES ('ce1b2919-85c1-4134-8231-df6b860c0ae2', 'Expires soon', 'Active members who expire in the next 4 weeks', '{"rules": [{"id": "dateExpires", "type": "datetime", "field": "dateExpires", "input": "text", "value": ["$now", "$now(d:28)"], "operator": "between"}, {"id": "permission", "type": "string", "field": "permission", "input": "select", "value": "member", "operator": "equal"}], "valid": true, "condition": "AND"}', 2)`);
		await queryRunner.query(`INSERT INTO public.segment (id, name, description, "ruleGroup", "order") VALUES ('f66f45bd-d406-45f6-87da-34d2cd55297a', 'Joined last 3 months', 'Contacts who joined in the last 3 months', '{"rules": [{"id": "joined", "type": "datetime", "field": "joined", "input": "text", "value": "$now(M:-3)", "operator": "greater"}], "valid": true, "condition": "AND"}', 1)`);
		await queryRunner.query(`INSERT INTO public.segment (id, name, description, "ruleGroup", "order") VALUES ('6a233a3b-74f6-4af8-b4cf-e5070a32746a', 'Expired last 3 months', '', '{"rules": [{"id": "dateExpires", "type": "datetime", "field": "dateExpires", "input": "text", "value": ["$now(M:-3)", "$now"], "operator": "between"}, {"id": "permission", "type": "string", "field": "permission", "input": "select", "value": "member", "operator": "equal"}], "valid": true, "condition": "AND"}', 2)`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query('DELETE FROM segment WHERE id IN ($1, $2, $3, $4)', [
			'81664449-adf2-4c3a-aee2-145a96d67726',
			'ce1b2919-85c1-4134-8231-df6b860c0ae2',
			'f66f45bd-d406-45f6-87da-34d2cd55297a',
			'6a233a3b-74f6-4af8-b4cf-e5070a32746a'
		]);
	}

}
