const mongoose = require( 'mongoose' );

const joinFormFields = {
	amount: {
		type: Number,
		required: true
	},
	period: {
		type: String,
		enum: ['monthly', 'annually']
	},
	referralCode: String,
	referralGift: String,
	referralGiftOptions: Object,
	prorate: Boolean,
	payFee: Boolean
};

module.exports = {
	name: 'RestartFlows',
	schema: mongoose.Schema( {
		code: {
			type: String,
			required: true
		},
		member: {
			type: mongoose.Schema.ObjectId,
			ref: 'Members',
			required: true
		},
		date: {
			type: Date,
			required: true,
			default: Date.now
		},
		customerId: {
			type: String,
			required: true
		},
		mandateId: {
			type: String,
			required: true
		},
		joinForm: joinFormFields
	} )
};

module.exports.model = mongoose.model( module.exports.name, module.exports.schema );
