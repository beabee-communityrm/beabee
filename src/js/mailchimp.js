const axios = require('axios');
const crypto = require('crypto');
const config = require('../../config/config.json');

const { log } = require( '@core/logging' );
const { cleanEmailAddress } = require( '@core/utils' );

function createInstance(endpoint) {
	const instance = axios.create({
		baseURL: `https://${config.mailchimp.datacenter}.api.mailchimp.com/3.0${endpoint}`,
		auth: {
			username: 'user',
			password: config.mailchimp.api_key
		}
	});

	instance.interceptors.request.use(config => {
		log.debug({
			app: 'mailchimp' + endpoint,
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
			app: 'mailchimp' + endpoint,
			status: error.response.status,
			data: error.response.data
		}, 'MailChimp API returned with status ' + error.response.status);
		return Promise.reject(error);
	});

	return instance;
}

function emailToHash(email) {
	return crypto.createHash('md5').update(cleanEmailAddress(email)).digest('hex');
}


function lists(listId) {
	const listInstance = createInstance('/lists/' + listId);

	return {
		members: {
			async create(email, data) {
				await listInstance.post('/members', {
					email_address: email,
					...data
				});
			},
			async upsert(email, data) {
				await listInstance.put('/members/' + emailToHash(email), data);
			},
			async update(email, data) {
				await listInstance.patch('/members/' + emailToHash(email), data);
			},
			async delete(email) {
				await listInstance.delete('/members/' + emailToHash(email));
			},
			async permanentlyDelete(email) {
				await listInstance.post('/members/' + emailToHash(email) + '/actions/delete-permanent');
			}
		}
	};
}

const batchInstance = createInstance('/batches');

const mainListInstance = lists(config.mailchimp.mainList);

function memberToMCMember(member) {
	return {
		email_address: member.email,
		merge_fields: {
			FNAME: member.firstname,
			LNAME: member.lastname,
			REFLINK: member.referralLink,
			POLLSCODE: member.pollsCode,
			C_DESC: member.contributionDescription,
			C_MNTHAMT: member.contributionMonthlyAmount,
			C_PERIOD: member.contributionPeriod
		}
	};
}

module.exports = {
	instance: createInstance(''),
	lists,
	batches: {
		async create(operations) {
			const response = await batchInstance.post('/', {operations});
			return response.data;
		},
		async get(batchId) {
			const response = await batchInstance.get('/' + batchId);
			return response.data;
		}
	},
	mainList: {
		async addMember(member) {
			await mainListInstance.members.upsert(member.email, {
				...memberToMCMember(member),
				interests: Object.assign(
					{},
					...config.mailchimp.mainListGroups.map(group => ({[group]: true}))
				),
				status_if_new: 'subscribed'
			});
		},
		async updateMemberDetails(member, oldEmail=member.email) {
			await mainListInstance.members.update(oldEmail, memberToMCMember(member));
		},
		async updateMemberFields(member, fields) {
			await mainListInstance.members.update(member.email, {
				merge_fields: fields
			});
		},
		async permanentlyDeleteMember(member) {
			await mainListInstance.members.permanentlyDelete(member.email);
		}
	}
};
