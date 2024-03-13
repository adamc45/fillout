import { sqlClause } from '../interfaces/';
import { IsoDateTransformer } from '../utilities/';
import { DatabaseModel } from './database-model';

const mappings: Map<string, keyof Answer> = new Map([
	[
		'submission_id', 'submissionId'
	],
	[
		'question_id', 'questionId'
	]
]);

export class Answer extends DatabaseModel {

	public submissionId!: string;

	public questionId!: string;

	public value!: string | number;

	constructor(from: any) {
		super(from);
		this.assignFromDatabaseColumns(from, mappings);
	}

	public getInsertionClause(): sqlClause<string | number | null> {
		return {
			boundParams: [this.submissionId, this.questionId, this.getValue()],
			sql: '(?, ?, ?)'
		};
	}

	public getValue(): string | null {
		if (this.value === null) {
			return this.value
		}
		if (typeof this.value === 'string') {
			return IsoDateTransformer.transformFromIsoDate(this.value)
		}
		return this.value.toString();
	}

}