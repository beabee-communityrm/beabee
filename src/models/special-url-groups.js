const moment = require( 'moment' );
const mongoose = require( 'mongoose' );

module.exports = {
	name: 'SpecialUrlGroups',
	schema: mongoose.Schema( {
		name: {
			type: String,
			required: true
		},
		enabled: Boolean,
		expires: Date,
		urlDuration: Number,
		actions: [{
			name: String,
			params: Object
		}]
	}, {
		timestamps: true
	} )
};

module.exports.schema.virtual( 'active' ).get( function () {
	return this.enabled && (!this.expires || moment.utc(this.expires).isAfter());
});

module.exports.model = mongoose.model( module.exports.name, module.exports.schema );
