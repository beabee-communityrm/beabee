const moment = require( 'moment' );
const mongoose = require( 'mongoose' );

module.exports = {
	name: 'Notices',
	schema: mongoose.Schema( {
		date: {
			type: Date,
			required: true,
			default: Date.now
		},
		name: {
			type: String,
			required: true
		},
		expires: Date,
		enabled: Boolean,
		text: {
			type: String,
			required: true
		},
		url: String
	} )
};

module.exports.schema.virtual( 'active' ).get( function () {
	return this.enabled && (!this.expires || moment(this.expires).isAfter());
});

module.exports.model = mongoose.model( module.exports.name, module.exports.schema );
