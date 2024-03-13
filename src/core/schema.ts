import { Response } from 'express';
import { uniqBy } from 'lodash';
import { Pool, PoolConnection }  from 'mysql2/promise';
import { externalResults, sqlClause } from '../interfaces/';
import { Api } from './api';
import { Question } from './question';
import { Submission } from './submission';
import { mergeBoundParams } from '../utilities/';

export class Schema {

	public static async generateSchema(pool: Pool, response: Response): Promise<Response> {
		const connection: PoolConnection = await pool.getConnection();
		try {
			await connection.beginTransaction();
			await connection.query(`CREATE TABLE IF NOT EXISTS submission
				(
					submission_id varchar(50) PRIMARY KEY,
					submission_time datetime,
					last_updated_at datetime,
					edit_link varchar(200),
					status_id int,
					INDEX IX_STATUS (status_id),
					INDEX IX_LAST_UPDATED_AT (last_updated_at),
					INDEX IX_SUBMISSION_TIME (submission_time)
				)`
			);
			await connection.query(`CREATE TABLE IF NOT EXISTS question
				(
					id varchar(50) PRIMARY KEY,
					name varchar(200),
					type varchar(50)
				)`
			);
			await connection.query(`CREATE TABLE IF NOT EXISTS status (
				  id int AUTO_INCREMENT PRIMARY KEY,
				  type varchar(45) DEFAULT NULL
				)`
			);
			await connection.query(`CREATE TABLE IF NOT EXISTS answer (
				  submission_id varchar(50),
				  question_id varchar(50),
				  value varchar(200),
				  INDEX IX_SUBMISSION_ID_QUESTION_ID (submission_id, question_id)
				)`
			);
			connection.commit();
			return response
				.json({message: 'Successfully created tables'})
				.send();
		} catch(e) {
			await connection.rollback();
			return response
				.status(500)
				.json({message: `Failed to generate tables. The following error was encountered: ${e}.`})
				.send();
		}
	}

	public static async populateTables(pool: Pool, response: Response, secret: string): Promise<Response> {
		const connection = await pool.getConnection();
		try {
			await connection.beginTransaction();
			const seedData: externalResults<Submission> = await Api.getExternalData(secret);
			if (seedData.hasError) {
				return response
					.status(500)
					.json({message: 'Failed to fetch seed data'})
					.send();
			}
			const submissionSqlClauses: sqlClause<string | undefined>[] = seedData.data.map((submission: Submission) => {
				return submission.getInsertionClause()
			});
			const submissionSql: string = submissionSqlClauses.map((clause: sqlClause<string | undefined>) => clause.sql)
				.join(', ');
			const submissionBoundParams: (string | undefined)[] = mergeBoundParams(submissionSqlClauses);
			const answerSqlClauses: sqlClause<string | number | null>[] = seedData.data
				.reduce((mergedList: sqlClause<(string | number | null)>[], submission: Submission) => {
					const clauses = submission.questions.map((question: Question) => question.answer.getInsertionClause());
					return [...mergedList, ...clauses];
				}, []);
			const answerSql: string = answerSqlClauses.map((clause: sqlClause<string | number | null>) => clause.sql)
				.join(', ');
			const answerBoundParams: (string | number | null)[] = mergeBoundParams(answerSqlClauses);
			const questions : Question[] = seedData.data.reduce((questions: Question[], submission: Submission) => {
				return [...submission.questions, ...questions];
			}, [])
			const questionSqlClauses: sqlClause<string | undefined | null>[] = uniqBy(questions, 'id')
				.reduce((mergedList: sqlClause<(string | undefined | null)>[], question: Question) => {
					return [...mergedList, question.getInsertionClause()];
				}, []);
			const questionSql: string = questionSqlClauses.map((clause: sqlClause<string | undefined | null>) => clause.sql)
				.join(', ');
			const questionBoundParams: (string | undefined | null)[] = mergeBoundParams(questionSqlClauses);
			await connection.query(
				`insert into submission (submission_id, submission_time, last_updated_at, edit_link, status_id) values
					${submissionSql}`, submissionBoundParams
			);
			await connection.query(
				`insert into question (id, name, type) values
				${questionSql}`, questionBoundParams
			);
			await connection.query(
				`insert into answer (submission_id, question_id, value) values
				${answerSql}`, answerBoundParams
			);
			connection.commit();
			return response
				.json({message: 'Successfully populated tables'})
				.send();
		} catch(e) {
			await connection.rollback();
			return response
				.status(500)
				.json({message: `Failed to populate tables for the following reason: ${e}`})
				.send();
		}
	}
}
