import moment, { DurationInputArg2 } from 'moment';
import { Brackets, createQueryBuilder, SelectQueryBuilder, WhereExpression } from 'typeorm';

import Member from '@models/Member';
import MemberProfile from '@models/MemberProfile';
import MemberPermission from '@models/MemberPermission';

const operators = {
	equal: (v: RichRuleValue[]) => ['= :a', {a: v[0]}] as const,
	not_equal: (v: RichRuleValue[]) => ['<> :a', {a: v[0]}] as const,
	in: (v: RichRuleValue[]) => ['IN (:...v)', {v}] as const,
	not_in: (v: RichRuleValue[]) => ['NOT IN (:...v)', {v}] as const,
	less: (v: RichRuleValue[]) => ['< :a', {a: v[0]}] as const,
	less_or_equal: (v: RichRuleValue[]) => ['<= :a', {a: v[0]}] as const,
	greater: (v: RichRuleValue[]) => ['> :a', {a: v[0]}] as const,
	greater_or_equal: (v: RichRuleValue[]) => ['>= :a', {a: v[0]}] as const,
	between: (v: RichRuleValue[]) => ['BETWEEN :a AND :b', {a: v[0], b: v[1]}] as const,
	not_between: (v: RichRuleValue[]) => ['NOT BETWEEN :a AND :b', {a: v[0], b: v[1]}] as const,
	begins_with: (v: RichRuleValue[]) => ['ILIKE :a', {a: v[0] + '%'}] as const,
	not_begins_with: (v: RichRuleValue[]) => ['NOT ILIKE :a', {a: v[0] + '%'}] as const,
	contains: (v: RichRuleValue[]) => ['ILIKE :a', {a: '%' + v[0] + '%'}] as const,
	not_contains: (v: RichRuleValue[]) => ['NOT ILIKE :a', {a: '%' + v[0] + '%'}] as const,
	ends_with: (v: RichRuleValue[]) => ['ILIKE :a', {a: '%' + v[0]}] as const,
	not_ends_with: (v: RichRuleValue[]) => ['NOT ILIKE :a', {a: '%' + v[0]}] as const,
	is_empty: () => ['= \'\'', {}] as const,
	is_not_empty: () => ['<> \'\'', {}] as const,
	is_null: () => ['IS NULL', {}] as const,
	is_not_null: () => ['IS NOT NULL', {}] as const,
	contains_jsonb: (v: RichRuleValue[]) => ['? :a', {a: v[0]}] as const
} as const;

const memberFields = [
	'id',
	'firstname',
	'lastname',
	'email',
	'joined',
	'lastSeen',
	'contributionType',
	'contributionMonthlyAmount',
	'contributionPeriod',
] as const;

const profileFields = [
	'deliveryOptIn',
	'tags'
] as const;

const permissionFields = [
	'dateAdded',
	'dateExpires',
	'permission'
] as const;

const gcPaymentDataFields = {
	'activeSubscription': 'subscriptionId'
} as const;

type RuleId = typeof memberFields[number]|typeof profileFields[number]|typeof permissionFields[number]
type RuleValue = string|number|boolean;
type RichRuleValue = RuleValue|Date;

export interface Rule {
	id: RuleId
	field: RuleId
	type: 'string'|'integer'|'boolean'|'double'
	operator: keyof typeof operators
	value: RuleValue|RuleValue[]
}

export interface RuleGroup {
	condition: 'AND'|'OR'
	rules: (Rule|RuleGroup)[]
}

function isRuleGroup(a: Rule|RuleGroup): a is RuleGroup {
	return 'condition' in a;
}

function parseValue(value: RuleValue): RichRuleValue {
	if (typeof value === 'string') {
		if (value.startsWith('$now')) {
			const date = moment.utc();
			const match = /\$now(\((?:(?:y|M|d|h|m|s):(?:-?\d+),?)+\))?/.exec(value);
			if (match && match[1]) {
				for (const modifier of match[1].matchAll(/(y|M|d|h|m|s):(-?\d+)/g)) {
					date.add(modifier[2], modifier[1] as DurationInputArg2);
				}
			}
			return date.toDate();
		}
		return value;
	} else {
		return value;
	}
}

class QueryBuilder {
	private params: Record<string, unknown> = {};
	private paramNo = 0;

	readonly mainQb: SelectQueryBuilder<Member>;

	constructor(ruleGroup?: RuleGroup) {
		this.mainQb = createQueryBuilder(Member, 'm');
		this.mainQb.innerJoinAndSelect('m.permissions', 'mp');
		this.mainQb.innerJoinAndSelect('m.profile', 'profile');
		if (ruleGroup) {
			this.parseRuleGroup(ruleGroup)(this.mainQb);
			this.mainQb.setParameters(this.params);
		}
	}

	private parseRule = (rule: Rule) => (qb: WhereExpression): void => {
		const values = Array.isArray(rule.value) ? rule.value : [rule.value];
		const parsedValues = values.map(parseValue);

		const [where, params] = operators[rule.operator](parsedValues);

		// Horrible code to make sure param names are unique
		const suffix = '_' + this.paramNo;
		for (const paramKey in params) {
			this.params[paramKey + suffix] = params[paramKey as keyof typeof params];
		}
		const namedWhere = where.replace(/:((\.\.\.)?[a-z])/g, `:$1${suffix}`);

		if (memberFields.indexOf(rule.field as any) > -1) {
			qb.where(`m.${rule.field} ${namedWhere}`);
		} else if (profileFields.indexOf(rule.field as any) > -1) {
			const table = 'profile' + suffix;
			const subQb = createQueryBuilder()
				.subQuery()
				.select(`${table}.memberId`)
				.from(MemberProfile, table)
				.where(`${table}.${rule.field} ${namedWhere}`);

			qb.where('id IN ' + subQb.getQuery());
		} else if (permissionFields.indexOf(rule.field as any) > -1) {
			const table = 'mp' + suffix;
			const subQb = createQueryBuilder()
				.subQuery()
				.select(`${table}.memberId`)
				.from(MemberPermission, table)
				.where(`${table}.${rule.field} ${namedWhere}`);

			qb.where('id IN ' + subQb.getQuery());
		}

		this.paramNo++;
	}

	private parseRuleGroup = (ruleGroup: RuleGroup) => (qb: WhereExpression) => {
		qb.where(ruleGroup.condition === 'AND' ? 'TRUE' : 'FALSE');
		const conditionFn = ruleGroup.condition === 'AND' ? 'andWhere' as const : 'orWhere' as const;
		for (const rule of ruleGroup.rules) {
			qb[conditionFn](new Brackets(isRuleGroup(rule) ? this.parseRuleGroup(rule) : this.parseRule(rule)));
		}
	}
}

export default function buildQuery(ruleGroup?: RuleGroup): SelectQueryBuilder<Member> {
	return new QueryBuilder(ruleGroup).mainQb;
}
