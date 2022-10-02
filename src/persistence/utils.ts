import { MongoClient } from 'mongodb';
import { getCommentsCollection, getUsersCollection } from './dao/utils';

// Creates indices
export async function createIndices(client: MongoClient) {
	const comments = getCommentsCollection(client);
	const users = getUsersCollection(client);

	// Create indices
	// Note: indices ensure uniqueness across different documents! See:
	//     - https://www.mongodb.com/docs/v5.0/core/index-unique/#std-label-unique-separate-documents
	//     - https://www.mongodb.com/community/forums/t/unique-key-on-array-fields-in-a-single-document/3453/3
	//     - https://jira.mongodb.org/browse/SERVER-1068
	//
	// Also note that if the index already exists, MongoDB does not recreate it.
	// (see https://www.mongodb.com/docs/manual/reference/method/db.collection.createIndex/#recreating-an-existing-index)
	//
	// prettier-ignore
	return Promise.all([
		comments.createIndex({ locator: 1, cid: 1 }, { unique: true }),
		users.createIndex({ site: 1, uid: 1 }, { unique: true })
	]);
}

/**
 * Checks if the client is connected to the database.
 *
 * @param client the mongodb client
 * @returns true if connected, false otherwise
 * @see <a href="https://stackoverflow.com/a/73476170">Check if mongoDB is connected</a>
 */
export async function isConnected(client: MongoClient): Promise<boolean> {
	const db = client.db();
	if (!db) {
		return false;
	}

	let res;
	try {
		res = await db.admin().ping();
		return res.hasOwnProperty('ok') && res.ok === 1;
	} catch (err) {
		return false;
	}
}
