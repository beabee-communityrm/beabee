import axios from 'axios';
import crypto from 'crypto';
import gunzip from 'gunzip-maybe';
import JSONStream from 'JSONStream';
import tar from 'tar-stream';

import { log as mainLogger } from '@core/logging';
import { cleanEmailAddress } from '@core/utils';

import { NewsletterMember, NewsletterProvider, PartialNewsletterMember } from '.';

const log = mainLogger.child({app: 'newsletter-service'});

interface MailchimpConfig {
	api_key: string
	datacenter: string
	list_id: string
}

interface Batch {
	id: string
	status: string
	finished_operations: number
	total_operations: number
	errored_operations: number
	response_body_url: string
}

interface OperationNoBody {
	method: 'GET'|'DELETE'|'POST'
	path: string
	operation_id: string
	body?: undefined
}

interface OperationWithBody {
	method: 'PUT'|'POST'
	path: string
	body: string
	operation_id: string;
}

type Operation = OperationNoBody|OperationWithBody;

interface OperationResponse {
	status_code: number
	response: string
	operation_id: string
}

interface MCMember {
	email_address: string,
	status: 'subscribed'|'unsubscribed'|'pending'|'cleaned',
	interests: {[interest: string]: boolean }
	merge_fields: Record<string, string>,
	tags: {id: number, name: string}[]
}

function createInstance(config: MailchimpConfig) {
	const instance = axios.create({
		baseURL: `https://${config.datacenter}.api.mailchimp.com/3.0/`,
		auth: {
			username: 'user',
			password: config.api_key
		},
	});

	instance.interceptors.request.use(config => {
		log.debug({
			url: config.url,
			method: config.method,
			sensitive: {
				params: config.params,
				data: config.data
			}
		});

		return config;
	});

	instance.interceptors.response.use(response => {
		return response;
	}, error => {
		log.error({
			status: error.response.status,
			data: error.response.data
		}, 'MailChimp API returned with status ' + error.response.status);
		return Promise.reject(error);
	});

	return instance;
}

function memberToMCMember(member: PartialNewsletterMember, upsert=false): Partial<MCMember> {
	return {
		email_address: member.email,
		...(member.status || upsert) && {
			[upsert ? 'status_if_new' : 'status']: member.status || 'unsubscribed'
		},
		...(member.firstname || member.lastname || member.fields) && {
			merge_fields: {
				...member.firstname && {FNAME: member.firstname},
				...member.lastname && {LNAME: member.lastname},
				...member.fields
			}
		},
		...member.groups && {
			interests: Object.assign({}, ...member.groups.map(group => ({[group]: true})))
		}
	};
}

// Ignore 404/405s from delete operations
function validateOperationStatus(statusCode: number, operationId: string) {
	return statusCode < 400 ||
		operationId.startsWith('delete') && (statusCode === 404 || statusCode === 405);
}

export default class MailchimpProvider implements NewsletterProvider {
	private readonly instance;
	private readonly listId;

	constructor(config: MailchimpConfig) {
		this.instance = createInstance(config);
		this.listId = config.list_id;
	}

	async addTagToMembers(emails: string[], tag: string): Promise<void> {
		const operations: Operation[] = emails.map(email => ({
			path: this.emailUrl(email) + '/tags',
			method: 'POST',
			body: JSON.stringify({
				tags: [{name: tag, status: 'active'}]
			}),
			operation_id: `add_tag_${email}`
		}));
		await this.dispatchOperations(operations);
	}

	async removeTagFromMembers(emails: string[], tag: string): Promise<void> {
		const operations: Operation[] = emails.map(email => ({
			path: this.emailUrl(email) + '/tags',
			method: 'POST',
			body: JSON.stringify({
				tags: [{name: tag, status: 'inactive'}]
			}),
			operation_id: `remove_tag_${email}`
		}));
		await this.dispatchOperations(operations);
	}

	async getMembers(): Promise<NewsletterMember[]> {
		const operation: Operation = {
			path: `lists/${this.listId}/members`,
			method: 'GET',
			operation_id: 'get'
		};

		const batch = await this.createBatch([operation]);
		const finishedBatch = await this.waitForBatch(batch);
		const members = await this.getBatchResponses(finishedBatch);

		return (members as MCMember[]).map(member => {
			const {FNAME, LNAME, ...fields} = member.merge_fields;
			return {
				email: member.email_address,
				firstname: FNAME || '',
				lastname: LNAME || '',
				status: member.status === 'subscribed' ? 'subscribed' : 'unsubscribed',
				groups: Object.entries(member.interests).filter(([group, isOptedIn]) => isOptedIn).map(([group]) => group),
				tags: member.tags.map(tag => tag.name),
				fields
			};
		});
	}

	async updateMember(member: PartialNewsletterMember, oldEmail = member.email): Promise<void> {
		await this.instance.patch(this.emailUrl(oldEmail), memberToMCMember(member));
	}

	async upsertMembers(members: PartialNewsletterMember[]): Promise<void> {
		const operations: Operation[] = members.map(member => ({
			path: this.emailUrl(member.email),
			method: 'PUT',
			body: JSON.stringify(memberToMCMember(member, true)),
			operation_id: `add_${member.email}`
		}));

		await this.dispatchOperations(operations);
	}

	async archiveMembers(emails: string[]): Promise<void> {
		const operations: Operation[] = emails.map(email => ({
			path: this.emailUrl(email),
			method: 'DELETE',
			operation_id: `delete_${email}`
		}));
		await this.dispatchOperations(operations);
	}

	async deleteMembers(emails: string[]): Promise<void> {
		const operations: Operation[] = emails.map(email => ({
			path: this.emailUrl(email) + '/actions/permanently-delete',
			method: 'POST',
			operation_id: `delete-permanently_${email}`
		}));
		await this.dispatchOperations(operations);
	}

	private emailUrl(email: string) {
		const emailHash = crypto.createHash('md5').update(cleanEmailAddress(email)).digest('hex');
		return `lists/${this.listId}/members/${emailHash}`;
	}

	private async createBatch(operations: Operation[]): Promise<Batch> {
		log.info({
			action: 'create-batch',
			data: {
				operationCount: operations.length
			}
		});
		const response = await this.instance.post('/batches/', {operations});
		return response.data as Batch;
	}

	private async waitForBatch(batch: Batch): Promise<Batch> {
		log.info({
			action: 'wait-for-batch',
			data: {
				batchId: batch.id,
				finishedOperations: batch.finished_operations,
				totalOperations: batch.total_operations,
				erroredOperations: batch.errored_operations
			}
		});

		if (batch.status === 'finished') {
			return batch;
		} else {
			await new Promise(resolve => setTimeout(resolve, 5000));
			return await this.waitForBatch((await this.instance.get('/batches/' + batch.id)).data);
		}
	}

	private async getBatchResponses(batch: Batch): Promise<any[]> {
		log.info({
			action: 'get-batch-responses',
			data: {
				batchId: batch.id,
				finishedOperations: batch.finished_operations,
				totalOperations: batch.total_operations,
				erroredOperations: batch.errored_operations
			}
		});


		const batchResponses: any[] = [];

		const response = await axios({
			method: 'GET',
			url: batch.response_body_url,
			responseType: 'stream'
		});

		const extract = tar.extract();

		extract.on('entry', (header, stream, next) => {
			stream.on('end', next);

			if (header.type === 'file') {
				log.info({
					action: 'checking-batch-error-file',
					data: {
						name: header.name
					}
				});
				stream.pipe(JSONStream.parse('*'))
					.on('data', (data: OperationResponse) => {
						if (validateOperationStatus(data.status_code, data.operation_id)) {
							log.error({
								action: 'check-batch-errors',
								data
							}, `Unexpected error for ${data.operation_id}, got ${data.status_code}`);
						} else {
							batchResponses.push(JSON.parse(data.response));
						}
					});
			} else {
				stream.resume();
			}

		});

		return await new Promise((resolve, reject) => {
			response.data
				.pipe(gunzip())
				.pipe(extract)
				.on('error', reject)
				.on('finish', () => resolve(batchResponses));
		});
	}

	private async dispatchOperations(operations: Operation[]): Promise<void> {
		if (operations.length > 20) {
			const batch = await this.createBatch(operations);
			const finishedBatch = await this.waitForBatch(batch);
			await this.getBatchResponses(finishedBatch); // Just check for errors
		} else {
			for (const operation of operations) {
				try {
					await this.instance({
						method: operation.method,
						url: operation.path,
						...operation.body && {data: JSON.parse(operation.body)},
						validateStatus: (status: number) => validateOperationStatus(status, operation.operation_id)
					});
				} catch (err) {
					console.log(err);
				}
			}
		}
	}
}
