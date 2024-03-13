export interface sqlClause<T> {

	boundParams: T[];

	sql: string;

}
