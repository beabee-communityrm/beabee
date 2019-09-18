const mongoose = require( 'mongoose' );

module.exports = {
	name: 'ReferralGifts',
	schema: mongoose.Schema( {
		name: {
			type: String,
			required: true,
			unique: true
		},
		label: {
			type: String,
			required: true
		},
		description: {
			type: String,
			required: true
		},
		minAmount: {
			type: Number,
			required: true
		},
		enabled: {
			type: Boolean,
			default: true
		},
		options: [{
			name: {
				type: String,
				required: true
			},
			values: [String]
		}],
		stock: {
			type: Map,
			of: Number
		}
	}, {
		timestamps: true
	} )
};

module.exports.model = mongoose.model( module.exports.name, module.exports.schema );
