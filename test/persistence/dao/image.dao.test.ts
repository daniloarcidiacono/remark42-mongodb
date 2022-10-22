import { Collection, Db, Filter, GridFSBucket, GridFSFile, MongoClient } from 'mongodb';

import { describe, expect, test } from '@jest/globals';
import { ImageMongoDAO } from '@persistence/dao/image.dao';
import { getImagesBucket, getImagesFilesCollection } from '@persistence/dao/utils';
import { Time } from '@util/time';

jest.mock('@logging/index');

describe('ImageMongoDAO', () => {
	let client: MongoClient;
	let db: Db;
	let images: Collection<GridFSFile>;
	let imagesBucket: GridFSBucket;

	async function expectFile(filter: Filter<GridFSFile>, cb?: (file: GridFSFile) => Promise<void>): Promise<void> {
		const gridFSFiles = await imagesBucket.find(filter).toArray();
		expect(gridFSFiles.length).toBe(1);

		if (cb) {
			return cb(gridFSFiles[0]);
		}
	}

	async function expectNoFile(filter: Filter<GridFSFile>) {
		const gridFSFiles = await imagesBucket.find(filter).toArray();
		expect(gridFSFiles.length).toBe(0);
	}

	beforeAll(async () => {
		// Connect
		client = await MongoClient.connect(global.__MONGO_URI__);
		db = await client.db(global.__MONGO_DB_NAME__);
		images = getImagesFilesCollection(client);
		imagesBucket = getImagesBucket(client);

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

		try {
			await imagesBucket.drop();
		} catch (e) {
			// Shut errors
		}
	});

	test('saveStagingImage works', async () => {
		const uploadDate: Date = new Date(2020, 1, 1, 12, 0, 0);
		jest.setSystemTime(uploadDate);

		await ImageMongoDAO.saveStagingImage(client, 'u1/image-1', Buffer.from('image-1-data'));
		await expectFile({ filename: 'u1/image-1' }, async (file: GridFSFile) => {
			expect(file.uploadDate).toEqual(uploadDate);
			expect(file.metadata.staging).toBe(true);
			expect(file.metadata.cleanupTimer).toEqual(uploadDate);
		});
	});

	test('commitImage works', async () => {
		await ImageMongoDAO.saveStagingImage(client, 'u1/image-1', Buffer.from('image-1-data'));
		await ImageMongoDAO.commitImage(client, 'u1/image-1');
		await expectFile({ filename: 'u1/image-1' }, async (file: GridFSFile) => {
			expect(file.metadata.staging).toBe(false);
		});
	});

	test('loadImage works', async () => {
		await ImageMongoDAO.saveStagingImage(client, 'u1/image-1', Buffer.from('image-1-data'));
		expect(await ImageMongoDAO.loadImage(client, 'u1/image-1')).toEqual(Buffer.from('image-1-data').toString('base64'));
		await ImageMongoDAO.commitImage(client, 'u1/image-1');
		expect(await ImageMongoDAO.loadImage(client, 'u1/image-1')).toEqual(Buffer.from('image-1-data').toString('base64'));
	});

	test('expireImages works', async () => {
		const uploadDate: Date = new Date(2020, 1, 1, 12, 0, 0);
		const expireDate: Date = new Date(2020, 1, 1, 12, 0, 2);
		jest.setSystemTime(uploadDate);

		await ImageMongoDAO.saveStagingImage(client, 'u1/image-1', Buffer.from('image-1-data'));
		await ImageMongoDAO.expireImages(client, 1 * 1e3);
		await expectFile({ filename: 'u1/image-1' });

		jest.setSystemTime(expireDate);
		await ImageMongoDAO.expireImages(client, 1 * 1e3);
		await expectNoFile({ filename: 'u1/image-1' });
	});

	test('resetCleanupTimer works', async () => {
		const uploadDate: Date = new Date(2020, 1, 1, 12, 0, 0);
		const expireDate: Date = new Date(2020, 1, 1, 12, 0, 2);
		jest.setSystemTime(uploadDate);

		await ImageMongoDAO.saveStagingImage(client, 'u1/image-1', Buffer.from('image-1-data'));
		await expectFile({ filename: 'u1/image-1' }, async (file: GridFSFile) => {
			expect(file.uploadDate).toEqual(uploadDate);
			expect(file.metadata.staging).toBe(true);
			expect(file.metadata.cleanupTimer).toEqual(uploadDate);
		});

		jest.setSystemTime(expireDate);
		await ImageMongoDAO.resetCleanupTimer(client, 'u1/image-1');
		await expectFile({ filename: 'u1/image-1' }, async (file: GridFSFile) => {
			expect(file.uploadDate).toEqual(uploadDate);
			expect(file.metadata.staging).toBe(true);
			expect(file.metadata.cleanupTimer).toEqual(expireDate);
		});
	});

	test('stagingInfo works', async () => {
		expect(await ImageMongoDAO.stagingInfo(client)).toMatchObject({
			FirstStagingImageTS: Time.zero()
		});

		const uploadDate: Date = new Date(2020, 1, 1, 12, 0, 0);
		const expireDate: Date = new Date(2020, 1, 1, 12, 0, 2);

		jest.setSystemTime(expireDate);
		await ImageMongoDAO.saveStagingImage(client, 'u1/image-2', Buffer.from('image-2-data'));
		expect(await ImageMongoDAO.stagingInfo(client)).toMatchObject({
			FirstStagingImageTS: new Time(expireDate.toJSON())
		});

		jest.setSystemTime(uploadDate);
		await ImageMongoDAO.saveStagingImage(client, 'u1/image-1', Buffer.from('image-1-data'));
		expect(await ImageMongoDAO.stagingInfo(client)).toMatchObject({
			FirstStagingImageTS: new Time(uploadDate.toJSON())
		});
	});

	test('expireImages is based on cleanupTimer', async () => {
		const uploadDate: Date = new Date(2020, 1, 1, 12, 0, 0);
		const expireDate: Date = new Date(2020, 1, 1, 12, 0, 2);
		jest.setSystemTime(uploadDate);

		await ImageMongoDAO.saveStagingImage(client, 'u1/image-1', Buffer.from('image-1-data'));
		await ImageMongoDAO.expireImages(client, 1 * 1e9);
		await expectFile({ filename: 'u1/image-1' });

		jest.setSystemTime(expireDate);
		await ImageMongoDAO.resetCleanupTimer(client, 'u1/image-1');
		await ImageMongoDAO.expireImages(client, 1 * 1e9);
		await expectFile({ filename: 'u1/image-1' });
	});

	test('expireImages works only on staged images', async () => {
		const uploadDate: Date = new Date(2020, 1, 1, 12, 0, 0);
		const expireDate: Date = new Date(2020, 1, 1, 12, 0, 2);
		jest.setSystemTime(uploadDate);

		await ImageMongoDAO.saveStagingImage(client, 'u1/image-1', Buffer.from('image-1-data'));
		await ImageMongoDAO.expireImages(client, 1 * 1e9);
		await expectFile({ filename: 'u1/image-1' });

		jest.setSystemTime(expireDate);
		await ImageMongoDAO.commitImage(client, 'u1/image-1');
		await ImageMongoDAO.expireImages(client, 1 * 1e9);
		await expectFile({ filename: 'u1/image-1' });
	});

	test('stagingInfo works only on staged images', async () => {
		expect(await ImageMongoDAO.stagingInfo(client)).toMatchObject({
			FirstStagingImageTS: Time.zero()
		});

		const uploadDate: Date = new Date(2020, 1, 1, 12, 0, 0);
		const expireDate: Date = new Date(2020, 1, 1, 12, 0, 2);

		jest.setSystemTime(expireDate);
		await ImageMongoDAO.saveStagingImage(client, 'u1/image-2', Buffer.from('image-2-data'));
		expect(await ImageMongoDAO.stagingInfo(client)).toMatchObject({
			FirstStagingImageTS: new Time(expireDate.toJSON())
		});

		jest.setSystemTime(uploadDate);
		await ImageMongoDAO.saveStagingImage(client, 'u1/image-1', Buffer.from('image-1-data'));
		await ImageMongoDAO.commitImage(client, 'u1/image-1');
		expect(await ImageMongoDAO.stagingInfo(client)).toMatchObject({
			FirstStagingImageTS: new Time(expireDate.toJSON())
		});
	});

	test('deleteUsersImages works', async () => {
		await ImageMongoDAO.saveStagingImage(client, 'u1/image-1', Buffer.from('u1-image-1-data'));
		await ImageMongoDAO.saveStagingImage(client, 'u1/image-2', Buffer.from('u1-image-2-data'));
		await ImageMongoDAO.saveStagingImage(client, 'u2/image-1', Buffer.from('u2-image-1-data'));

		await ImageMongoDAO.deleteUserImages(client, ['u1']);
		await expectNoFile({ filename: 'u1/image-1' });
		await expectNoFile({ filename: 'u1/image-2' });
		await expectFile({ filename: 'u2/image-1' });

		await ImageMongoDAO.deleteUserImages(client, ['u2']);
		await expectNoFile({ filename: 'u2/image-1' });
	});

	test('extractPictureName works', async () => {
		expect(ImageMongoDAO.extractPictureName(null)).toBe(null);
		expect(ImageMongoDAO.extractPictureName('')).toBe(null);
		expect(ImageMongoDAO.extractPictureName('http://127.0.0.1')).toBe(null);
		expect(ImageMongoDAO.extractPictureName('wrong')).toBe(null);
		expect(ImageMongoDAO.extractPictureName('http://127.0.0.1:8080/api/v1/avatar/84ba332926547c2ce95e12147c3bf13404613730.image')).toBe(
			'84ba332926547c2ce95e12147c3bf13404613730.image'
		);
	});
});
