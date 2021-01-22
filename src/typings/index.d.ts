import { Member } from '@models/members';
import { ParamsDictionary } from 'express-serve-static-core';

declare global {
	type IfEquals<X, Y, A, B> =
		(<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? A : B;

	type WritableKeysOf<T> = {
			[P in keyof T]: IfEquals<{ [Q in P]: T[P] }, { -readonly [Q in P]: T[P] }, P, never>
	}[keyof T];

	namespace Express {
		export interface User extends Member {
			quickPermissions: string[]
		}

		export interface Request {
			flash(level: 'info'|'success'|'warning'|'error'|'danger', message: string): void
			model: unknown
			csrfToken?(): string
			allParams: ParamsDictionary
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
