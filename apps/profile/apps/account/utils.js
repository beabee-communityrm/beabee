const gocardless = require( __js + '/gocardless' );
const mailchimp = require( __js + '/mailchimp' );

const { addToMailingLists } = require( __apps + '/join/utils' );

async function syncMemberDetails(member, {email, firstname, lastname}) {
	if ( member.isActiveMember ) {
		try {
			await mailchimp.defaultLists.members.update( member.email, {
				email_address: email,
				merge_fields: {
					FNAME: firstname,
					LNAME: lastname
				}
			} );
		} catch (err) {
			if (err.response && err.response.status === 404) {
				// TMPFIX: Insert with old email address then overwrite
				await addToMailingLists(member);
				await mailchimp.defaultLists.members.update( member.email, {
					email_address: email,
					merge_fields: {
						FNAME: firstname,
						LNAME: lastname
					}
				} );
			} else {
				throw err;
			}
		}
	}

	if ( member.gocardless.customer_id ) {
		await gocardless.customers.update( member.gocardless.customer_id, {
			email,
			given_name: firstname,
			family_name: lastname
		} );
	}
}

module.exports = {
	syncMemberDetails
};
