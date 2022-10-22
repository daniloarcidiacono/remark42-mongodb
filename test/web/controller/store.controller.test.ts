import { Collection, Db, MongoClient } from 'mongodb';
import { StoreMongoController } from '@web/controller/store.controller';
import { FlagTrue, Locator } from '@remark42/dto/store.dto';
import { describe, expect, test } from '@jest/globals';
import { CommentAdapter } from '@persistence/adapter/comment.adapter';
import { UserAdapter } from '@persistence/adapter/user.adapter';
import { getCommentsCollection, getSitesCollection, getUsersCollection } from '@persistence/dao/utils';
import { CommentDocument } from '@persistence/entity/comment.entity';
import { SiteDocument } from '@persistence/entity/site.entity';
import { UserDocument } from '@persistence/entity/user.entity';
import clientPromise from '@persistence/mongodb';
import { createIndices } from '@persistence/utils';
import { Time } from '@util/time';
import { expectAsyncThrows, genComment, genUser } from '../../utils';
import { Duration } from "@util/duration";

jest.mock('@persistence/mongodb', () => ({
	__esModule: true,
	default: MongoClient.connect(global.__MONGO_URI__)
}));

describe('StoreMongoController', () => {
	let client: MongoClient;
	let db: Db;
	let sites: Collection<SiteDocument>;
	let comments: Collection<CommentDocument>;
	let users: Collection<UserDocument>;

	beforeAll(async () => {
		// Connect
		client = await clientPromise;
		db = await client.db(global.__MONGO_DB_NAME__);
		sites = getSitesCollection(client);
		comments = getCommentsCollection(client);
		users = getUsersCollection(client);

		// Create indices
		await createIndices(client);

		// https://github.com/nock/nock/issues/2200
		jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
		jest.setSystemTime(new Date(2020, 3, 1));
	});

	afterAll(async () => {
		jest.useRealTimers();
		await client.close();
	});

	beforeEach(async () => {
		// Setup global options
		global.serverOpts = {
			port: 0,
			hostname: 'localhost',
			database: global.__MONGO_URI__,
			avatars: 'remark_avatars',
			bodyLimit: '1mb',
			logDir: process.cwd(),
			logMaxSize: '8m',
			logMaxFiles: 30,
			dynamicPosts: false
		};

		// prettier-ignore
		await Promise.all([
			sites.deleteMany({}),
			comments.deleteMany({}),
			users.deleteMany({})
		]);
	});

	test('Find works', async () => {
		const storeController: StoreMongoController = new StoreMongoController();

		const c1 = genComment({ cid: 'c1', user: 'u1', time: new Date('2020-09-08T00:00:00Z'), locator: { site: 'remark', url: '127.0.0.1' } });
		const c2 = genComment({ cid: 'c2', user: 'u1', time: new Date('2020-09-08T00:01:00Z'), locator: { site: 'remark', url: '127.0.0.1' } });
		const c3 = genComment({ cid: 'c3', user: 'u2', time: new Date('2020-09-08T00:02:00Z'), locator: { site: 'remark', url: '127.0.0.1' } });

		const u1 = genUser({ uid: 'u1', name: 'User One', site: 'remark' });
		const u2 = genUser({ uid: 'u2', name: 'User Two', site: 'remark' });

		const remarkSite: SiteDocument = {
			_id: 'remark',
			enabled: true,
			key: '12345',
			adminEmail: 'admin@example.com',
			posts: [
				{
					url: '127.0.0.1',
					readOnly: false
				},
				{
					url: '127.0.0.2',
					readOnly: false
				}
			]
		};
		await sites.insertOne(remarkSite);
		await comments.insertMany([
			c1,
			c2,
			c3,
			genComment({
				cid: 'c1',
				user: 'u1',
				locator: {
					site: 'remark',
					url: '127.0.0.2'
				}
			}),
			genComment({
				cid: 'c2',
				user: 'u2',
				locator: {
					site: 'remark',
					url: '127.0.0.2'
				}
			})
		]);
		await users.insertMany([u1, u2]);

		// Unknown site
		await expectAsyncThrows(
			() =>
				storeController.Find({
					locator: { site: 'unknown', url: 'localhost' },
					limit: 0,
					skip: 0
				}),
			'Site not found'
		);

		// Unknown post url
		expect(
			await storeController.Find({
				locator: { site: 'remark', url: 'localhost' },
				limit: 0,
				skip: 0
			})
		).toEqual([]);

		// Note: by default comments are sorted by timestamp in ascending order (oldest first)
		const locator: Locator = { site: 'remark', url: '127.0.0.1' };
		expect(
			await storeController.Find({
				locator,
				limit: 0,
				skip: 0
			})
		).toEqual([
			CommentAdapter.toModel(c1, { user: UserAdapter.toModel(u1) }),
			CommentAdapter.toModel(c2, { user: UserAdapter.toModel(u1) }),
			CommentAdapter.toModel(c3, { user: UserAdapter.toModel(u2) })
		]);

		// Filter comment with since
		expect(
			await storeController.Find({
				locator,
				limit: 0,
				skip: 0,
				since: new Time(c2.time.toJSON())
			})
		).toEqual([CommentAdapter.toModel(c3, { user: UserAdapter.toModel(u2) })]);

		expect(
			await storeController.Find({
				locator,
				limit: 0,
				skip: 0,
				since: new Time(c3.time.toJSON())
			})
		).toEqual([]);
	});

	test('Create works', async () => {
		const storeController: StoreMongoController = new StoreMongoController();
		const remarkSite: SiteDocument = {
			_id: 'remark',
			enabled: true,
			key: '12345',
			adminEmail: 'admin@example.com',
			posts: [
				{
					url: '127.0.0.1',
					readOnly: false
				},
				{
					url: '127.0.0.2',
					readOnly: true
				}
			]
		};
		await sites.insertOne(remarkSite);

		// Create a comment
		const u1 = genUser({ uid: 'u1', name: 'User One', site: 'remark' });
		const mc1 = CommentAdapter.toModel(
			genComment({ cid: 'c1', user: 'u1', time: new Date('2020-09-08T00:00:00Z'), locator: { site: 'unknown', url: '127.0.0.1' } }),
			{
				user: UserAdapter.toModel(u1)
			}
		);

		// Site not existing
		await expectAsyncThrows(() => storeController.Create(mc1), 'site unknown not found');

		// Post not existing
		mc1.locator = { site: 'remark', url: '127.0.0.3' };
		await expectAsyncThrows(() => storeController.Create(mc1), 'post 127.0.0.3 not found');

		// Read-only post
		mc1.locator = { site: 'remark', url: '127.0.0.2' };
		await expectAsyncThrows(() => storeController.Create(mc1), 'post 127.0.0.2 is read-only');

		// Post and user creation
		mc1.locator = { site: 'remark', url: '127.0.0.1' };
		expect(await storeController.Create(mc1)).toEqual('c1');
		expect(await users.countDocuments()).toBe(1);
		expect(await comments.countDocuments()).toBe(1);

		// Duplicated comment
		await expectAsyncThrows(() => storeController.Create(mc1), 'key c1 already in store');
		expect(await users.countDocuments()).toBe(1);
		expect(await comments.countDocuments()).toBe(1);

		// Dynamic posts
		global.serverOpts.dynamicPosts = true;

		// Creating a post that does not exist
		mc1.locator = { site: 'remark', url: '127.0.0.3' };
		await storeController.Create(mc1);
		expect(await users.countDocuments()).toBe(1);
		expect(await comments.countDocuments()).toBe(2);
		const site = await sites.findOne({ _id: 'remark' });
		expect(site).not.toBeNull();
		expect(site.posts.length).toBe(3);
	});

	test('Flag (user block) works', async () => {
		const uploadDate: Date = new Date(2020, 1, 1, 12, 0, 0);
		jest.setSystemTime(uploadDate);

		const storeController: StoreMongoController = new StoreMongoController();

		const u1 = genUser({ uid: 'u1', name: 'User One', site: 'remark' });

		const remarkSite: SiteDocument = {
			_id: 'remark',
			enabled: true,
			key: '12345',
			adminEmail: 'admin@example.com',
			posts: [
				{
					url: '127.0.0.1',
					readOnly: false
				}
			]
		};
		await sites.insertOne(remarkSite);
		await users.insertOne(u1);

		// 1 week in nanoseconds
		const weekNs = 24 * 60 * 60 * 7 * 1e9;

		// Block for a week
		expect(
			await storeController.Flag({
				flag: "blocked",
				locator: {
					site: "remark",
					url: ""
				},
				user_id: u1.uid,
				update: FlagTrue,
				ttl: new Duration(weekNs.toString())
			})
		).toEqual(true);

		const expectedBlockUntil = new Date();
		expectedBlockUntil.setTime(uploadDate.getTime() + weekNs * 1e-6);

		expect(
			await users.findOne({ uid: u1.uid })
		).toMatchObject({
			blocked: expectedBlockUntil
		} as Partial<UserDocument>);

		// Block permanently
		expect(
			await storeController.Flag({
				flag: "blocked",
				locator: {
					site: "remark",
					url: ""
				},
				user_id: u1.uid,
				update: FlagTrue
			})
		).toEqual(true);
		expectedBlockUntil.setTime(uploadDate.getTime());
		expectedBlockUntil.setFullYear(uploadDate.getFullYear() + 100);

		expect(
			await users.findOne({ uid: u1.uid })
		).toMatchObject({
			blocked: expectedBlockUntil
		} as Partial<UserDocument>);
	});
});
