const moment = require( 'moment' );
const mongoose = require( 'mongoose' );

module.exports = {
	name: 'Polls',
	schema: mongoose.Schema( {
		date: {
			type: Date,
			required: true,
			default: Date.now
		},
		question: {
			type: String,
			required: true
		},
		description: String,
		slug: {
			type: String,
			required: true,
			unique: true
		},
		mergeField: String,
		closed: {
			type: Boolean,
			default: false
		},
		expires: Date,
		allowUpdate: Boolean
	} )
};

module.exports.schema.virtual( 'active' ).get( function () {
	return !this.closed && (!this.expires || moment.utc(this.expires).isAfter());
});

module.exports.model = mongoose.model( module.exports.name, module.exports.schema );
