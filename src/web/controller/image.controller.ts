import {
	CleanupResponse,
	CommitResponse,
	InfoResponse,
	LoadResponse,
	ResetCleanupTimerResponse,
	SaveRequest,
	SaveResponse
} from '@remark42/dto/image.dto';
import clientPromise from '@persistence/mongodb';
import { ImageMongoDAO } from '@persistence/dao/image.dao';
import { ImageAPI } from '@remark42/api/image.api';

export class ImageMongoController implements ImageAPI {
	public Cleanup = async (ttl: number): Promise<CleanupResponse> => {
		const client = await clientPromise;

		// Convert the image TTL from nanoseconds to milliseconds
		const imagesTtl: number = Math.max(0, Math.round(ttl * 1e-6));

		// To avoid removing the user avatar before he comments, we wait 4 hours before removing any avatar.
		const avatarTtl: number = 4 * 60 * 60 * 1e3;

		// prettier-ignore
		await Promise.all([
			ImageMongoDAO.expireImages(client, imagesTtl),
			ImageMongoDAO.cleanupAvatars(client, avatarTtl)
		]);
	};

	public Commit = async (id: string): Promise<CommitResponse> => {
		const client = await clientPromise;
		return ImageMongoDAO.commitImage(client, id);
	};

	public Info = async (): Promise<InfoResponse> => {
		const client = await clientPromise;
		return ImageMongoDAO.stagingInfo(client);
	};

	public Load = async (id: string): Promise<LoadResponse> => {
		const client = await clientPromise;
		return ImageMongoDAO.loadImage(client, id);
	};

	public ResetCleanupTimer = async (id: string): Promise<ResetCleanupTimerResponse> => {
		const client = await clientPromise;
		return ImageMongoDAO.resetCleanupTimer(client, id);
	};

	public Save = async ([id, imgBase64]: SaveRequest): Promise<SaveResponse> => {
		const client = await clientPromise;

		// prettier-ignore
		return ImageMongoDAO.saveStagingImage(
			client,
			id,
			Buffer.from(imgBase64 as unknown as string, 'base64')
		);
	};
}
