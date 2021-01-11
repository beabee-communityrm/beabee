import { Member } from '@models/members';

declare global {
	namespace Express {
		// eslint-disable-next-line @typescript-eslint/no-empty-interface
		export interface User extends Member {}

		export interface Request {
			flash(level: 'info'|'success'|'warning'|'error'|'danger', message: string): void
			flash(): Partial<Record<string, string[]>>
			model: unknown
		}
	}
}

declare module 'papaparse' {
	// eslint-disable-next-line @typescript-eslint/no-empty-interface
	interface File {}
}

declare module 'express-session' {
	interface SessionData {
		method?: 'plain' | 'totp';
	}
}
