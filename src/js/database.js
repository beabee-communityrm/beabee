const mongoose = require( 'mongoose' );
const log = require( '@core/logging' ).log;

exports.ObjectId = mongoose.Schema.ObjectId;
exports.mongoose = mongoose;

exports.connect = function( url ) {
	mongoose.Promise = global.Promise;
	mongoose.connect( url, {
		useNewUrlParser: true,
		useCreateIndex: true,
		useUnifiedTopology: true
	} );
	var db = mongoose.connection;
	db.on( 'connected', function() {
		log.debug( {
			app: 'database',
			action: 'connect',
			message: 'Connected to Mongo database'
		} );
	} );
	db.on( 'error', function( error ) {
		log.debug( {
			app: 'database',
			action: 'connect',
			message: 'Error connecting to Mongo database',
			error: error
		} );
		process.exit();
	} );

	return exports;
};

exports.Exports = require('@models/exports').model;
exports.GiftFlows = require('@models/gift-flows').model;
exports.JoinFlows = require('@models/join-flows').model;
exports.Members = require('@models/members').model;
exports.Notices = require('@models/notices').model;
exports.Options = require('@models/options').model;
exports.PageSettings = require('@models/page-settings').model;
exports.Payments = require('@models/payments').model;
exports.Permissions = require('@models/permissions').model;
exports.PollAnswers = require('@models/PollAnswers').model;
exports.Polls = require('@models/polls').model;
exports.ProjectMembers = require('@models/project-members').model;
exports.Projects = require('@models/projects').model;
exports.ReferralGifts = require('@models/referral-gifts').model;
exports.Referrals = require('@models/referrals').model;
exports.RestartFlows = require('@models/restart-flows').model;
exports.SpecialUrlGroups = require('@models/special-url-groups').model;
exports.SpecialUrls = require('@models/special-urls').model;
exports.TransactionalEmails = require('@models/transactional-emails').model;
