import axios from 'axios';
import crypto from 'crypto';
import { Request } from 'express';
import { Customer, CustomerBankAccount, Mandate, Payment, RedirectFlow, Subscription } from 'gocardless-nodejs/types/Types';
import { v4 as uuidv4 } from 'uuid';

import { log } from '@core/logging';

import config from '@config';

const gocardless = axios.create({
	baseURL: `https://${config.gocardless.sandbox ? 'api-sandbox' : 'api'}.gocardless.com`,
	headers: {
		'Authorization': `Bearer ${config.gocardless.access_token}`,
		'GoCardless-Version': '2015-07-06',
		'Accept': 'application/json',
		'Content-Type': 'application/json'
	}
});

gocardless.interceptors.request.use(config => {
	log.debug({
		app: 'gocardless',
		url: config.url,
		method: config.method,
		sensitive: {
			params: config.params,
			data: config.data
		}
	});

	if (config.method === 'post') {
		config.headers['Idempotency-Key'] = uuidv4();
	}
	return config;
});

gocardless.interceptors.response.use(response => {
	return response;
}, error => {
	log.debug({
		app: 'gocardless',
		status: error.response.status,
		data: error.response.data
	});
	return Promise.reject(error);
});

const STANDARD_METHODS = ['create', 'get', 'update', 'list', 'all'];

interface Methods<T> {
	create(data: Partial<T>): Promise<T>,
	list(params?: Record<string, unknown>): Promise<T[]>,
	all(params?: Record<string, unknown>): Promise<T[]>,
	get(id: string, params?: Record<string, unknown>): Promise<T>,
	update(id: string, data: Partial<T>):  Promise<T>,
	remove(id: string): Promise<boolean>
}

interface Actions<T> {
	cancel(id: string): Promise<T>
	complete(id: string, data?: Record<string, unknown>): Promise<T>
}

function createMethods<T>(key: string, allowedMethods: string[], allowedActions: string[] = []): Methods<T>&Actions<T> {
	const endpoint = `/${key}`;

	const methods: Methods<T> = {
		async create(data) {
			const response = await gocardless.post(endpoint, {[key]: data});
			return <T>response.data[key];
		},
		async list(params) {
			const response = await gocardless.get(endpoint, {params});
			return <T[]>response.data[key];
		},
		async all(params) {
			const {data: {meta, [key]: resources}} = await gocardless.get(endpoint, {params});

			const moreResources = meta.cursors.after ?
				await this.all({...params, after: meta.cursors.after}) : [];

			return <T[]>[...resources, ...moreResources];
		},
		async get(id, params) {
			const response = await gocardless.get(`${endpoint}/${id}`, {params});
			return <T>response.data[key];
		},
		async update(id, data) {
			const response = await gocardless.put(`${endpoint}/${id}`, {[key]: data});
			return <T>response.data[key];
		},
		async remove(id) {
			const response = await gocardless.delete(`${endpoint}/${id}`);
			return response.status < 300;
		}
	};

	function actionMethod(action: string) {
		return async (id: string, data?: Record<string, unknown>) => {
			const response = await gocardless.post(`${endpoint}/${id}/actions/${action}`, {data});
			return response.data[key];
		};
	}

	return Object.assign(
		[],
		...allowedMethods.map(method => ({[method]: methods[method]})),
		...allowedActions.map(action => ({[action]: actionMethod(action)}))
	);
}

export default {
	//creditors: createMethods<Creditor>('creditors', STANDARD_METHODS),
	//creditorBankAccounts: createMethods<CreditorBankAccount>('creditor_bank_accounts', ['create', 'get', 'list', 'all'], ['disable']),
	customers: createMethods<Customer>('customers', [...STANDARD_METHODS, 'remove']),
	customerBankAccounts: createMethods<CustomerBankAccount>('customer_bank_accounts', STANDARD_METHODS, ['disable']),
	//events: createMethods<Event>('events', ['get', 'list', 'all']),
	mandates: createMethods<Mandate>('mandates', STANDARD_METHODS, ['cancel', 'reinstate']),
	//mandateImports: createMethods<MandateImport>('mandate_imports', ['create', 'get'], ['submit', 'cancel']),
	//mandateImportEntries: createMethods<MandateImportEntry>('mandate_import_entries', ['create', 'list', 'all']),
	payments: createMethods<Payment>('payments', STANDARD_METHODS, ['cancel', 'retry']),
	//payouts: createMethods<Payout>('payouts', ['get', 'list', 'all']),
	//payoutItems: createMethods<PayoutItem>('payout_items', ['list', 'all']),
	redirectFlows: createMethods<RedirectFlow>('redirect_flows', ['create', 'get'], ['complete']),
	//refunds: createMethods<Refund>('refunds', STANDARD_METHODS),
	subscriptions: createMethods<Subscription>('subscriptions', STANDARD_METHODS, ['cancel']),
	webhooks: {
		validate(req: Request): boolean {
			const rehashed_webhook_signature =
				crypto.createHmac( 'sha256', config.gocardless.secret ).update( req.body ).digest( 'hex' );

			return req.headers['content-type'] === 'application/json' &&
				req.headers['webhook-signature'] === rehashed_webhook_signature;
		}
	}
};
