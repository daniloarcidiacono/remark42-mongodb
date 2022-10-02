import { Collection, Db, MongoClient } from 'mongodb';
import { AdminMongoController } from '@web/controller/admin.controller';
import { describe, expect, test } from '@jest/globals';
import { getCommentsCollection, getSitesCollection, getUsersCollection } from '@persistence/dao/utils';
import { CommentDocument } from '@persistence/entity/comment.entity';
import { SiteDocument } from '@persistence/entity/site.entity';
import { UserDocument } from '@persistence/entity/user.entity';
import clientPromise from '@persistence/mongodb';
import { createIndices } from '@persistence/utils';
import { genUser } from '../../utils';
import { EvCreate, EvDelete, EvUpdate, EvVote } from '@remark42/dto/admin.dto';

jest.mock('@persistence/mongodb', () => ({
	__esModule: true,
	default: MongoClient.connect(global.__MONGO_URI__)
}));

describe('AdminMongoController', () => {
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

	test('Admins works', async () => {
		const storeController: AdminMongoController = new AdminMongoController();

		// Same user id on different sites
		const u1 = genUser({ uid: 'u1', name: 'User One', site: 's1', admin: true });
		const u2 = genUser({ uid: 'u2', name: 'User Two', site: 's1', admin: false });
		const u3 = genUser({ uid: 'u1', name: 'User Three', site: 's2', admin: true });
		const u4 = genUser({ uid: 'u2', name: 'User Four', site: 's2', admin: true });
		const s1: SiteDocument = {
			_id: 's1',
			enabled: true,
			key: '12345',
			adminEmail: 'admin@example.com',
			posts: []
		};
		const s2: SiteDocument = {
			_id: 's2',
			enabled: true,
			key: '12345',
			adminEmail: 'admin@example.com',
			posts: []
		};
		await sites.insertMany([s1, s2]);
		await users.insertMany([u1, u2, u3, u4]);

		// Unknown site
		expect(await storeController.Admins('unknown')).toEqual([]);
		expect(await storeController.Admins('s1')).toEqual(['u1']);
		expect(await storeController.Admins('s2')).toEqual(['u1', 'u2']);
	});

	test('Email works', async () => {
		const storeController: AdminMongoController = new AdminMongoController();
		const s1: SiteDocument = {
			_id: 's1',
			enabled: true,
			key: '12345',
			adminEmail: 'admin.s1@example.com',
			posts: []
		};
		const s2: SiteDocument = {
			_id: 's2',
			enabled: true,
			key: '12345',
			adminEmail: 'admin.s2@example.com',
			posts: []
		};
		await sites.insertMany([s1, s2]);

		// Unknown site
		expect(await storeController.Email('unknown')).toEqual('');
		expect(await storeController.Email('s1')).toEqual('admin.s1@example.com');
		expect(await storeController.Email('s2')).toEqual('admin.s2@example.com');
	});

	test('Enabled works', async () => {
		const storeController: AdminMongoController = new AdminMongoController();
		const s1: SiteDocument = {
			_id: 's1',
			enabled: true,
			key: '12345',
			adminEmail: 'admin.s1@example.com',
			posts: []
		};
		const s2: SiteDocument = {
			_id: 's2',
			enabled: false,
			key: '12345',
			adminEmail: 'admin.s2@example.com',
			posts: []
		};
		await sites.insertMany([s1, s2]);

		// Unknown site
		expect(await storeController.Enabled('unknown')).toEqual(false);
		expect(await storeController.Enabled('s1')).toEqual(true);
		expect(await storeController.Enabled('s2')).toEqual(false);
	});

	test('Key works', async () => {
		const storeController: AdminMongoController = new AdminMongoController();
		const s1: SiteDocument = {
			_id: 's1',
			enabled: true,
			key: '12345',
			adminEmail: 'admin.s1@example.com',
			posts: []
		};
		const s2: SiteDocument = {
			_id: 's2',
			enabled: true,
			key: '54321',
			adminEmail: 'admin.s2@example.com',
			posts: []
		};
		await sites.insertMany([s1, s2]);

		// Unknown site
		expect(await storeController.Key('unknown')).toEqual('');
		expect(await storeController.Key('s1')).toEqual('12345');
		expect(await storeController.Key('s2')).toEqual('54321');
	});

	test('OnEvent works', async () => {
		const storeController: AdminMongoController = new AdminMongoController();

		// Unknown site
		await storeController.OnEvent(['unknown', EvCreate]);
		await storeController.OnEvent(['s1', EvVote]);
		await storeController.OnEvent(['s2', EvUpdate]);
		await storeController.OnEvent(['s2', EvDelete]);
	});
});
