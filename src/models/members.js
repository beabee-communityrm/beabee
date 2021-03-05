const mongoose = require( 'mongoose' );
const moment = require( 'moment' );

const { getActualAmount } = require( '@core/utils' );

const config = require( '@config' );
const { getRepository } = require('typeorm');
const { default: MemberPermission } = require('./MemberPermission');

const ObjectId = mongoose.Schema.ObjectId;

module.exports = {
	name: 'Members',
	schema: mongoose.Schema( {
		_id: {
			type: ObjectId,
			default: function() { return new mongoose.Types.ObjectId(); },
			required: true
		},
		uuid: {
			type: String,
			unique: true,
			default: function () { // pseudo uuid4
				function s4() {
					return Math.floor( ( 1 + Math.random() ) * 0x10000 ).toString( 16 ).substring( 1 );
				}
				return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
			}
		},
		email: {
			type: String,
			required: true,
			unique: true,
			lowercase: true,
			validate: {
				validator: function ( v ) {
					return /[A-z0-9._%+-]+@[A-z0-9.-]+\.[A-z]{2,}/.test( v );
				},
				message: '{VALUE} is not a valid email address'
			}
		},
		referralCode: {
			type: String,
			unique: true,
			sparse: true
		},
		pollsCode: {
			type: String,
			unique: true,
			sparse: true
		},
		giftCode: String,
		loginOverride: {
			code: String,
			expires: Date
		},
		password: {
			hash: {
				type: String,
			},
			salt: {
				type: String,
			},
			iterations: {
				type: Number,
				default: 1000
			},
			reset_code: {
				type: String
			},
			tries: {
				type: Number,
				default: 0
			}
		},
		otp: {
			key: {
				type: String,
				default: ''
			},
			activated: {
				type: Boolean,
				default: false
			}
		},
		firstname: {
			type: String,
			required: true
		},
		lastname: {
			type: String,
			required: true
		},
		description: String,
		bio: String,
		notes: String,
		contact: {
			telephone: String,
			twitter: String,
			preferred: String
		},
		delivery_optin: {
			type: Boolean
		},
		delivery_address: {
			line1: {
				type: String
			},
			line2: {
				type: String,
			},
			city: {
				type: String,
			},
			postcode: {
				type: String
			}
		},
		delivery_copies: Number,
		tags: [{
			added: {
				type: Date,
				default: Date.now,
				required: true
			},
			name: {
				type: String,
				required: true
			}
		}],
		joined: {
			type: Date,
			default: Date.now,
			required: true
		},
		contributionType: String,
		contributionMonthlyAmount: Number,
		contributionPeriod: {
			type: String,
			enum: ['monthly', 'annually', 'gift']
		},
		nextContributionMonthlyAmount: Number,
		permissions: [ {
			permission: {
				type: ObjectId,
				ref: 'Permissions',
				required: true
			},
			date_added: {
				type: Date,
				default: Date.now,
				required: true
			},
			date_expires: {
				type: Date
			},
			admin: {
				type: Boolean,
				default: false
			}
		} ],
		last_seen: Date,
		exports: [ {
			export_id: {
				type: ObjectId,
				ref: 'Exports',
				required: true
			},
			status: {
				type: String,
				required: true
			}
		} ]
	} )
};

module.exports.schema.virtual( 'fullname' ).get( function() {
	return this.firstname + ' ' + this.lastname;
} );

module.exports.schema.virtual( 'memberMonthsRemaining' ).get( function () {
	const membership = this.permissions.find(p => p.permission === 'member');
	return membership ? Math.max(0,
		moment.utc(membership.dateExpires)
			.subtract(config.gracePeriod).diff(moment.utc(), 'months')) : 0;
} );

module.exports.schema.virtual( 'isActiveMember' ).get( function () {
	const membership = this.permissions.find(p => p.permission === 'member');
	return membership && membership.isActive;
} );

module.exports.schema.virtual( 'setupComplete' ).get( function() {
	return !!this.password.hash;
} );

module.exports.schema.virtual( 'referralLink' ).get( function () {
	return 'https://thebristolcable.org/refer/' + this.referralCode;
} );

module.exports.schema.virtual( 'contributionDescription' ).get( function () {
	if (this.contributionType === 'Gift') {
		return 'Gift';
	} else if (!this.contributionPeriod) {
		return 'None';
	} else {
		const amount = getActualAmount(this.contributionMonthlyAmount, this.contributionPeriod);
		return `${config.currencySymbol}${amount}/${this.contributionPeriod === 'monthly' ? 'month' : 'year'}`;
	}
} );

module.exports.schema.virtual( 'nextContributionAmount' ).get( function () {
	return this.nextContributionMonthlyAmount &&
		getActualAmount(this.nextContributionMonthlyAmount, this.contributionPeriod);
} );

module.exports.schema.post('find', async function (docs) {
	for (const doc of docs) {
		doc.permissions = await getRepository(MemberPermission).find({memberId: doc.id});
	}
});

module.exports.schema.post('findOne', async function (doc) {
	doc.permissions = await getRepository(MemberPermission).find({memberId: doc.id});
});

module.exports.model = mongoose.model( module.exports.name, module.exports.schema );
