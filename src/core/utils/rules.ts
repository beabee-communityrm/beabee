import escapeStringRegexp from 'escape-string-regexp';
import moment, { DurationInputArg2 } from 'moment';
import { FilterQuery } from 'mongoose';

import { Member } from '@models/members';

const operators = {
	equal: (v: RichRuleValue[]) => ( v[0] ),
	not_equal: (v: RichRuleValue[]) => ( { '$ne': v[0] } ),
	in: (v: RichRuleValue[]) => ( { '$in': v } ),
	not_in: (v: RichRuleValue[]) => ( { '$nin': v } ),
	less: (v: RichRuleValue[]) => ( { '$lt': v[0] } ),
	less_or_equal: (v: RichRuleValue[]) => ( { '$lte': v[0] } ),
	greater: (v: RichRuleValue[]) => ( { '$gt': v[0] } ),
	greater_or_equal: (v: RichRuleValue[]) => ( { '$gte': v[0] } ),
	between: (v: RichRuleValue[]) => ( { '$gte': v[0], '$lte': v[1] } ),
	not_between: (v: RichRuleValue[]) => ( { '$lt': v[0], '$gt': v[1] } ),
	begins_with: (v: RichRuleValue[]) => ( { '$regex': '^' + escapeStringRegexp(v[0] + '') } ),
	not_begins_with: (v: RichRuleValue[]) => ( { '$regex': '^(?!' + escapeStringRegexp(v[0] + '') + ')' } ),
	contains: (v: RichRuleValue[]) => ( { '$regex': escapeStringRegexp(v[0] + '') } ),
	not_contains: (v: RichRuleValue[]) => ( { '$regex': '^((?!' + escapeStringRegexp(v[0] + '') + ').)*$', '$options': 's' } ),
	ends_with: (v: RichRuleValue[]) => ( { '$regex': escapeStringRegexp(v[0] + '') + '$' } ),
	not_ends_with: (v: RichRuleValue[]) => ( { '$regex': '(?<!' + escapeStringRegexp(v[0] + '') + ')$' } ),
	is_empty: () => ( '' ),
	is_not_empty: () => ( { '$ne': '' } ),
	is_null: () => ( null ),
	is_not_null: () => ( { '$ne': null }  ),
} as const;

const fields = {
	'firstname': 'firstname',
	'lastname': 'lastname',
	'email': 'email',
	'contributionMonthlyAmount': 'gocardless.amount',
	'contributionPeriod': 'gocardless.period',
	'deliveryOptIn': 'delivery_optin',
	'activeSubscription': 'gocardless.subscription_id',
	'dateAdded': 'permissions.0.date_added',
	'dateExpires': 'permissions.0.date_expires',
	'hasTag': 'tags.name'
} as const;

type RuleValue = string|number|boolean;
type RichRuleValue = RuleValue|Date;

export interface Rule {
	id: keyof typeof fields
	field: keyof typeof fields
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

function parseRule(rule: Rule): FilterQuery<Member> {
	const values = Array.isArray(rule.value) ? rule.value : [rule.value];
	return {
		[fields[rule.field]]: operators[rule.operator](values.map(parseValue))
	};
}

export function parseRuleGroup(query: RuleGroup): FilterQuery<Member> {
	return {
		[query.condition === 'AND' ? '$and' : '$or']: query.rules.map(rule => (
			isRuleGroup(rule) ? parseRuleGroup(rule) : parseRule(rule)
		))
	};
}
