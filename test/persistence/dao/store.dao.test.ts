import { AllUserDetails, BlockedUser, HardDelete, Locator, SoftDelete, UserEmail, UserTelegram } from '@remark42/dto/store.dto';
import { describe, expect, test } from '@jest/globals';
import { CommentAdapter } from '@persistence/adapter/comment.adapter';
import { UserAdapter } from '@persistence/adapter/user.adapter';
import { StoreMongoDAO } from '@persistence/dao/store.dao';
import { getCommentsCollection, getSitesCollection, getUsersCollection } from '@persistence/dao/utils';
import { CommentDocument } from '@persistence/entity/comment.entity';
import { SiteDocument } from '@persistence/entity/site.entity';
import { UserDocument } from '@persistence/entity/user.entity';
import { createIndices } from '@persistence/utils';
import { Time } from '@util/time';
import { Collection, Db, MongoClient } from 'mongodb';
import { expectAsyncThrows, genComment, genUser } from '../../utils';

jest.mock('@logging/index');

describe('StoreMongoDAO', () => {
	let client: MongoClient;
	let db: Db;
	let sites: Collection<SiteDocument>;
	let comments: Collection<CommentDocument>;
	let users: Collection<UserDocument>;

	beforeAll(async () => {
		// Connect
		client = await MongoClient.connect(global.__MONGO_URI__);
		db = await client.db(global.__MONGO_DB_NAME__);
		sites = getSitesCollection(client);
		comments = getCommentsCollection(client);
		users = getUsersCollection(client);

		// Create indices
		await createIndices(client);
	});

	afterAll(async () => {
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

	test('siteExists works', async () => {
		const remarkSite: SiteDocument = {
			enabled: true,
			key: '12345',
			_id: 'remark',
			posts: [],
			adminEmail: ''
		};
		await sites.insertOne(remarkSite);

		expect(await StoreMongoDAO.siteExists(client, 'unknown')).toEqual(false);
		expect(await StoreMongoDAO.siteExists(client, 'remark')).toEqual(true);
	});

	test('countPostComments works', async () => {
		const remarkSite: SiteDocument = {
			_id: 'remark',
			enabled: true,
			key: '12345',
			posts: [
				{
					url: '127.0.0.1',
					readOnly: false
				}
			],
			adminEmail: ''
		};
		await sites.insertOne(remarkSite);
		await comments.insertMany([
			genComment({ cid: 'c1', user: 'u1', locator: { site: 'remark', url: '127.0.0.1' } }),
			genComment({ cid: 'c2', user: 'u2', locator: { site: 'remark', url: '127.0.0.1' } })
		]);

		// Unknown site
		expect(await StoreMongoDAO.countPostComments(client, { site: 'unknown', url: 'localhost' })).toEqual(0);

		// Unknown post url
		expect(await StoreMongoDAO.countPostComments(client, { site: 'remark', url: 'localhost' })).toEqual(0);

		// Post with 2 comments
		expect(await StoreMongoDAO.countPostComments(client, { site: 'remark', url: '127.0.0.1' })).toEqual(2);
	});

	test('countUserComments works', async () => {
		const remarkSite: SiteDocument = {
			_id: 'remark',
			enabled: true,
			key: '12345',
			posts: [
				{
					url: '127.0.0.1',
					readOnly: false
				},
				{
					url: '127.0.0.2',
					readOnly: false
				}
			],
			adminEmail: ''
		};
		await sites.insertOne(remarkSite);
		await comments.insertMany([
			genComment({ cid: 'c1', user: 'u1', locator: { site: 'remark', url: '127.0.0.1' } }),
			genComment({ cid: 'c2', user: 'u1', locator: { site: 'remark', url: '127.0.0.1' } }),
			genComment({ cid: 'c3', user: 'u2', locator: { site: 'remark', url: '127.0.0.1' } }),
			genComment({ cid: 'c1', user: 'u1', locator: { site: 'remark', url: '127.0.0.2' } }),
			genComment({ cid: 'c2', user: 'u2', locator: { site: 'remark', url: '127.0.0.2' } })
		]);

		// Unknown site
		expect(await StoreMongoDAO.countUserComments(client, 'u1', 'unknown')).toEqual(0);

		// Unknown user
		expect(await StoreMongoDAO.countUserComments(client, 'unknown', 'remark')).toEqual(0);

		// 3 comments across two posts
		expect(await StoreMongoDAO.countUserComments(client, 'u1', 'remark')).toEqual(3);

		// 2 comments across two posts
		expect(await StoreMongoDAO.countUserComments(client, 'u2', 'remark')).toEqual(2);
	});

	test('getSiteKey works', async () => {
		const remarkSite: SiteDocument = {
			_id: 'remark',
			enabled: true,
			key: '12345',
			posts: [],
			adminEmail: ''
		};
		await sites.insertOne(remarkSite);

		expect(await StoreMongoDAO.getSiteKey(client, 'unknown')).toBe('');
		expect(await StoreMongoDAO.getSiteKey(client, 'remark')).toBe('12345');
	});

	test('getPostComments works', async () => {
		const c1 = genComment({ cid: 'c1', user: 'u1', time: new Date('2020-09-08T00:00:00Z'), locator: { site: 'remark', url: '127.0.0.1' } });
		const c2 = genComment({ cid: 'c2', user: 'u1', time: new Date('2020-09-08T00:01:00Z'), locator: { site: 'remark', url: '127.0.0.1' } });
		const c3 = genComment({ cid: 'c3', user: 'u2', time: new Date('2020-09-08T00:02:00Z'), locator: { site: 'remark', url: '127.0.0.1' } });
		const u1 = genUser({ uid: 'u1', name: 'User One', site: 'remark' });
		const u2 = genUser({ uid: 'u2', name: 'User Two', site: 'remark' });
		const mc1 = CommentAdapter.toModel(c1, { user: UserAdapter.toModel(u1) });
		const mc2 = CommentAdapter.toModel(c2, { user: UserAdapter.toModel(u1) });
		const mc3 = CommentAdapter.toModel(c3, { user: UserAdapter.toModel(u2) });

		const remarkSite: SiteDocument = {
			_id: 'remark',
			enabled: true,
			key: '12345',
			posts: [
				{
					url: '127.0.0.1',
					readOnly: false
				},
				{
					url: '127.0.0.2',
					readOnly: false
				}
			],
			adminEmail: 'admin.test@example.com'
		};
		await sites.insertOne(remarkSite);
		await comments.insertMany([
			c1,
			c2,
			c3,
			genComment({
				cid: 'c1',
				user: 'u1',
				locator: { site: 'remark', url: '127.0.0.2' }
			}),
			genComment({
				cid: 'c2',
				user: 'u2'
			})
		]);
		await users.insertMany([u1, u2]);

		// Unknown site
		expect(await StoreMongoDAO.getPostComments(client, { site: 'unknown', url: 'localhost' })).toEqual([]);

		// Unknown post url
		expect(await StoreMongoDAO.getPostComments(client, { site: 'remark', url: 'localhost' })).toEqual([]);

		expect(await StoreMongoDAO.getPostComments(client, { site: 'remark', url: '127.0.0.1' })).toEqual([mc1, mc2, mc3]);

		// Filter comment with since
		expect(await StoreMongoDAO.getPostComments(client, { site: 'remark', url: '127.0.0.1' }, c2.time)).toEqual([mc3]);
		expect(await StoreMongoDAO.getPostComments(client, { site: 'remark', url: '127.0.0.1' }, c3.time)).toEqual([]);
	});

	test('getSiteLastComments works', async () => {
		// prettier-ignore
		const c1 = genComment({ cid: "c1", user: "u1", text: "c1", time: new Date("2020-09-08T00:00:00Z"), locator: { site: "remark", url: "127.0.0.1" } });
		// prettier-ignore
		const c2 = genComment({ cid: 'c2', user: 'u1', text: 'c2', time: new Date('2020-09-08T00:01:00Z'), locator: { site: 'remark', url: '127.0.0.1' } });
		// prettier-ignore
		const c3 = genComment({ cid: 'c3', user: 'u2', text: 'c3', time: new Date('2020-09-08T00:02:00Z'), locator: { site: 'remark', url: '127.0.0.1' } });
		// prettier-ignore
		const c4 = genComment({ cid: 'c1', user: 'u1', text: 'c4', time: new Date('2022-09-09T00:02:00Z'), locator: { site: 'remark', url: '127.0.0.2' } });
		// prettier-ignore
		const c5 = genComment({ cid: 'c2', user: 'u2', text: 'c5', time: new Date('2020-01-08T00:02:00Z'), locator: { site: 'remark', url: '127.0.0.2' } });
		const u1 = genUser({ uid: 'u1', name: 'User One', site: 'remark' });
		const u2 = genUser({ uid: 'u2', name: 'User Two', site: 'remark' });
		const mc1 = CommentAdapter.toModel(c1, { user: UserAdapter.toModel(u1) });
		const mc2 = CommentAdapter.toModel(c2, { user: UserAdapter.toModel(u1) });
		const mc3 = CommentAdapter.toModel(c3, { user: UserAdapter.toModel(u2) });
		const mc4 = CommentAdapter.toModel(c4, { user: UserAdapter.toModel(u1) });
		const mc5 = CommentAdapter.toModel(c5, { user: UserAdapter.toModel(u2) });

		const remarkSite: SiteDocument = {
			_id: 'remark',
			enabled: true,
			key: '12345',
			posts: [
				{
					url: '127.0.0.1',
					readOnly: false
				},
				{
					url: '127.0.0.2',
					readOnly: false
				}
			],
			adminEmail: 'admin.test@example.com'
		};

		const emptySite: SiteDocument = {
			_id: 'empty',
			enabled: true,
			key: '12345',
			posts: [
				{
					url: '127.0.0.1',
					readOnly: false
				},
				{
					url: '127.0.0.2',
					readOnly: false
				}
			],
			adminEmail: ''
		};

		await sites.insertMany([remarkSite, emptySite]);
		await comments.insertMany([c1, c2, c3, c4, c5]);
		await users.insertMany([u1, u2]);

		// Unknown site
		expect(await StoreMongoDAO.getSiteLastComments(client, 'unknown', 0)).toEqual([]);

		// Comments are sorted by Mongo
		expect(await StoreMongoDAO.getSiteLastComments(client, 'remark', 0)).toEqual([mc4, mc3, mc2, mc1, mc5]);

		// Limit comments with max
		expect(await StoreMongoDAO.getSiteLastComments(client, 'remark', 2)).toEqual([mc4, mc3]);
		expect(await StoreMongoDAO.getSiteLastComments(client, 'remark', 1)).toEqual([mc4]);

		// Filter comments with since
		expect(await StoreMongoDAO.getSiteLastComments(client, 'remark', 0, c2.time)).toEqual([mc4, mc3]);
		expect(await StoreMongoDAO.getSiteLastComments(client, 'remark', 0, c3.time)).toEqual([mc4]);

		// Empty site
		expect(await StoreMongoDAO.getSiteLastComments(client, 'empty', 0)).toEqual([]);
	});

	test('getSiteUserComments works', async () => {
		// prettier-ignore
		const c1 = genComment({ cid: "c1", user: "u1", text: "c1", time: new Date("2020-09-08T00:00:00Z"), locator: { site: "remark", url: "127.0.0.1" } });
		// prettier-ignore
		const c2 = genComment({ cid: 'c2', user: 'u1', text: 'c2', time: new Date('2020-09-08T00:01:00Z'), locator: { site: 'remark', url: '127.0.0.1' } });
		// prettier-ignore
		const c3 = genComment({ cid: 'c3', user: 'u2', text: 'c3', time: new Date('2020-09-08T00:02:00Z'), locator: { site: 'remark', url: '127.0.0.1' } });
		// prettier-ignore
		const c4 = genComment({ cid: 'c1', user: 'u1', text: 'c4', time: new Date('2022-09-09T00:02:00Z'), locator: { site: 'remark', url: '127.0.0.2' } });
		// prettier-ignore
		const c5 = genComment({ cid: 'c2', user: 'u2', text: 'c5', time: new Date('2020-01-08T00:02:00Z'), locator: { site: 'remark', url: '127.0.0.2' } });
		const u1 = genUser({ uid: 'u1', name: 'User One', site: 'remark' });
		const u2 = genUser({ uid: 'u2', name: 'User Two', site: 'remark' });
		const mc1 = CommentAdapter.toModel(c1, { user: UserAdapter.toModel(u1) });
		const mc2 = CommentAdapter.toModel(c2, { user: UserAdapter.toModel(u1) });
		const mc3 = CommentAdapter.toModel(c3, { user: UserAdapter.toModel(u2) });
		const mc4 = CommentAdapter.toModel(c4, { user: UserAdapter.toModel(u1) });
		const mc5 = CommentAdapter.toModel(c5, { user: UserAdapter.toModel(u2) });

		const remarkSite: SiteDocument = {
			_id: 'remark',
			enabled: true,
			key: '12345',
			posts: [
				{
					url: '127.0.0.1',
					readOnly: false
				},
				{
					url: '127.0.0.2',
					readOnly: false
				}
			],
			adminEmail: 'admin.test@example.com'
		};

		const emptySite: SiteDocument = {
			_id: 'empty',
			enabled: true,
			key: '12345',
			posts: [
				{
					url: '127.0.0.1',
					readOnly: false
				},
				{
					url: '127.0.0.2',
					readOnly: false
				}
			],
			adminEmail: ''
		};

		await sites.insertMany([remarkSite, emptySite]);
		await comments.insertMany([c1, c2, c3, c4, c5]);
		await users.insertMany([u1, u2]);

		// Unknown site
		expect(await StoreMongoDAO.getSiteUserComments(client, 'unknown', u1.uid, 0, 0)).toEqual([]);

		expect(await StoreMongoDAO.getSiteUserComments(client, 'remark', u1.uid, 0, 0)).toEqual([mc4, mc2, mc1]);
		expect(await StoreMongoDAO.getSiteUserComments(client, 'remark', u2.uid, 0, 0)).toEqual([mc3, mc5]);

		// Limit comments
		expect(await StoreMongoDAO.getSiteUserComments(client, 'remark', u1.uid, 2, 0)).toEqual([mc4, mc2]);
		expect(await StoreMongoDAO.getSiteUserComments(client, 'remark', u1.uid, 1, 0)).toEqual([mc4]);

		// Skip comments
		expect(await StoreMongoDAO.getSiteUserComments(client, 'remark', u1.uid, 2, 1)).toEqual([mc2, mc1]);
		expect(await StoreMongoDAO.getSiteUserComments(client, 'remark', u1.uid, 0, 2)).toEqual([mc1]);
		expect(await StoreMongoDAO.getSiteUserComments(client, 'remark', u1.uid, 0, 3)).toEqual([]);

		// Empty site
		expect(await StoreMongoDAO.getSiteUserComments(client, 'empty', u1.uid, 0, 0)).toEqual([]);
	});

	test('getSiteAdmins works', async () => {
		const u1 = genUser({ uid: 'u1', name: 'User One', site: 'remark', email: 'user.one@example.com', admin: true });
		const u2 = genUser({ uid: 'u2', name: 'User Two', site: 'remark', email: 'user.two@example.com' });

		const remarkSite: SiteDocument = {
			_id: 'remark',
			enabled: true,
			key: '12345',
			posts: [],
			adminEmail: 'admin.test@example.com'
		};
		const emptySite: SiteDocument = {
			_id: 'empty',
			enabled: true,
			key: '12345',
			posts: [
				{
					url: '127.0.0.1',
					readOnly: false
				},
				{
					url: '127.0.0.2',
					readOnly: false
				}
			],
			adminEmail: ''
		};

		await sites.insertMany([remarkSite, emptySite]);
		await users.insertMany([u1, u2]);

		// Unknown site
		expect(await StoreMongoDAO.getSiteAdmins(client, 'unknown')).toEqual([]);

		// Admin
		expect(await StoreMongoDAO.getSiteAdmins(client, 'remark')).toEqual([u1.uid]);

		// Empty site
		expect(await StoreMongoDAO.getSiteAdmins(client, 'empty')).toEqual([]);
	});

	test('getSiteAdminEmail works', async () => {
		const remarkSite: SiteDocument = {
			_id: 'remark',
			enabled: true,
			key: '12345',
			posts: [],
			adminEmail: 'admin.test@example.com'
		};
		await sites.insertOne(remarkSite);

		expect(await StoreMongoDAO.getSiteAdminEmail(client, 'unknown')).toBe('');
		expect(await StoreMongoDAO.getSiteAdminEmail(client, 'remark')).toBe('admin.test@example.com');
	});

	test('isSiteEnabled works', async () => {
		const remarkSite: SiteDocument = {
			_id: 'remark',
			enabled: true,
			key: '12345',
			posts: [],
			adminEmail: 'admin.test@example.com'
		};
		const emptySite: SiteDocument = {
			_id: 'empty',
			enabled: false,
			key: '12345',
			posts: [],
			adminEmail: 'admin.test@example.com'
		};
		await sites.insertMany([remarkSite, emptySite]);

		expect(await StoreMongoDAO.isSiteEnabled(client, 'unknown')).toBe(false);
		expect(await StoreMongoDAO.isSiteEnabled(client, 'remark')).toBe(true);
		expect(await StoreMongoDAO.isSiteEnabled(client, 'empty')).toBe(false);
	});

	test('isPostReadOnly works', async () => {
		const remarkSite: SiteDocument = {
			_id: 'remark',
			enabled: true,
			key: '12345',
			posts: [
				{
					url: '127.0.0.1',
					readOnly: false
				},
				{
					url: '127.0.0.2',
					readOnly: true
				}
			],
			adminEmail: ''
		};
		await sites.insertOne(remarkSite);

		// Unknown site
		expect(await StoreMongoDAO.isPostReadOnly(client, { site: 'unknown', url: 'localhost' })).toEqual(false);

		// Unknown post url
		expect(await StoreMongoDAO.isPostReadOnly(client, { site: 'remark', url: 'localhost' })).toEqual(false);

		// Posts
		expect(await StoreMongoDAO.isPostReadOnly(client, { site: 'remark', url: '127.0.0.1' })).toEqual(false);
		expect(await StoreMongoDAO.isPostReadOnly(client, { site: 'remark', url: '127.0.0.2' })).toEqual(true);
	});

	test('isUserBlocked works', async () => {
		const futureDate = new Date();
		futureDate.setFullYear(futureDate.getFullYear() + 1);

		const pastDate = new Date();
		pastDate.setFullYear(pastDate.getFullYear() - 1);

		const u1 = genUser({ uid: 'u1', name: 'User One', site: 'remark', blocked: futureDate });
		const u2 = genUser({ uid: 'u2', name: 'User Two', site: 'remark', blocked: null });
		const u3 = genUser({ uid: 'u3', name: 'User Three', site: 'remark', blocked: pastDate });

		const remarkSite: SiteDocument = {
			_id: 'remark',
			enabled: true,
			key: '12345',
			posts: [],
			adminEmail: ''
		};
		await sites.insertOne(remarkSite);
		await users.insertMany([u1, u2, u3]);

		// Unknown site
		expect(await StoreMongoDAO.isUserBlocked(client, 'unknown', 'unknown')).toEqual(false);

		// Unknown user
		expect(await StoreMongoDAO.isUserBlocked(client, 'remark', 'unknown')).toEqual(false);

		// Users
		expect(await StoreMongoDAO.isUserBlocked(client, 'remark', 'u1')).toEqual(true);
		expect(await StoreMongoDAO.isUserBlocked(client, 'remark', 'u2')).toEqual(false);
		expect(await StoreMongoDAO.isUserBlocked(client, 'remark', 'u3')).toEqual(false);
	});

	test('getBlockedUsers works', async () => {
		const futureDate = new Date();
		futureDate.setFullYear(futureDate.getFullYear() + 1);

		const pastDate = new Date();
		pastDate.setFullYear(pastDate.getFullYear() - 1);

		const u1 = genUser({ uid: 'u1', name: 'User One', site: 'remark', blocked: futureDate });
		const u2 = genUser({ uid: 'u2', name: 'User Two', site: 'remark', blocked: null });
		const u3 = genUser({ uid: 'u3', name: 'User Three', site: 'remark', blocked: pastDate });

		const remarkSite: SiteDocument = {
			_id: 'remark',
			enabled: true,
			key: '12345',
			posts: [],
			adminEmail: ''
		};
		await sites.insertOne(remarkSite);
		await users.insertMany([u1, u2, u3]);

		// Unknown site
		expect(await StoreMongoDAO.getBlockedUsers(client, 'unknown')).toEqual([]);
		expect(await StoreMongoDAO.getBlockedUsers(client, 'remark')).toEqual([
			{
				id: u1.uid,
				name: u1.name,
				time: new Time(u1.blocked.toJSON())
			}
		] as BlockedUser[]);
	});

	test('isUserVerified works', async () => {
		const u1 = genUser({ uid: 'u1', name: 'User One', site: 'remark', verified: true });
		const u2 = genUser({ uid: 'u2', name: 'User Two', site: 'remark', verified: false });

		const remarkSite: SiteDocument = {
			_id: 'remark',
			enabled: true,
			key: '12345',
			posts: [],
			adminEmail: ''
		};
		await sites.insertOne(remarkSite);
		await users.insertMany([u1, u2]);

		// Unknown site
		expect(await StoreMongoDAO.isUserVerified(client, 'unknown', 'unknown')).toEqual(false);

		// Unknown user
		expect(await StoreMongoDAO.isUserVerified(client, 'remark', 'unknown')).toEqual(false);

		// Users
		expect(await StoreMongoDAO.isUserVerified(client, 'remark', 'u1')).toEqual(true);
		expect(await StoreMongoDAO.isUserVerified(client, 'remark', 'u2')).toEqual(false);
	});

	test('createUser works', async () => {
		const u1 = genUser({ uid: 'u1', name: 'User One', site: 'remark' });
		const u2 = genUser({ uid: 'u2', name: 'User Two', site: 'remark' });
		const remarkSite: SiteDocument = {
			_id: 'remark',
			enabled: true,
			key: '12345',
			posts: [],
			adminEmail: ''
		};
		await sites.insertOne(remarkSite);

		await StoreMongoDAO.createUser(client, UserAdapter.toModel(u1));
		await StoreMongoDAO.createUser(client, UserAdapter.toModel(u2));
		expect(await users.countDocuments()).toEqual(2);

		// Resave same users
		await StoreMongoDAO.createUser(client, UserAdapter.toModel(u1));
		await StoreMongoDAO.createUser(client, UserAdapter.toModel(u2));
		expect(await users.countDocuments()).toEqual(2);
	});

	test('createComment works', async () => {
		// prettier-ignore
		const c1 = genComment({ cid: "c1", user: "u1", text: "c1", time: new Date("2020-09-08T00:00:00Z"), locator: { site: "remark", url: "127.0.0.1" } });
		// prettier-ignore
		const c2 = genComment({ cid: 'c1', user: 'u1', text: 'c2', time: new Date('2022-09-09T00:02:00Z'), locator: { site: 'remark', url: '127.0.0.2' } });
		const u1 = genUser({ uid: 'u1', name: 'User One', site: 'remark' });

		const remarkSite: SiteDocument = {
			_id: 'remark',
			enabled: true,
			key: '12345',
			posts: [
				{
					url: '127.0.0.1',
					readOnly: false
				},
				{
					url: '127.0.0.2',
					readOnly: false
				}
			],
			adminEmail: 'admin.test@example.com'
		};

		await sites.insertOne(remarkSite);
		await users.insertOne(u1);

		const mc1 = CommentAdapter.toModel(c1, { user: UserAdapter.toModel(u1) });
		const mc2 = CommentAdapter.toModel(c2, { user: UserAdapter.toModel(u1) });
		await StoreMongoDAO.createComment(client, mc1);
		await StoreMongoDAO.createComment(client, mc2);

		// Reject duplicate comments
		await expectAsyncThrows(() => StoreMongoDAO.createComment(client, mc1), '');
		await expectAsyncThrows(() => StoreMongoDAO.createComment(client, mc2), '');
	});

	test('deleteComment works', async () => {
		const locator1: Locator = { site: 'remark', url: '127.0.0.1' };
		const locator2: Locator = { site: 'remark', url: '127.0.0.2' };
		const c1 = genComment({ cid: 'c1', user: 'u1', text: 'c1', time: new Date('2020-09-08T00:00:00Z'), locator: locator1 });
		const c2 = genComment({ cid: 'c2', user: 'u1', text: 'c2', time: new Date('2020-09-08T00:01:00Z'), locator: locator1 });
		const c4 = genComment({ cid: 'c1', user: 'u1', text: 'c4', time: new Date('2022-09-09T00:02:00Z'), locator: locator2 });
		const c5 = genComment({ cid: 'c2', user: 'u2', text: 'c5', time: new Date('2020-01-08T00:02:00Z'), locator: locator2 });
		const u1 = genUser({ uid: 'u1', name: 'User One', site: 'remark' });
		const u2 = genUser({ uid: 'u2', name: 'User Two', site: 'remark' });

		const remarkSite: SiteDocument = {
			_id: 'remark',
			enabled: true,
			key: '12345',
			posts: [
				{
					url: '127.0.0.1',
					readOnly: false
				},
				{
					url: '127.0.0.2',
					readOnly: false
				}
			],
			adminEmail: 'admin.test@example.com'
		};

		await sites.insertOne(remarkSite);
		await comments.insertMany([c1, c2, c4, c5]);
		await users.insertMany([u1, u2]);

		const hardDeletedComment: Partial<CommentDocument> = {
			text: '',
			orig: '',
			score: 0,
			// votes: {},
			// voted_ips: {},
			// edit: null,
			delete: true,
			pin: false,
			user: 'deleted'
		};

		// Delete u1 comment
		await StoreMongoDAO.deleteComment(client, locator1, c1.cid, HardDelete);
		expect(await users.countDocuments({ uid: u1.uid })).toBe(1);
		expect(await users.countDocuments({ uid: u2.uid })).toBe(1);
		expect(await comments.findOne({ cid: c1.cid, locator: locator1 })).toMatchObject(hardDeletedComment);

		// Delete u1 comment (u1 has no comment on locator1 but one on locator2)
		await StoreMongoDAO.deleteComment(client, locator1, c2.cid, HardDelete);
		expect(await users.countDocuments({ uid: u1.uid })).toBe(1);
		expect(await users.countDocuments({ uid: u2.uid })).toBe(1);
		expect(await comments.findOne({ cid: c2.cid, locator: locator1 })).toMatchObject(hardDeletedComment);

		// Delete u2 comment (u2 has no more comments, should not be deleted)
		await StoreMongoDAO.deleteComment(client, locator2, c5.cid, HardDelete);
		expect(await users.countDocuments({ uid: u1.uid })).toBe(1);
		expect(await users.countDocuments({ uid: u2.uid })).toBe(1);
		expect(await comments.findOne({ cid: c5.cid, locator: locator2 })).toMatchObject(hardDeletedComment);

		// Delete last u1 comment (u1 has no more comments, should not be deleted)
		await StoreMongoDAO.deleteComment(client, locator2, c4.cid, HardDelete);
		expect(await users.countDocuments({ uid: u1.uid })).toBe(1);
		expect(await users.countDocuments({ uid: u2.uid })).toBe(1);
		expect(await comments.findOne({ cid: c4.cid, locator: locator2 })).toMatchObject(hardDeletedComment);
	});

	test('getComment works', async () => {
		const locator1: Locator = { site: 'remark', url: '127.0.0.1' };
		const locator2: Locator = { site: 'remark', url: '127.0.0.2' };
		const c1 = genComment({ cid: 'c1', user: 'u1', text: 'c1', time: new Date('2020-09-08T00:00:00Z'), locator: locator1 });
		const c4 = genComment({ cid: 'c1', user: 'u1', text: 'c4', time: new Date('2022-09-09T00:02:00Z'), locator: locator2 });
		const u1 = genUser({ uid: 'u1', name: 'User One', site: 'remark' });
		const u2 = genUser({ uid: 'u2', name: 'User Two', site: 'remark' });

		const remarkSite: SiteDocument = {
			_id: 'remark',
			enabled: true,
			key: '12345',
			posts: [
				{
					url: '127.0.0.1',
					readOnly: false
				},
				{
					url: '127.0.0.2',
					readOnly: false
				}
			],
			adminEmail: 'admin.test@example.com'
		};

		await sites.insertOne(remarkSite);
		await comments.insertMany([c1, c4]);
		await users.insertMany([u1, u2]);

		expect(await StoreMongoDAO.getComment(client, locator1, c1.cid)).toMatchObject({
			...CommentAdapter.toModel(c1)
		});
		expect(await StoreMongoDAO.getComment(client, locator2, c4.cid)).toMatchObject({
			...CommentAdapter.toModel(c4)
		});
	});

	test('updateComment works', async () => {
		const locator1: Locator = { site: 'remark', url: '127.0.0.1' };
		const c1 = genComment({ cid: 'c1', user: 'u1', text: 'c1', time: new Date('2020-09-08T00:00:00Z'), locator: locator1 });
		const u1 = genUser({ uid: 'u1', name: 'User One', site: 'remark' });

		const remarkSite: SiteDocument = {
			_id: 'remark',
			enabled: true,
			key: '12345',
			posts: [
				{
					url: '127.0.0.1',
					readOnly: false
				},
				{
					url: '127.0.0.2',
					readOnly: false
				}
			],
			adminEmail: 'admin.test@example.com'
		};

		await sites.insertOne(remarkSite);
		await comments.insertOne(c1);
		await users.insertOne(u1);

		await StoreMongoDAO.updateComment(client, c1.cid, locator1, {
			// Immutable parts
			id: 'new_id',
			pid: 'new_parent',
			locator: {
				site: 'new_site',
				url: 'new_url'
			},
			time: new Time('2024-09-08T00:00:00Z'),
			user: {
				id: 'newId',
				name: 'newName',
				picture: 'newPic',
				ip: 'newIP',
				admin: false
			},

			// Mutable parts
			orig: 'newOrig',
			text: 'newText',
			title: 'newTitle',
			score: 100,
			// controversy: 100,
			// edit: undefined,
			delete: false,
			imported: false,
			pin: false
			// vote: undefined,
			// voted_ips: {},
			// votes: {}
		});

		// Immutable parts must be kept
		expect(await comments.findOne({ cid: c1.cid, locator: locator1 })).toMatchObject({
			cid: c1.cid,
			pid: c1.pid,
			locator: c1.locator,
			time: c1.time
		});

		// Mutable parts change
		expect(await comments.findOne({ cid: c1.cid, locator: locator1 })).toMatchObject({
			orig: 'newOrig',
			text: 'newText',
			title: 'newTitle',
			score: 100,
			// controversy: 100,
			// edit: undefined,
			// delete: false,
			imported: false,
			pin: false
			// vote: undefined,
			// voted_ips: {},
			// votes: {}
		});
	});

	test('getVerifiedUsers works', async () => {
		const u1 = genUser({ uid: 'u1', name: 'User One', site: 'remark', verified: true });
		const u2 = genUser({ uid: 'u2', name: 'User Two', site: 'remark', verified: false });
		const u3 = genUser({ uid: 'u3', name: 'User Three', site: 'remark', verified: true });

		const remarkSite: SiteDocument = {
			_id: 'remark',
			enabled: true,
			key: '12345',
			posts: [],
			adminEmail: ''
		};
		await sites.insertOne(remarkSite);
		await users.insertMany([u1, u2, u3]);

		// Unknown site
		expect(await StoreMongoDAO.getVerifiedUsers(client, 'unknown')).toEqual([]);

		// Users
		expect(await StoreMongoDAO.getVerifiedUsers(client, 'remark')).toEqual([u1.uid, u3.uid]);
	});

	test('getPostInfo works', async () => {
		const c1 = genComment({ cid: 'c1', user: 'u1', time: new Date('2022-09-08T15:40:00Z'), locator: { site: 'remark', url: '127.0.0.1' } });
		const c2 = genComment({ cid: 'c2', user: 'u2', time: new Date('2022-09-08T16:40:00Z'), locator: { site: 'remark', url: '127.0.0.1' } });
		const remarkSite: SiteDocument = {
			_id: 'remark',
			enabled: true,
			key: '12345',
			posts: [
				{
					url: '127.0.0.1',
					readOnly: false
				},
				{
					url: '127.0.0.2',
					readOnly: true
				}
			],
			adminEmail: ''
		};
		await sites.insertOne(remarkSite);
		await comments.insertMany([c1, c2]);

		// Unknown site
		expect(await StoreMongoDAO.getPostInfo(client, { site: 'unknown', url: 'localhost' })).toMatchObject([
			{
				count: 0,
				first_time: Time.zero(),
				last_time: Time.zero(),
				read_only: false,
				url: 'localhost'
			}
		]);

		// Unknown post url
		expect(await StoreMongoDAO.getPostInfo(client, { site: 'remark', url: 'localhost' })).toMatchObject([
			{
				count: 0,
				first_time: Time.zero(),
				last_time: Time.zero(),
				read_only: false,
				url: 'localhost'
			}
		]);

		// Post with 2 comments
		expect(await StoreMongoDAO.getPostInfo(client, { site: 'remark', url: '127.0.0.1' })).toMatchObject([
			{
				count: 2,
				first_time: new Time('2022-09-08T15:40:00.000Z'),
				last_time: new Time('2022-09-08T16:40:00.000Z'),
				read_only: false,
				url: '127.0.0.1'
			}
		]);

		// Using ro_age
		expect(await StoreMongoDAO.getPostInfo(client, { site: 'remark', url: '127.0.0.1' }, 1)).toMatchObject([
			{
				count: 2,
				first_time: new Time('2022-09-08T15:40:00.000Z'),
				last_time: new Time('2022-09-08T16:40:00.000Z'),
				read_only: true,
				url: '127.0.0.1'
			}
		]);

		// Read-only post with no comments
		expect(await StoreMongoDAO.getPostInfo(client, { site: 'remark', url: '127.0.0.2' })).toMatchObject([
			{
				count: 0,
				first_time: Time.zero(),
				last_time: Time.zero(),
				read_only: true,
				url: '127.0.0.2'
			}
		]);
	});

	test('getSiteInfo works', async () => {
		// prettier-ignore
		const c1 = genComment({ cid: "c1", user: "u1", text: "c1", time: new Date("2020-09-08T00:00:00Z"), locator: { site: "remark", url: "127.0.0.1" } });
		// prettier-ignore
		const c2 = genComment({ cid: 'c2', user: 'u1', text: 'c2', time: new Date('2020-09-08T00:01:00Z'), locator: { site: 'remark', url: '127.0.0.1' } });
		// prettier-ignore
		const c3 = genComment({ cid: 'c3', user: 'u2', text: 'c3', time: new Date('2020-09-08T00:02:00Z'), locator: { site: 'remark', url: '127.0.0.1' } });
		// prettier-ignore
		const c4 = genComment({ cid: 'c1', user: 'u1', text: 'c4', time: new Date('2022-09-09T00:02:00Z'), locator: { site: 'remark', url: '127.0.0.2' } });
		// prettier-ignore
		const c5 = genComment({ cid: 'c2', user: 'u2', text: 'c5', time: new Date('2020-01-08T00:02:00Z'), locator: { site: 'remark', url: '127.0.0.2' } });
		const u1 = genUser({ uid: 'u1', name: 'User One', site: 'remark' });
		const u2 = genUser({ uid: 'u2', name: 'User Two', site: 'remark' });

		const remarkSite: SiteDocument = {
			_id: 'remark',
			enabled: true,
			key: '12345',
			posts: [
				{
					url: '127.0.0.1',
					readOnly: false
				},
				{
					url: '127.0.0.2',
					readOnly: false
				}
			],
			adminEmail: 'admin.test@example.com'
		};

		const emptySite: SiteDocument = {
			_id: 'empty',
			enabled: true,
			key: '12345',
			posts: [
				{
					url: '127.0.0.1',
					readOnly: false
				},
				{
					url: '127.0.0.2',
					readOnly: false
				}
			],
			adminEmail: ''
		};

		await sites.insertMany([remarkSite, emptySite]);
		await comments.insertMany([c1, c2, c3, c4, c5]);
		await users.insertMany([u1, u2]);

		// Unknown site
		expect(await StoreMongoDAO.getSiteInfo(client, 'unknown')).toEqual([]);

		// Empty site
		expect(await StoreMongoDAO.getSiteInfo(client, 'empty')).toEqual([]);

		// Unknown site
		expect(await StoreMongoDAO.getSiteInfo(client, 'remark')).toEqual([
			{
				url: '127.0.0.1',
				count: 3,
				last_time: new Time('2020-09-08T00:02:00Z')
			},
			{
				url: '127.0.0.2',
				count: 2,
				last_time: new Time('2022-09-09T00:02:00Z')
			}
		]);
	});

	test('getUserDetail works', async () => {
		const u1 = genUser({ uid: 'u1', name: 'User One', site: 'remark', email: 'e1', telegram: '' });
		const u2 = genUser({ uid: 'u2', name: 'User Two', site: 'remark', email: '', telegram: 't2' });

		const remarkSite: SiteDocument = {
			_id: 'remark',
			enabled: true,
			key: '12345',
			posts: [
				{
					url: '127.0.0.1',
					readOnly: false
				},
				{
					url: '127.0.0.2',
					readOnly: false
				}
			],
			adminEmail: 'admin.test@example.com'
		};

		await sites.insertOne(remarkSite);
		await users.insertMany([u1, u2]);

		// Unknown site
		expect(await StoreMongoDAO.getUserDetail(client, 'unknown', 'unknown', UserEmail)).toEqual([]);

		// Unknown user
		expect(await StoreMongoDAO.getUserDetail(client, 'remark', 'unknown', UserEmail)).toEqual([]);

		// Missing detail
		expect(await StoreMongoDAO.getUserDetail(client, 'remark', u1.uid, UserTelegram)).toEqual([]);
		expect(await StoreMongoDAO.getUserDetail(client, 'remark', u1.uid, UserEmail)).toMatchObject([
			{
				user_id: u1.uid,
				email: u1.email
			}
		]);

		// Missing detail
		expect(await StoreMongoDAO.getUserDetail(client, 'remark', u2.uid, UserEmail)).toEqual([]);
		expect(await StoreMongoDAO.getUserDetail(client, 'remark', u2.uid, UserTelegram)).toMatchObject([
			{
				user_id: u2.uid,
				telegram: u2.telegram
			}
		]);
	});

	test('setUserDetail works', async () => {
		const u1 = genUser({ uid: 'u1', name: 'User One', site: 'remark', email: 'e1', telegram: '' });
		const u2 = genUser({ uid: 'u2', name: 'User Two', site: 'remark', email: '', telegram: 't2' });

		const remarkSite: SiteDocument = {
			_id: 'remark',
			enabled: true,
			key: '12345',
			posts: [
				{
					url: '127.0.0.1',
					readOnly: false
				},
				{
					url: '127.0.0.2',
					readOnly: false
				}
			],
			adminEmail: 'admin.test@example.com'
		};

		await sites.insertOne(remarkSite);
		await users.insertMany([u1, u2]);

		// Update existing
		await StoreMongoDAO.setUserDetail(client, 'remark', u1.uid, UserEmail, 'update1');
		await StoreMongoDAO.setUserDetail(client, 'remark', u2.uid, UserTelegram, 'update2');

		// Update new
		await StoreMongoDAO.setUserDetail(client, 'remark', u1.uid, UserTelegram, 'update-new-1');
		await StoreMongoDAO.setUserDetail(client, 'remark', u2.uid, UserEmail, 'update-new-2');

		expect(await StoreMongoDAO.getUserDetail(client, 'remark', u1.uid, UserEmail)).toMatchObject([{ user_id: u1.uid, email: 'update1' }]);
		expect(await StoreMongoDAO.getUserDetail(client, 'remark', u1.uid, UserTelegram)).toMatchObject([
			{ user_id: u1.uid, telegram: 'update-new-1' }
		]);
		expect(await StoreMongoDAO.getUserDetail(client, 'remark', u2.uid, UserEmail)).toMatchObject([{ user_id: u2.uid, email: 'update-new-2' }]);
		expect(await StoreMongoDAO.getUserDetail(client, 'remark', u2.uid, UserTelegram)).toMatchObject([{ user_id: u2.uid, telegram: 'update2' }]);
	});

	test('listSiteUsersDetails works', async () => {
		const u1 = genUser({ uid: 'u1', name: 'User One', site: 'remark', email: 'e1', telegram: '' });
		const u2 = genUser({ uid: 'u2', name: 'User Two', site: 'remark', email: '', telegram: 't2' });
		const u3 = genUser({ uid: 'u3', name: 'User Three', site: 'empty', email: 'e3', telegram: 't3' });
		const u4 = genUser({ uid: 'u4', name: 'User Four', site: 'empty', email: '', telegram: '' });

		const remarkSite: SiteDocument = {
			_id: 'remark',
			enabled: true,
			key: '12345',
			posts: [
				{
					url: '127.0.0.1',
					readOnly: false
				},
				{
					url: '127.0.0.2',
					readOnly: false
				}
			],
			adminEmail: 'admin.test@example.com'
		};

		const emptySite: SiteDocument = {
			_id: 'empty',
			enabled: true,
			key: '12345',
			posts: [
				{
					url: '127.0.0.1',
					readOnly: false
				},
				{
					url: '127.0.0.2',
					readOnly: false
				}
			],
			adminEmail: ''
		};

		await sites.insertMany([remarkSite, emptySite]);
		await users.insertMany([u1, u2, u3, u4]);

		// Unknown site
		expect(await StoreMongoDAO.listSiteUsersDetails(client, 'unknown')).toEqual([]);

		expect(await StoreMongoDAO.listSiteUsersDetails(client, 'remark')).toEqual([
			{
				user_id: u1.uid,
				email: u1.email
			},
			{
				user_id: u2.uid,
				telegram: u2.telegram
			}
		]);

		expect(await StoreMongoDAO.listSiteUsersDetails(client, 'empty')).toEqual([
			{
				user_id: u3.uid,
				email: u3.email
			},
			{
				user_id: u3.uid,
				telegram: u3.telegram
			}
		]);
	});

	test('deleteUserDetail works', async () => {
		const u1 = genUser({ uid: 'u1', name: 'User One', site: 'remark', email: 'e1', telegram: 't1' });
		const u2 = genUser({ uid: 'u2', name: 'User Two', site: 'remark', email: 'e2', telegram: 't2' });

		const remarkSite: SiteDocument = {
			_id: 'remark',
			enabled: true,
			key: '12345',
			posts: [
				{
					url: '127.0.0.1',
					readOnly: false
				},
				{
					url: '127.0.0.2',
					readOnly: false
				}
			],
			adminEmail: 'admin.test@example.com'
		};

		await sites.insertOne(remarkSite);
		await users.insertMany([u1, u2]);

		await StoreMongoDAO.deleteUserDetail(client, 'remark', u1.uid, UserEmail);
		expect(await StoreMongoDAO.getUserDetail(client, 'remark', u1.uid, UserEmail)).toMatchObject([]);
		expect(await StoreMongoDAO.getUserDetail(client, 'remark', u1.uid, UserTelegram)).toMatchObject([{ user_id: u1.uid, telegram: 't1' }]);

		await StoreMongoDAO.deleteUserDetail(client, 'remark', u1.uid, UserTelegram);
		expect(await StoreMongoDAO.getUserDetail(client, 'remark', u1.uid, UserEmail)).toMatchObject([]);
		expect(await StoreMongoDAO.getUserDetail(client, 'remark', u1.uid, UserTelegram)).toMatchObject([]);

		await StoreMongoDAO.deleteUserDetail(client, 'remark', u2.uid, AllUserDetails);
		expect(await StoreMongoDAO.getUserDetail(client, 'remark', u2.uid, UserEmail)).toMatchObject([]);
		expect(await StoreMongoDAO.getUserDetail(client, 'remark', u2.uid, UserTelegram)).toMatchObject([]);
	});

	test('deleteSite works', async () => {
		const u1 = genUser({ uid: 'u1', name: 'User One', site: 'remark' });
		const u2 = genUser({ uid: 'u2', name: 'User Two', site: 'remark' });
		const u3 = genUser({ uid: 'u3', name: 'User Three', site: 'empty' });
		const u4 = genUser({ uid: 'u4', name: 'User Four', site: 'empty' });

		const c1 = genComment({ cid: 'c1', user: 'u1', time: new Date('2020-09-08T00:00:00Z'), locator: { site: 'remark', url: '127.0.0.1' } });
		const c2 = genComment({ cid: 'c2', user: 'u2', time: new Date('2020-09-08T00:01:00Z'), locator: { site: 'remark', url: '127.0.0.2' } });
		const c3 = genComment({ cid: 'c3', user: 'u3', time: new Date('2020-09-08T00:02:00Z'), locator: { site: 'empty', url: '127.0.0.1' } });
		const c4 = genComment({ cid: 'c4', user: 'u4', time: new Date('2020-09-08T00:02:00Z'), locator: { site: 'empty', url: '127.0.0.2' } });

		const remarkSite: SiteDocument = {
			_id: 'remark',
			enabled: true,
			key: '12345',
			posts: [
				{
					url: '127.0.0.1',
					readOnly: false
				},
				{
					url: '127.0.0.2',
					readOnly: false
				}
			],
			adminEmail: 'admin.test@example.com'
		};

		const emptySite: SiteDocument = {
			_id: 'empty',
			enabled: true,
			key: '12345',
			posts: [
				{
					url: '127.0.0.1',
					readOnly: false
				},
				{
					url: '127.0.0.2',
					readOnly: false
				}
			],
			adminEmail: ''
		};

		await sites.insertMany([remarkSite, emptySite]);
		await comments.insertMany([c1, c2, c3, c4]);
		await users.insertMany([u1, u2, u3, u4]);

		await StoreMongoDAO.deleteSite(client, 'remark');
		expect(await sites.countDocuments()).toBe(1);
		expect(await comments.countDocuments()).toBe(2);
		expect(await users.countDocuments()).toBe(2);

		await StoreMongoDAO.deleteSite(client, 'empty');
		expect(await sites.countDocuments()).toBe(0);
		expect(await comments.countDocuments()).toBe(0);
		expect(await users.countDocuments()).toBe(0);
	});

	test('deleteUser works', async () => {
		const u1 = genUser({ uid: 'u1', name: 'User One', site: 'remark' });
		const u2 = genUser({ uid: 'u2', name: 'User Two', site: 'remark' });
		const u3 = genUser({ uid: 'u3', name: 'User Three', site: 'empty' });
		const u4 = genUser({ uid: 'u4', name: 'User Four', site: 'empty' });

		const c1 = genComment({ cid: 'c1', user: 'u1', time: new Date('2020-09-08T00:00:00Z'), locator: { site: 'remark', url: '127.0.0.1' } });
		const c2 = genComment({ cid: 'c2', user: 'u2', time: new Date('2020-09-08T00:01:00Z'), locator: { site: 'remark', url: '127.0.0.2' } });
		const c3 = genComment({ cid: 'c3', user: 'u3', time: new Date('2020-09-08T00:02:00Z'), locator: { site: 'empty', url: '127.0.0.1' } });
		const c4 = genComment({ cid: 'c4', user: 'u4', time: new Date('2020-09-08T00:02:00Z'), locator: { site: 'empty', url: '127.0.0.2' } });

		const remarkSite: SiteDocument = {
			_id: 'remark',
			enabled: true,
			key: '12345',
			posts: [
				{
					url: '127.0.0.1',
					readOnly: false
				},
				{
					url: '127.0.0.2',
					readOnly: false
				}
			],
			adminEmail: 'admin.test@example.com'
		};

		const emptySite: SiteDocument = {
			_id: 'empty',
			enabled: true,
			key: '12345',
			posts: [
				{
					url: '127.0.0.1',
					readOnly: false
				},
				{
					url: '127.0.0.2',
					readOnly: false
				}
			],
			adminEmail: ''
		};

		await sites.insertMany([remarkSite, emptySite]);
		await comments.insertMany([c1, c2, c3, c4]);
		await users.insertMany([u1, u2, u3, u4]);

		await StoreMongoDAO.deleteUser(client, 'remark', u1.uid, HardDelete);
		expect(await sites.countDocuments()).toBe(2);
		expect(await comments.countDocuments()).toBe(4);
		expect(await users.countDocuments()).toBe(3);

		await StoreMongoDAO.deleteUser(client, 'remark', u2.uid, HardDelete);
		expect(await sites.countDocuments()).toBe(2);
		expect(await comments.countDocuments()).toBe(4);
		expect(await users.countDocuments()).toBe(2);

		await StoreMongoDAO.deleteUser(client, 'remark', u3.uid, SoftDelete);
		expect(await sites.countDocuments()).toBe(2);
		expect(await comments.countDocuments()).toBe(4);
		expect(await users.countDocuments()).toBe(2);

		await StoreMongoDAO.deleteUser(client, 'remark', u4.uid, SoftDelete);
		expect(await sites.countDocuments()).toBe(2);
		expect(await comments.countDocuments()).toBe(4);
		expect(await users.countDocuments()).toBe(2);
	});
});
