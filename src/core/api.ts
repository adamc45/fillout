import { Request, Response } from 'express';
import { FieldPacket, Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { ParsedQs } from 'qs';
import { externalResults, rowCount, sqlClause } from '../interfaces/';
import { mergeBoundParams } from '../utilities/';
import { Answer } from './answer';
import { Question } from './question';
import { SqlFilter } from './sql-filter';
import { SqlMeta } from './sql-meta';
import { Submission } from './submission';

interface partiallyTypedResult {
	questions: object[];
}

interface partiallyTypedResponse {
	responses: partiallyTypedResult[]
}

interface partiallyTypedSubmission {

	submission_id: string;

	question_ids: string;

}

export class Api {

	public static async getExternalData(secret: string): Promise<externalResults<Submission>> {
		try {
			const finishedSubmissions: globalThis.Response = await fetch('https://api.fillout.com/v1/api/forms/cLZojxk94ous/submissions?includeEditLink=true', {
				headers: {
					'Authorization': `Bearer ${secret}`
				}
			});
			const incompleteSubmissions: globalThis.Response = await fetch('https://api.fillout.com/v1/api/forms/cLZojxk94ous/submissions?includeEditLink=true&status=in_progress', {
				headers: {
					'Authorization': `Bearer ${secret}`
				}
			});
			const finishedResults: partiallyTypedResponse = await finishedSubmissions.json();
			const incompleteResults: partiallyTypedResponse = await incompleteSubmissions.json();
			const finished: Submission[] = finishedResults.responses.map((result: partiallyTypedResult) => {
				const submission: Submission = new Submission({...result, status_id: 1});
				submission.questions = result.questions.map((q: object) => {
					const question: Question = new Question({...q, submissionId: submission.submissionId});
					question.answer = new Answer({questionId: question.id, submissionId: submission.submissionId, value: question.value});
					return question;
				});
				return submission;
			});
			const inncomplete: Submission[] = incompleteResults.responses.map((result: partiallyTypedResult) => {
				const submission: Submission = new Submission({...result, status_id: 0});
				submission.questions = result.questions.map((q: object) => {
					const question: Question = new Question({...q, submissionId: submission.submissionId});
					question.answer = new Answer({questionId: question.id, submissionId: submission.submissionId, value: question.value});
					return question;
				});
				return submission;
			});
			return {
				hasError: false,
				data: [...finished, ...inncomplete]
			};
		} catch (e) {
			return {
				hasError: true,
				data: []
			};
		}
	}

	public static async getFilteredResponse(pool: Pool, request: Request, response: Response): Promise<Response> {
		const { filters } = request.query;
		const queryFilters = (filters || []) as ParsedQs[];
		const actualFilters: SqlFilter[] = queryFilters
			.map((filter: ParsedQs) => {
				return new SqlFilter(filter);
			})
			.filter((filter: SqlFilter) => filter.isValidFilter());
		const sqlMeta: SqlMeta = new SqlMeta(request.query);
		const limitSqlClause: sqlClause<string> = sqlMeta.getLimitSqlClause();
		const orderBySqlClause: sqlClause<string> = sqlMeta.getOrderBySqlClause('submission.submission_time');
		const afterDateSqlClause: sqlClause<string> = sqlMeta.getAfterDateSqlClause('submission.submission_time');
		const beforeDateSqlClause: sqlClause<string> = sqlMeta.getBeforeDateSqlClause('submission.submission_time');
		const statusSqlClause: sqlClause<string> = sqlMeta.getStatusSqlClause('submission.status_id');
		const includeEditLink: boolean = sqlMeta.getIncludeEditLink();
		if (actualFilters.length === 0) {
			return Api.getUnfilteredResponse(pool, request, response, limitSqlClause, orderBySqlClause, afterDateSqlClause, beforeDateSqlClause, statusSqlClause, includeEditLink);
		}
		const sqlClauses: sqlClause<string | number>[] = actualFilters.map((filter: SqlFilter) => filter.getCaseClause('answer.value', 'question.id'));
		const switchCaseSql: string = sqlClauses
			.map((clause: sqlClause<string | number>) => clause.sql)
			.join(' OR ');
		const boundParams: (string | number)[] = mergeBoundParams(sqlClauses);
		const connection: PoolConnection = await pool.getConnection();
		try {
			const questionIds: string[] = actualFilters.map((filter: SqlFilter) => `'${filter.id}'`);
			const questionIdInSql: string = `(${questionIds.join(', ')})`;
			// unfiltered rows based on the passed in filters
			const rows: [RowDataPacket[], FieldPacket[]] = await connection.query(`
				select submission.submission_id, group_concat(DISTINCT question.id) as question_ids from submission
				join answer on answer.submission_id = submission.submission_id
				join question on question.id = answer.question_id
				where ${statusSqlClause.sql} AND question.id in ${questionIdInSql}
				group by submission.submission_id`,
				statusSqlClause.boundParams
			);
			const receivedData: partiallyTypedSubmission[] = rows[0] as partiallyTypedSubmission[];
			if (receivedData.length === 0) {
				return response
					.json({data: []})
					.send();
			}
			const counts: rowCount[] = receivedData.map((row: partiallyTypedSubmission): rowCount => {
				return {
					count: row.question_ids.split(',').length,
					id: row.submission_id
				};
			});
			const havingSqlClause: sqlClause<string> = SqlFilter.getHavingClause('answer.submission_id', actualFilters, counts);
			// All the matched submissions once filtering is applied
			const queriedSubmissions: [RowDataPacket[], FieldPacket[]] = await connection.query(`
				select *, group_concat(DISTINCT question.id) as question_ids from submission
				join answer on answer.submission_id = submission.submission_id
				join question on question.id = answer.question_id
				where ${switchCaseSql}
				group by submission.submission_id having ${havingSqlClause.sql} ${orderBySqlClause.sql} ${limitSqlClause.sql}`,
				mergeBoundParams([...sqlClauses, havingSqlClause, orderBySqlClause, limitSqlClause])
			);
			const submissions: object[] = await Api.getSubmissions(connection, queriedSubmissions[0], includeEditLink);
			return response
				.json({data: submissions})
				.send();
		} catch(e) {
			return response
				.status(500)
				.json({message: `Encountered an error when trying to query for results. The issue encountered was: ${e}`})
				.send();
		}
	}

	public static async getQuestionsById(connection: PoolConnection, rows: partiallyTypedSubmission[]): Promise<RowDataPacket[]> {
		if (rows.length === 0) {
			return [];
		}
		const questionSqlClauses: sqlClause<string>[] = rows
			.reduce((ids: string[], row: partiallyTypedSubmission) => {
				const questionIds: string[] = row.question_ids
					.replace('(', '')
					.replace(')', '')
					.split(',');
				return [...ids, ...questionIds];
			}, [])
			.map((id: string) => {
				return { sql: '?', boundParams: [id]};
			});
		const submissionSqlClauses: sqlClause<string>[] = rows.map((row: partiallyTypedSubmission) => {
			return { sql: '?', boundParams: [row.submission_id]};
		});
		const questionIdSql: string[] = questionSqlClauses.map((clause: sqlClause<string>) => clause.sql);
		const questionIdInSql: string = `(${questionIdSql.join(',')})`;
		const submissionSql: string[] = submissionSqlClauses.map((clause: sqlClause<string>) => clause.sql);
		const submissionIdInSql: string = `(${submissionSql.join(',')})`
		const queriedQuestions: [RowDataPacket[], FieldPacket[]] = await connection.query(`
			select DISTINCT answer.question_id as id, question.name, question.type, answer.submission_id, answer.value from question
			join answer on answer.question_id = question.id
			where answer.question_id in ${questionIdInSql} AND answer.submission_id in ${submissionIdInSql}`,
			mergeBoundParams([...questionSqlClauses, ...submissionSqlClauses])
		);
		return queriedQuestions[0];
	}

	public static async getSubmissions(connection: PoolConnection, queriedSubmissions: RowDataPacket[], includeEditLink: boolean): Promise<object[]> {
		const submissionLookup: Map<string, Submission> = new Map();
		const questionLookup: Map<string, Question[]> = new Map();
		const receivedQuestions: RowDataPacket[] = await Api.getQuestionsById(connection, queriedSubmissions as partiallyTypedSubmission[]);
		const questions: Question[] = receivedQuestions.map((row: object) => {
			const question: Question = new Question(row);
			question.answer = new Answer(row);
			return question;
		});
		queriedSubmissions.map((row: object) => {
			const submission = new Submission(row);
			submissionLookup.set(submission.submissionId, submission);
		});
		questions.map((question: Question) => {
			const lookup: Question[] | undefined = questionLookup.get(question.answer.submissionId);
			if (lookup !== undefined) {
				lookup.push(question);
			} else {
				questionLookup.set(question.answer.submissionId, [question]);
			}
		});
		const submissions: object[] = Array.from(submissionLookup.values()).map((submission: Submission) => {
			const retrievedQuestions: Question[] | undefined = questionLookup.get(submission.submissionId);
			const keys: (keyof Submission)[] = ['calculations', 'documents', 'questions', 'quiz', 'urlParameters', 'submissionId', 'submissionTime', 'lastUpdatedAt'];
			if (includeEditLink) {
				keys.push('editLink');
			}
			const returnedSubmission: object = submission.getFilteredModel(keys);
			if (retrievedQuestions === undefined) {
				return returnedSubmission;
			}
			submission.questions = retrievedQuestions.map((question: Question) => {
				return new Question({id: question.id, name: question.name, type: question.type, value: question.value});
			});
			return Object.assign(returnedSubmission, { questions: submission.questions });
		});
		submissionLookup.clear();
		questionLookup.clear();
		return submissions;
	}

	public static async getUnfilteredResponse(
		pool: Pool,
		request: Request,
		response: Response,
		limitSqlClause: sqlClause<string>,
		orderBySqlClause: sqlClause<string>,
		afterDateSqlClause: sqlClause<string>,
		beforeDateSqlClause: sqlClause<string>,
		statusSqlClause: sqlClause<string>,
		includeEditLink: boolean
	): Promise<Response> {
		const connection: PoolConnection = await pool.getConnection();
		try {
			const queriedSubmissions: [RowDataPacket[], FieldPacket[]] = await connection.query(`
				select answer.submission_id, submission.submission_time, submission.last_updated_at, group_concat(DISTINCT question.id) as question_ids from submission
				join answer on answer.submission_id = submission.submission_id
				join question on question.id = answer.question_id
				where ${statusSqlClause.sql} AND ${afterDateSqlClause.sql} AND ${beforeDateSqlClause.sql}
				group by submission.submission_id ${orderBySqlClause.sql} ${limitSqlClause.sql}`,
				mergeBoundParams([statusSqlClause, afterDateSqlClause, beforeDateSqlClause, orderBySqlClause, limitSqlClause])
			);
			const submissions: object[] = await Api.getSubmissions(connection, queriedSubmissions[0], includeEditLink);
			return response
				.json({data: submissions})
				.send();
		} catch(e) {
			return response
				.status(500)
				.json({message: `Encountered an error when trying to query for results. The issue encountered was: ${e}`})
				.send();
		}
	}
}
