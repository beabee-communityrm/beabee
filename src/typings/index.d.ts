import { Member } from '@models/members';

declare global {
	type IfEquals<X, Y, A, B> =
		(<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? A : B;

	type WritableKeysOf<T> = {
			[P in keyof T]: IfEquals<{ [Q in P]: T[P] }, { -readonly [Q in P]: T[P] }, P, never>
	}[keyof T];

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
