const mandrill = require('mandrill-api/mandrill');
const moment = require('moment');
const config = require('../../config/config.json');

const client = new mandrill.Mandrill(config.mandrill.api_key);

const templates = {
	'welcome': member => [{
		name: 'REFLINK',
		content: member.referralLink
	}],
	'reset-password': member => [{
		name: 'RPLINK',
		content: config.audience + '/password-reset/code/' + member.password.reset_code
	}],
	'cancelled-contribution': member => [{
		name: 'EXPIRES',
		content: moment(member.memberPermission.date_expires).format('dddd Do MMMM')
	}, {
		name: 'MEMBERSHIPID',
		content: member.uuid
	}],
	'cancelled-contribution-no-survey': member => [{
		name: 'EXPIRES',
		content: moment(member.memberPermission.date_expires).format('dddd Do MMMM')
	}],
	'restart-membership': (member, {code}) => [{
		name: 'RESTARTLINK',
		content: config.audience + '/join/restart/' + code
	}],
	'successful-referral': (member, {refereeName, isEligible}) => [{
		name: 'REFLINK',
		content: member.referralLink
	}, {
		name: 'REFEREENAME',
		content: refereeName
	}, {
		name: 'ISELIGIBLE',
		content: isEligible
	}],
	'giftee-success': (member, {fromName, message}) => [{
		name: 'PURCHASER',
		content: fromName,
	}, {
		name: 'MESSAGE',
		content: message
	}, {
		name: 'ACTIVATELINK',
		content: config.audience + '/gift/' + member.giftCode
	}],
	'expired-special-url-resend': (member, {url}) => [{
		name: 'URL',
		content: url
	}]
};

function memberToMessage(templateId, member, vars) {
	return {
		to: [{
			email: member.email,
			name: member.fullname
		}],
		merge_vars: [{
			rcpt: member.email,
			vars: [
				{
					name: 'FNAME',
					content: member.firstname
				},
				...templates[templateId](member, vars)
			]
		}],
	};
}

function sendTemplate(templateId, message, send_at=null) {
	return new Promise((resolve, reject) => {
		client.messages.sendTemplate({
			template_name: templateId,
			template_content: [],
			message,
			...(send_at ? {send_at} : {})
		}, resolve, reject);
	});
}

module.exports = {
	sendTemplate,
	sendToMember(templateId, member, vars, send_at) {
		return sendTemplate(templateId, memberToMessage(templateId, member, vars), send_at);
	},
	sendMessage(templateId, message, send_at) {
		return sendTemplate(templateId, message, send_at);
	},
	send(message) {
		return new Promise((resolve, reject) => {
			client.messages.send({message}, resolve, reject);
		});
	},
	listTemplates() {
		return new Promise((resolve, reject) => {
			client.templates.list(resolve, reject);
		});
	}
};
