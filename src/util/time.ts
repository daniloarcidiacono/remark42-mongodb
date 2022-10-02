import { ReplacerFunction, ReviverFunction } from '@util/duration';

/**
 * Helper class for handling time similar to Go.
 */
export class Time {
	date: Date;

	public constructor(value: string) {
		// https://mariusschulz.com/blog/deserializing-json-strings-as-javascript-date-objects
		this.date = new Date(value);
	}

	static zero(): Time {
		return new Time('0001-01-01T00:00:00.000Z');
	}

	static now(): Time {
		return new Time(new Date().toJSON());
	}

	addDays(days: number): Time {
		// https://stackoverflow.com/a/563442
		const resultDate: Date = new Date(this.date.getTime());
		resultDate.setDate(resultDate.getDate() + days);
		return new Time(resultDate.toJSON());
	}

	isZero(): boolean {
		return this.date.toJSON() === '0001-01-01T00:00:00.000Z';
	}

	before(other: Time): boolean {
		return this.date < other.date;
	}

	public static REPLACER =
		(f?: ReplacerFunction): ReplacerFunction =>
		(key, value) => {
			if (value instanceof Time) {
				return value.date.toJSON();
			}

			return f ? f(key, value) : value;
		};

	public static REVIVER =
		(keys: string[], f?: ReviverFunction): ReviverFunction =>
		(key, value) => {
			// https://mariusschulz.com/blog/deserializing-json-strings-as-javascript-date-objects
			if (keys.includes(key) && typeof value === 'string') {
				const valueDate = new Date(value).getTime();

				if (!isNaN(valueDate)) {
					return new Time(value);
				}
			}

			return f ? f(key, value) : value;
		};
}
