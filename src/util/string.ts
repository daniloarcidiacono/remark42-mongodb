export function isBlank(str: string | undefined | null): boolean {
	return str === undefined || str === null || str.trim().length === 0;
}
