const gocardless = require( __js + '/gocardless' );
const mailchimp = require( __js + '/mailchimp' );

const { addToMailingLists } = require( __apps + '/join/utils' );

async function syncMemberDetails(member, oldEmail) {
	if ( member.isActiveMember ) {
		try {
			await mailchimp.mainList.updateMemberDetails( member, oldEmail );
		} catch (err) {
			if (err.response && err.response.status === 404) {
				await addToMailingLists(member);
			} else {
				throw err;
			}
		}
	}

	if ( member.gocardless.customer_id ) {
		await gocardless.customers.update( member.gocardless.customer_id, {
			email: member.email,
			given_name: member.firstname,
			family_name: member.lastname
		} );
	}
}

module.exports = {
	syncMemberDetails
};
