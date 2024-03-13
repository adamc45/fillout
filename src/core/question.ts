import { sqlClause } from '../interfaces/';
import { Answer } from './answer';
import { DatabaseModel } from './database-model';

export class Question extends DatabaseModel {

	public answer!: Answer;

	public id!: string;

	public name!: string;

	public type!: string;

	public value!: number | string;

	constructor(from: any) {
		super(from);
	}

	public getInsertionClause(): sqlClause<string | undefined | null> {
		return {
			boundParams: [this.id, this.name, this.type],
			sql: '(?, ?, ?)'
		};
	}

}
