import { pick } from 'lodash';

export class DatabaseModel {

	constructor(from: any) {
		Object.assign(this, from);
	}

	protected assignFromDatabaseColumns(from: any, mappings: Map<string, keyof this>) {
		Object.keys(from)
			.filter((key: string) => mappings.has(key))
			.map((key: string) => {
				const modelKey: keyof this | undefined = mappings.get(key);
				if (modelKey === undefined) {
					return;
				}
				this.setKey(modelKey, from[key]);
			});
	}

	public getFilteredModel(keys: (keyof this)[]): object {
		return pick(this, keys)
	}

	private setKey<K extends keyof this>(key: K, value: this[K]) {
		this[key] = value;
	}

}