import 'module-alias/register';

import inquirer, { QuestionCollection } from 'inquirer';
import moment from 'moment';

import config from '@config';

import Auth from '@core/authentication';
import * as db from '@core/database';
import { ConnectionOptions, getRepository } from 'typeorm';
import { Member } from '@models/members';
import MemberPermission from '@models/MemberPermission';

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
		return Auth.passwordRequirements( s );
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

	const password = await Auth.generatePasswordPromise(answers.password);

	const user = {
		firstname: answers.firstname,
		lastname: answers.lastname,
		email: answers.email,
		password: {
			hash: password.hash,
			salt: password.salt,
			iterations: password.iterations
		}
	};

	const member = await new db.Members(user).save();

	if ( answers.membership != 'No' ) {
		const memberPermission = new MemberPermission();
		memberPermission.permission = 'member';
		memberPermission.memberId = member.id;

		const now = moment();
		switch ( answers.membership ) {
		case 'Yes (expires after 1 month)':
			memberPermission.dateExpires = now.add( '1', 'months' ).toDate();
			break;
		case 'Yes (expired yesterday)':
			memberPermission.dateAdded = now.subtract( '1', 'months' ).toDate();
			memberPermission.dateExpires = now.subtract( '1', 'day' ).toDate();
			break;
		}

		await getRepository(MemberPermission).save(memberPermission);
	}

	if ( answers.permission != 'None' ) {
		const adminPermission = new MemberPermission();
		adminPermission.memberId = member.id;

		switch ( answers.permission ) {
		case 'Admin':
			adminPermission.permission = 'admin';
			break;
		case 'Super Admin':
			adminPermission.permission = 'superadmin';
			break;
		}

		await getRepository(MemberPermission).save(adminPermission);
	}

	await db.close();
} );
