declare module 'passport-totp' {
	import { Strategy as PassportStrategy } from 'passport-strategy';

	interface TotpOptions {
		window: number
	}

	interface TotpVerifyFunction {
		(user: unknown, done: (error: any, key?: string|false, period?: number) => void): void
	}

	export class Strategy extends PassportStrategy {
		constructor(verify: TotpVerifyFunction)
		constructor(opts: TotpOptions, verify: TotpVerifyFunction)
	}
}
