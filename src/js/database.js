const mongoose = require( 'mongoose' );
const log = require( __js + '/logging' ).log;

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

exports.Exports = require('../models/exports').model;
exports.GiftFlows = require('../models/gift-flows.js').model;
exports.JoinFlows = require('../models//join-flows.js').model;
exports.Members = require('../models//members.js').model;
exports.Notices = require('../models//notices.js').model;
exports.Options = require('../models//options.js').model;
exports.PageSettings = require('../models//page-settings.js').model;
exports.Payments = require('../models/payments.js').model;
exports.Permissions = require('../models/permissions.js').model;
exports.PollAnswers = require('../models/PollAnswers.js').model;
exports.Polls = require('../models/polls.js').model;
exports.ProjectMembers = require('../models/project-members.js').model;
exports.Projects = require('../models/projects.js').model;
exports.ReferralGifts = require('../models/referral-gifts.js').model;
exports.Referrals = require('../models/referrals.js').model;
exports.RestartFlows = require('../models/restart-flows.js').model;
exports.SpecialUrlGroups = require('../models/special-url-groups.js').model;
exports.SpecialUrls = require('../models/special-urls.js').model;
exports.TransactionalEmails = require('../models/transactional-emails.js').model;