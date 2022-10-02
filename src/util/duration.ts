/**
 * A Duration represents the elapsed time between two instants as an int64 nanosecond count.
 * The representation limits the largest representable duration to approximately 290 years.
 *
 * @see <a href="https://pkg.go.dev/time#Duration">Go: time.Duration</a>
 */
export type ReviverFunction = (key: string, value: any) => any;
export type ReplacerFunction = (key: string, value: any) => any;

export class Duration {
	ns: number;

	public constructor(value: string) {
		this.ns = Number(value);
	}

	public gt(ns: number): boolean {
		return this.ns > ns;
	}

	public static REPLACER =
		(f?: ReplacerFunction): ReplacerFunction =>
		(key, value) => {
			if (value instanceof Duration) {
				return value.ns;
			}

			return f ? f(key, value) : value;
		};

	public static REVIVER =
		(keys: string[], f?: ReviverFunction): ReviverFunction =>
		(key, value) => {
			// https://mariusschulz.com/blog/deserializing-json-strings-as-javascript-date-objects
			if (keys.includes(key) && typeof value === 'string') {
				if (!isNaN(Number(value))) {
					return new Duration(value);
				}
			}

			return f ? f(key, value) : value;
		};
}
