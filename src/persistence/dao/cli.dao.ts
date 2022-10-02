import { Locator } from '@remark42/dto/store.dto';
import { PostSubDocument, SiteDocument } from '@persistence/entity/site.entity';
import { MongoClient, MongoServerError } from 'mongodb';
import { StoreMongoDAO } from './store.dao';
import { getSitesCollection } from './utils';

export abstract class CLIMongoDAO {
	/**
	 * Lists all the sites.
	 *
	 * @param client the mongodb client
	 * @returns
	 */
	public static async listSites(client: MongoClient): Promise<SiteDocument[]> {
		const sitesCollection = getSitesCollection(client);
		return await sitesCollection.find({}, { projection: { key: 0, posts: 0 } }).toArray();
	}

	/**
	 * Creates a new site.
	 *
	 * @param client the mongodb client
	 * @param name the site name
	 * @param key the site encryption key
	 * @param adminEmail the site administrator email
	 */
	public static async createSite(client: MongoClient, name: string, key: string, adminEmail: string): Promise<void> {
		const sitesCollection = getSitesCollection(client);

		try {
			// Note: this relies on (cid, locator.site, locator.url) unique index!
			await sitesCollection.insertOne({
				_id: name,
				key,
				enabled: true,
				adminEmail,
				posts: []
			});
		} catch (e) {
			if (e instanceof MongoServerError && e.code === 11000) {
				// Duplicate key
				throw `Site ${name} already exists!`;
			}

			// Other errors
			throw e;
		}
	}

	/**
	 * Checks whether data for a specific site exists.
	 *
	 * @param client the mongodb client
	 * @param site the site name
	 */
	public static async siteExists(client: MongoClient, site: string): Promise<boolean> {
		return StoreMongoDAO.siteExists(client, site);
	}

	/**
	 * Lists all posts of a site.
	 *
	 * @param client the mongodb client
	 * @param site the site identifier
	 * @returns
	 */
	public static async listPosts(client: MongoClient, site: string): Promise<PostSubDocument[]> {
		const sitesCollection = getSitesCollection(client);
		const siteDocument: SiteDocument = await sitesCollection.findOne({ _id: site }, { projection: { posts: 1 } });
		return siteDocument ? siteDocument.posts : [];
	}

	/**
	 * Creates a new post.
	 * <p>Note: this method assumes that the site exists and the posts does not!
	 *
	 * @param client the mongodb client
	 * @param locator the post locator
	 * @param readOnly read-only flag
	 */
	public static async createPost(client: MongoClient, locator: Locator, readOnly: boolean = false): Promise<void> {
		return StoreMongoDAO.createPost(client, locator, readOnly);
	}
}
