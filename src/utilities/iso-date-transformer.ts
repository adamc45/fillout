import { isNullOrUndefined } from './is-null-or-undefined';

export class IsoDateTransformer {

	public static isoDateMatcher = /^(?<date>[0-9]{4}-[0-9]{2}-[0-9]{2})T(?<time>[0-9]{2}:[0-9]{2}:[0-9]{2})(?:\.[0-9]+Z)$/;

	public static isIsoDate(value: string): boolean {
		return IsoDateTransformer.isoDateMatcher.test(value);
	}

	public static transformFromIsoDate(value: any): string {
		if (value instanceof Date) {
			return IsoDateTransformer.transformFromIsoDate(value.toISOString());
		}
		if (isNullOrUndefined(value)) {
			return value;
		}
		const match: RegExpMatchArray | null = value.match(IsoDateTransformer.isoDateMatcher);
		if (match === null) {
			return value;
		}
		if (match.groups === undefined) {
			return value;
		}
		return `${match.groups.date} ${match.groups.time}`;
	}

}
