// From https://github.com/sindresorhus/yn/blob/main/index.js
export default function yn(value: any, { default: default_ }: { default?: boolean } = {}): boolean {
	if (default_ !== undefined && typeof default_ !== 'boolean') {
		throw new TypeError(`Expected the \`default\` option to be of type \`boolean\`, got \`${typeof default_}\``);
	}

	if (value === undefined || value === null) {
		return default_;
	}

	value = String(value).trim();

	if (/^(?:y|yes|true|1|on)$/i.test(value)) {
		return true;
	}

	if (/^(?:n|no|false|0|off)$/i.test(value)) {
		return false;
	}

	return default_;
}
