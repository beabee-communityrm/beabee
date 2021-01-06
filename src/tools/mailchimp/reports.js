const fs = require('fs');
const mailchimp = require( '@core/mailchimp' );

async function fetchReportIds() {
	const response = await mailchimp.instance.get('/reports', {params: {
		count: 500,
		fields: 'reports.id,reports.list_name,reports.send_time'
	}});

	return response.data.reports
		.sort((a, b) => a.send_time < b.send_time ? -1 : 1)
		.map(report => report.id);
}

async function fetchReportSentTo(reportId) {
	const cache = 'report-' + reportId + '.json';
	if (fs.existsSync(cache)) {
		return JSON.parse(fs.readFileSync('./' + cache).toString());
	} else {
		const response = await mailchimp.instance.get(`/reports/${reportId}/sent-to`, {params: {
			count: 2000,
			fields: 'sent_to.email_address,sent_to.open_count,total_items'
		}});

		const report = response.data;
		if (report.total_items > 2000) {
			console.error('Report has more than 2,000 sendees, improve your script');
		}

		const ret = {
			users: report.sent_to,
			sent: report.sent_to.length,
			opens: report.sent_to.reduce((total, user) => total + (user.open_count > 0), 0)
		};

		fs.writeFileSync(cache, JSON.stringify(ret));

		return ret;
	}
}

async function main(reportIds) {
	const emails = {};
	const esps = {};

	for (let reportId of reportIds) {
		const report = await fetchReportSentTo(reportId);
		console.error(`Users: ${report.opens}/${report.sent}`);
		console.error('Open rate:', (report.opens / report.sent * 100).toFixed(1));

		report.users.forEach(user => {
			const esp = user.email_address.substr(user.email_address.indexOf('@') + 1);

			if (!emails[user.email_address])
				emails[user.email_address] = {sent: 0, opened: 0, reports: {}};

			if (!esps[esp]) {
				esps[esp] = {
					sent: 0, opened: 0,
					reports: Object.assign(...reportIds.map(reportId => ({[reportId]: {sent: 0, opened: 0}})))
				};
			}

			emails[user.email_address].sent++;

			esps[esp].sent++;
			esps[esp].reports[reportId].sent++;

			if (user.open_count > 0) {
				emails[user.email_address].opened++;
				emails[user.email_address].reports[reportId] = 'O';

				esps[esp].opened++;
				esps[esp].reports[reportId].opened++;
			} else {
				emails[user.email_address].reports[reportId] = 'S';
			}
		});
	}

	console.log('esp\temail\tsent\topened\topen_rate\t' + reportIds.join('\t'));
	Object.entries(emails).forEach(([email, {sent, opened, reports}]) => {
		const reportStates = reportIds.map(reportId => reports[reportId] || '').join('\t');
		const esp = email.substr(email.indexOf('@') + 1);

		console.log(`${esp}\t${email}\t${sent}\t${opened}\t${opened / sent}\t` + reportStates);
	});
}

const reportIds = process.argv.length > 2 ?
	Promise.resolve(process.argv.slice(2)) : fetchReportIds();

reportIds
	.then(main)
	.catch(err => console.error(err));
