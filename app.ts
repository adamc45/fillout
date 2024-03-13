import express, { Express, Request, Response } from 'express';
import minimist, { ParsedArgs } from 'minimist';
import  mysql, { Pool }  from 'mysql2/promise';
import { Api, Schema } from './src/core/';
  
const app: Express = express();

const argv: ParsedArgs = minimist(process.argv.slice());
const port = argv.port || 3000
const secret = argv.secret || '';
const host = argv.host || '';
const user = argv.user || '';
const password = argv.password || '';
const database = argv.database || ''

const pool: Pool = mysql.createPool({
    host: host,
    user: user,
    password: password,
    database: database
});

app.get('/:formId/filteredResponses', async (request: Request, response: Response) => {
	Api.getFilteredResponse(pool, request, response);
})

app.post('/generateSchema', async (request: Request, response: Response) => {
	Schema.generateSchema(pool, response);
});

app.post('/populateTables', async (req: Request, response: Response) => {
	Schema.populateTables(pool, response, secret);
})
  
app.listen(port, async () => {
	  console.log(`Server is Running and App is listening on port ${port}`)
});