**Setup**

The code was setup to run off a MySql database. While I've been running it locally, there is no reason why it wouldn't work with a cloud based one either. I've been using Postman as part of my local dev process to run and test the code. Once you have a functioning database, you'll need to call `/generateSchema` and `/populateTables` to setup and seed it. After that, run `npm install` to install all local dependencies. You may need to install some of them globally depending on how you're running the code. For my local dev process, the full command looks like the following:```nodemon --exec ts-node app.ts --port=2000 --host="localhost" --user="root" --password="password" --database="fillout" --secret="provided_secret"```

**Required CLI arguments**

`--port` : this is the port the server is running on. Defaults to `3000`.

`--host`: this is the machine the server is running on.

`--user`: this the the username that has read/write access to the database.

`--password`: this is the database password for the database user.

`--database`: this is the name of the database.

`--secret`: the secret required to fetch data from Fillout remote api.

**Types**

```
type FilterClauseType = {
	id: string;
	condition: 'equals' | 'does_not_equal' | 'greater_than' | 'less_than';
	value: number | string;
}
```


**Public Api**

`/generateSchema`: generates all the table schemas in the database.

`/populateTables`: populates all the seed data from the remote api provided by Fillout.

`/:formId/filteredResponses`: Fetches a filter list of submissions / questions based on the provided filters. All parameters that cause filtering to occur are expected to be passed in as a url query parameter. Please see `Query Parameters` section below for keys that are accepted.

**Query Parameters**

`afterDate`: an iso date string that represents filtering that should occur on all submissions after the given date.

`beforeDate`: an iso date string that represents filtering that should occur on all submissions before the given date.

`includeEditLink`: a boolean value that indicates where this property should be included on filtered submissions. Defaults to `false`.

`limit`: How many submissions should be included. Defaults to `150`.

`offset` What the offset of the query should be. Defaults to `0`.

`sort`: What order the submissions should be sorted on. Defaults to `asc`.

`filters`: An array of `FilterClauseType` that determines how filtering should apply to individual records. Any invalid filters are rejected. No filters being passed through or all invalid ones results in no filters being applied.