import { sqlClause } from '../interfaces/';
import { IsoDateTransformer } from '../utilities/';
import { DatabaseModel } from './database-model';
import { Question } from './question';

const mappings: Map<string, keyof Submission> = new Map([
	[
		'submission_id', 'submissionId'
	],
	[
		'last_updated_at', 'lastUpdatedAt'
	],
	[
		'submission_time', 'submissionTime'
	],
	[
		'edit_link', 'editLink'
	],
	[
		'status_id', 'statusId'
	]
]);

export class Submission extends DatabaseModel {

	public calculations: any[] = [];

	public documents: any[] = [];

	public editLink?: string;

	public lastUpdatedAt!: string;

	public questions: Question[] = [];

	public quiz: object = {};

	public statusId!: number;

	public submissionId!: string;

	public submissionTime!: string;

	public urlParameters: any[] = [];

	constructor(
		from: any
	) {
		super(from)
		this.assignFromDatabaseColumns(from, mappings);
	}

	protected override assignFromDatabaseColumns(from: any, mappings: Map<string, keyof this>) {
		super.assignFromDatabaseColumns(from, mappings);
		this.lastUpdatedAt = IsoDateTransformer.transformFromIsoDate(this.lastUpdatedAt);
		this.submissionTime = IsoDateTransformer.transformFromIsoDate(this.submissionTime);
	}

	public getInsertionClause(): sqlClause<string | undefined> {
		return {
			boundParams: [this.submissionId, this.submissionTime, this.lastUpdatedAt, this.editLink, this.statusId.toString()],
			sql: '(?, ?, ?, ?, ?)'
		};
	}

}
