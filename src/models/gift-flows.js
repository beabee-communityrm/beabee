const mongoose = require( 'mongoose' );

module.exports = {
	name: 'GiftFlows',
	schema: mongoose.Schema( {
		date: {
			type: Date,
			required: true,
			default: Date.now
		},
		sessionId: {
			type: String,
			required: true
		},
		giftForm: {
			name: {
				type: String,
				required: true
			},
			email: {
				type: String,
				required: true
			},
			startDate: {
				type: Date,
				required: true
			},
			message: {
				type: String,
				required: true
			},
			fromName: {
				type: String,
				required: true
			},
		}
	} )
};

module.exports.model = mongoose.model( module.exports.name, module.exports.schema );
