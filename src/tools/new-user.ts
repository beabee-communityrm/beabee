import 'module-alias/register';

import inquirer, { QuestionCollection } from 'inquirer';
import moment from 'moment';
import { ConnectionOptions, getRepository } from 'typeorm';

import * as db from '@core/database';
import { ContributionType } from '@core/utils';
import { generatePassword, passwordRequirements } from '@core/utils/auth';

import MembersService from '@core/services/MembersService';

import config from '@config';

import MemberPermission from '@models/MemberPermission';
import Member from '@models/Member';

const questions: QuestionCollection[] = [];

// First Name
questions.push( {
	type: 'input',
	name: 'firstname',
	message: 'First Name',
	validate: function( s ) {
		return ( s.trim() === '' ? 'You must enter a first name' : true );
	}
} );

// Last Name
questions.push( {
	type: 'input',
	name: 'lastname',
	message: 'Last Name',
	validate: function( s ) {
		return ( s.trim() === '' ? 'You must enter a last name' : true );
	}
} );

// Email address
questions.push( {
	type: 'input',
	name: 'email',
	message: 'Email Address',
	validate: function( s ) {
		return ( s.trim() === '' ? 'You must enter an email address' : true );
	}
} );

// Password
questions.push( {
	type: 'password',
	name: 'password',
	message: 'Password',
	validate: function( s ) {
		return passwordRequirements( s );
	}
} );

// Member
questions.push( {
	type: 'list',
	name: 'membership',
	message: 'Would you like to grant membership to the user?',
	choices: [ 'Yes', 'Yes (expires after 1 month)', 'Yes (expired yesterday)', 'No' ],
	default: 'Yes'
} );

// Level question
questions.push( {
	type: 'list',
	name: 'permission',
	message: 'What level of access do you wish to grant this new user?',
	choices: [ 'None', 'Admin', 'Super Admin' ],
	default: 'Super Admin'
} );


db.connect(config.mongo, config.db as ConnectionOptions).then(async () => {
	const answers = await inquirer.prompt( questions );

	const password = await generatePassword(answers.password);

	const member = await MembersService.createMember({
		firstname: answers.firstname,
		lastname: answers.lastname,
		email: answers.email,
		contributionType: ContributionType.None,
		password: {
			hash: password.hash,
			salt: password.salt,
			iterations: password.iterations,
			tries: 0
		},
	}, {
		deliveryOptIn: false
	});

	if ( answers.membership != 'No' ) {
		const membership = new MemberPermission();
		membership.permission = 'member';

		const now = moment();
		switch ( answers.membership ) {
		case 'Yes (expires after 1 month)':
			membership.dateExpires = now.add( '1', 'months' ).toDate();
			break;
		case 'Yes (expired yesterday)':
			membership.dateAdded = now.subtract( '1', 'months' ).toDate();
			membership.dateExpires = now.subtract( '1', 'day' ).toDate();
			break;
		}

		member.permissions.push(membership);
	}

	if ( answers.permission != 'None' ) {
		const adminPermission = new MemberPermission();

		switch ( answers.permission ) {
		case 'Admin':
			adminPermission.permission = 'admin';
			break;
		case 'Super Admin':
			adminPermission.permission = 'superadmin';
			break;
		}

		member.permissions.push(adminPermission);
	}

	await getRepository(Member).save(member);

	await db.close();
} );
