import ActiveMembersExport from './ActiveMembersExport';
import EditionExport from './EditionExport';
import GiftsExport from './GiftsExport';
import ReferralsExport from './ReferralsExport';

export default {
	'active-members': ActiveMembersExport,
	'edition': EditionExport,
	'gifts': GiftsExport,
	'referrals': ReferralsExport
} as const;
