import { sqlClause } from '../interfaces/';
import { isNullOrUndefined } from './is-null-or-undefined';

export function mergeBoundParams<T>(clauses: sqlClause<T>[]): T[] {
	if (isNullOrUndefined(clauses)) {
		return [];
	}
	return clauses.reduce((mergedList: T[], clause: sqlClause<T>) => {
		return [...mergedList, ...clause.boundParams];
	}, []);
}
