import { isNullOrUndefined, IsoDateTransformer } from '../utilities/';
import { filterCondition } from '../enums/';
import { rowCount, sqlClause } from '../interfaces/';

const operators: Map<filterCondition, string> = new Map([
	[
		filterCondition.EQUALS, '=',
	],
	[
		filterCondition.LESS_THAN, '<',
	],
	[
		filterCondition.GREATER_THAN, '>',
	],
	[
		filterCondition.DOES_NOT_EQUAL, '!='
	]
])

export class SqlFilter {

	public id!: string;

	public condition!: filterCondition;

	public value!: number | string;

	constructor(
		from: any
	) {
		Object.assign(this, from);
		if (typeof this.value === 'string' && IsoDateTransformer.isIsoDate(this.value)) {
			this.value = IsoDateTransformer.transformFromIsoDate(this.value);
		}
	}

	public getCaseClause(rowValue: string, rowId: string): sqlClause<string | number> {
		// matches negative numbers, floats, and integers
		const numberRegex = `'^\-*[0-9]+\.*[0-9]*$'`;
		const operator: string = this.getOperator();
		// No need to validate since it's expected isValidFilter would have already been called
		return {
			boundParams: [this.id, this.value, this.value, this.value, this.value, this.value, this.value, this.value, this.value, this.value],
			sql: `(
				${rowId} = ? AND
				CASE
					# covers cases where both values are datetimes and when one is / isn't. When they are mismatched. No comparison should occur and they should get filtered out.
					WHEN cast(? as datetime) IS NOT NULL AND cast(${rowValue} as datetime) IS NOT NULL
						THEN if(cast(? as datetime) ${operator} cast(${rowValue} as datetime), 1, 0)
					WHEN cast(? as datetime) IS NULL AND cast(${rowValue} as datetime) IS NOT NULL
						THEN 0
					WHEN cast(? as datetime) IS NOT NULL AND cast(${rowValue} as datetime) IS NULL
						THEN 0
					# covers cases where both values are integers and when one is / isn't. When they are mismatched. No comparison should occur and they should get filtered out.
					WHEN ? REGEXP ${numberRegex} = 1 AND ${rowValue} REGEXP ${numberRegex} = 1
						THEN if(cast(? as unsigned) ${operator} cast(${rowValue} as unsigned), 1, 0)
					WHEN ? REGEXP ${numberRegex} = 0 AND ${rowValue} REGEXP ${numberRegex} = 1
						THEN 0
					WHEN ? REGEXP ${numberRegex} = 1 AND ${rowValue} REGEXP ${numberRegex} = 0
						THEN 0
				# regular string comparison
				ELSE
					IF (? ${operator} ${rowValue}, 1, 0)
				END = 1
			)`
		};
	}

	public static getHavingClause(rowId: string, filters: SqlFilter[], counts: rowCount[]): sqlClause<string> {
		const caseStatements: string[] = counts.map((row: rowCount) => `(${rowId} = ? AND count(*) = ?)`);
		const statement: string = `${caseStatements.join(' OR ')}`;
		const params: string[][] = counts.map((row: rowCount) => [row.id, row.count.toString()]);
		const boundParams: string[] = params.reduce((list: string[], param: string[]) => [...list, ...param], []);
		return {
			boundParams,
			sql: statement
		}
	}

	private getOperator(): string {
		const operator: string | undefined = operators.get(this.condition);
		if (operator === undefined) {
			return '=';
		}
		return operator;
	}

	public isValidFilter(): boolean {
		if (isNullOrUndefined(this.id)) {
			return false;
		}
		const filterConditions: filterCondition[] = [
			filterCondition.EQUALS,
			filterCondition.DOES_NOT_EQUAL,
			filterCondition.GREATER_THAN,
			filterCondition.LESS_THAN
		]
		if (filterConditions.indexOf(this.condition) === -1) {
			return false;
		}
		return true;
	}

}
