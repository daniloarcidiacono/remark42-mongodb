import { Collection, GridFSBucket, GridFSFile, MongoClient, UpdateResult, WithId } from 'mongodb';
import {
	getAvatarsBucket,
	getAvatarsFilesCollection,
	getImagesBucket,
	getImagesFilesCollection,
	getUsersCollection,
	hasAvatars
} from '@persistence/dao/utils';
import { Readable, Stream } from 'stream';
import { pipeline } from 'stream/promises';
import { Time } from '@util/time';
import { InfoResponse } from '@remark42/dto/image.dto';

export abstract class ImageMongoDAO {
	/**
	 * Saves an image as staging.
	 *
	 * @param client the mongodb client
	 * @param id the image id
	 * @param imgBinary the image binary buffer
	 */
	public static async saveStagingImage(client: MongoClient, id: string, imgBinary: Buffer): Promise<void> {
		const stagingBucket: GridFSBucket = getImagesBucket(client);

		// https://stackoverflow.com/a/65938887
		await pipeline(
			Readable.from(imgBinary),
			stagingBucket.openUploadStream(id, {
				chunkSizeBytes: 1048576,
				metadata: { staging: true, cleanupTimer: new Date(), userId: id.split('/')[0] }
			})
		);
	}

	/**
	 * Loads an image (first committed then staged).
	 *
	 * @param client the mongodb client
	 * @param filename the image file name
	 * @return the image encoded in base64
	 */
	public static async loadImage(client: MongoClient, filename: string): Promise<string> {
		const imagesBucket: GridFSBucket = getImagesBucket(client);
		const gridFSFiles = await imagesBucket.find({ filename }).toArray();
		if (gridFSFiles.length === 0) {
			throw `Image '${filename}' not found`;
		}

		// Try with committed images first
		const committedImageFile = gridFSFiles.find(file => file.metadata.staging === false);
		if (committedImageFile) {
			const imageBuffer: Buffer = await ImageMongoDAO.stream2buffer(imagesBucket.openDownloadStream(committedImageFile._id));
			return imageBuffer.toString('base64');
		}

		// Try with staging
		const stagedImageFile = gridFSFiles.find(file => file.metadata.staging === true);
		if (stagedImageFile) {
			const imageBuffer: Buffer = await ImageMongoDAO.stream2buffer(imagesBucket.openDownloadStream(stagedImageFile._id));
			return imageBuffer.toString('base64');
		}

		// Should never reach here
		throw `Image '${filename}' not found`;
	}

	private static async stream2buffer(stream: Stream): Promise<Buffer> {
		// https://stackoverflow.com/a/67729663
		return new Promise<Buffer>((resolve, reject) => {
			const _buf = Array<any>();

			stream.on('data', chunk => _buf.push(chunk));
			stream.on('end', () => resolve(Buffer.concat(_buf)));
			stream.on('error', err => reject(`error converting stream - ${err}`));
		});
	}

	/**
	 * Commits a staged image.
	 *
	 * @param client the mongodb client
	 * @param filename the image file name
	 */
	public static async commitImage(client: MongoClient, filename: string): Promise<void> {
		const images: Collection<GridFSFile> = getImagesFilesCollection(client);
		const updateResult: UpdateResult = await images.updateOne(
			{
				filename,
				'metadata.staging': true
			},
			{
				$set: {
					'metadata.staging': false
				} as unknown as Partial<any>
			}
		);

		if (updateResult.matchedCount !== 1) {
			throw `failed to commit ${filename}, not found in staging`;
		}
	}

	/**
	 * Expires staged images that have been inserted earlier than ttl
	 *
	 * @param client the mongodb client
	 * @param ttl the time-to-live span in milliseconds
	 */
	public static async expireImages(client: MongoClient, ttl: number): Promise<void> {
		// now - cleanupTimer > ttl
		// now - ttl > cleanupTimer
		const now = new Date().getTime();
		const cutoffDate: Date = new Date(now - ttl);

		// Get the ids of the image to delete
		const images: Collection<GridFSFile> = getImagesFilesCollection(client);
		const imagesToDelete: WithId<GridFSFile>[] = await images
			.find(
				{
					'metadata.staging': true,
					'metadata.cleanupTimer': {
						$lt: cutoffDate
					}
				},
				{
					projection: {
						_id: 1
					}
				}
			)
			.toArray();

		// Delete
		const imagesBucket: GridFSBucket = getImagesBucket(client);
		await Promise.all(imagesToDelete.map(image => imagesBucket.delete(image._id)));
	}

	/**
	 * Removes all the avatars that have been inserted earlier than ttl and are not referenced by any user.
	 *
	 * @param client the mongodb client
	 * @param ttl the time-to-live span in milliseconds
	 */
	public static async cleanupAvatars(client: MongoClient, ttl: number): Promise<void> {
		// Skip if no avatars stored on mongo
		if (!hasAvatars()) {
			return;
		}

		const usersCollection = getUsersCollection(client);
		const userPictureNames: string[] = (
			await usersCollection
				.find(
					{},
					{
						projection: {
							picture: 1
						}
					}
				)
				.toArray()
		)
			.map(document => ImageMongoDAO.extractPictureName(document.picture))
			.filter(imageName => imageName !== null);

		// The avatar is uploaded immediately on login, however the user data is not stored until the
		// first comment is posted. We only delete "old" avatars to avoid removing new ones before the user is
		// created.
		const now = new Date().getTime();
		const cutoffDate: Date = new Date(now - ttl);

		// Get the ids of the avatars to delete
		const avatars: Collection<GridFSFile> = getAvatarsFilesCollection(client);
		const avatarsToDelete: WithId<GridFSFile>[] = await avatars
			.find(
				{
					uploadDate: {
						$lt: cutoffDate
					},
					filename: {
						$nin: userPictureNames
					}
				},
				{
					projection: {
						_id: 1
					}
				}
			)
			.toArray();

		// Delete
		const avatarsBucket: GridFSBucket = getAvatarsBucket(client);
		await Promise.all(avatarsToDelete.map(avatar => avatarsBucket.delete(avatar._id)));
	}

	/**
	 * Resets the cleanup timer of a staged image.
	 *
	 * @param client the mongodb client
	 * @param filename the image file name
	 */
	public static async resetCleanupTimer(client: MongoClient, filename: string): Promise<void> {
		const images: Collection<GridFSFile> = getImagesFilesCollection(client);
		const updateResult: UpdateResult = await images.updateOne(
			{
				filename,
				'metadata.staging': true
			},
			{
				$set: {
					'metadata.cleanupTimer': new Date()
				} as unknown as Partial<any>
			}
		);

		if (updateResult.matchedCount !== 1) {
			throw `failed to reset cleanup timer ${filename}, not found in staging`;
		}
	}

	/**
	 * Returns statistics about the staged images.
	 *
	 * @param client the mongodb client
	 */
	public static async stagingInfo(client: MongoClient): Promise<InfoResponse> {
		const images: Collection<GridFSFile> = getImagesFilesCollection(client);
		const result = await images
			.aggregate<{ firstStagingImageTs: Date }>([
				{
					$match: {
						'metadata.staging': true
					}
				},
				{
					$project: {
						firstStagingImageTs: '$metadata.cleanupTimer'
					}
				},
				{
					$unwind: '$firstStagingImageTs'
				},
				{
					$group: {
						_id: null,
						firstStagingImageTs: {
							$min: '$firstStagingImageTs'
						}
					}
				}
			])
			.toArray();

		if (result.length === 0) {
			return {
				FirstStagingImageTS: Time.zero()
			};
		}

		return {
			FirstStagingImageTS: new Time(result[0].firstStagingImageTs.toJSON())
		};
	}

	/**
	 * Deletes all the users images (staged or not).
	 *
	 * @param client the mongodb client
	 * @param userIds the user ids
	 */
	public static async deleteUserImages(client: MongoClient, userIds: string[]): Promise<void> {
		// Get the ids of the image to delete
		const images: Collection<GridFSFile> = getImagesFilesCollection(client);
		const imagesToDelete: WithId<GridFSFile>[] = await images
			.find(
				{
					'metadata.userId': { $in: userIds }
				},
				{
					projection: {
						_id: 1
					}
				}
			)
			.toArray();

		// Delete
		const imagesBucket: GridFSBucket = getImagesBucket(client);
		await Promise.all(imagesToDelete.map(image => imagesBucket.delete(image._id)));
	}

	/**
	 * Extracts the picture filename from the url.
	 *
	 * @param pictureUrl the picture URL stored in the user
	 * @see <a href="https://stackoverflow.com/a/51795122">StackOverflow answer</a>
	 */
	public static extractPictureName(pictureUrl: string): string | null {
		try {
			const segments = new URL(pictureUrl).pathname.split('/');

			// Handle potential trailing slash
			const imageName = segments.pop() || segments.pop();

			// imageName can be empty for weird urls like "http://127.0.0.1"
			return imageName.length > 0 ? imageName : null;
		} catch (e) {
			return null;
		}
	}
}
