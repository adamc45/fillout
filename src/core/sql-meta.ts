import { submissionStatus } from '../enums/';
import { sqlClause } from '../interfaces/';
import { IsoDateTransformer } from '../utilities/';

export class SqlMeta {

	private defaultIncludeEditLink: boolean = false;

	private defaultLimit: string = '150';

	private defaultOffset: string = '0';

	private defaultSort: string = 'asc';

	private defaultStatus: string = '1';

	public afterDate!: string;

	public beforeDate!: string;

	public includeEditLink!: boolean;

	public limit!: string;

	public offset!: string;

	public sort!: string;

	public status!: submissionStatus;

	constructor(from: any) {
		Object.assign(this, from);
	}

	public getBeforeDateSqlClause(columnName: string): sqlClause<string> {
		if (IsoDateTransformer.isIsoDate(this.beforeDate)) {
			return {
				boundParams: [IsoDateTransformer.transformFromIsoDate(this.beforeDate)],
				sql: `${columnName} < ?`
			};
		}
		return {
			boundParams: [],
			sql: '1'
		};
	}

	public getAfterDateSqlClause(columnName: string): sqlClause<string> {
		if (IsoDateTransformer.isIsoDate(this.afterDate)) {
			return {
				boundParams: [IsoDateTransformer.transformFromIsoDate(this.afterDate)],
				sql: `${columnName} > ?`
			};
		}
		return {
			boundParams: [],
			sql: '1'
		};
	}

	public getIncludeEditLink(): boolean {
		if (typeof this.includeEditLink === 'boolean') {
			return this.includeEditLink;
		}
		if (typeof this.includeEditLink === 'string' && this.includeEditLink === 'true') {
			return true;
		}
		return this.defaultIncludeEditLink;
	}

	public getLimitSqlClause(): sqlClause<string> {
		const parsedLimit: number = parseInt(this.limit);
		const parsedOffset: number = parseInt(this.offset);
		if (isNaN(parsedLimit) && isNaN(parsedOffset)) {
			return {
				boundParams: [],
				sql: `LIMIT ${this.defaultOffset},${this.defaultLimit}`
			};
		}
		if (isNaN(parsedLimit) && !isNaN(parsedOffset)) {
			return {
				boundParams: [],
				sql: `LIMIT ${parsedOffset},${this.defaultLimit}`
			};
		}
		if (!isNaN(parsedLimit) && isNaN(parsedOffset)) {
			return {
				boundParams: [],
				sql: `LIMIT ${this.defaultOffset},${parsedLimit}`
			};
		}
		return {
			boundParams: [],
			sql: `LIMIT ${parsedOffset},${parsedLimit}`
		};
	}

	public getOrderBySqlClause(columnName: string): sqlClause<string> {
		if (this.sort === 'asc' || this.sort === 'desc') {
			return {
				boundParams: [],
				sql: `ORDER BY ${columnName} ${this.sort}`
			};
		}
		return {
			boundParams: [],
			sql: `ORDER BY ${columnName} ${this.defaultSort}`
		};
	}

	public getStatusSqlClause(columnName: string): sqlClause<string> {
		if (this.status === submissionStatus.FINISHED) {
			return {
				boundParams: ['1'],
				sql: `${columnName} = ?`
			};
		}
		if (this.status === submissionStatus.IN_PROGRESS) {
			return {
				boundParams: ['0'],
				sql: `${columnName} = ?`
			}
		}
		return {
			boundParams: [`${this.defaultStatus}`],
			sql: `${columnName} = ?`
		};
	}

}
