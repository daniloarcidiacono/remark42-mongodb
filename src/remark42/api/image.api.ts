import {
	CleanupResponse,
	CommitResponse,
	InfoResponse,
	LoadResponse,
	ResetCleanupTimerResponse,
	SaveRequest,
	SaveResponse
} from '@remark42/dto/image.dto';
import { JRpcRoutes } from '@web/jrpc/router';

export interface ImageAPI {
	// Save stores image with passed id to staging
	Save([id, img]: SaveRequest): Promise<SaveResponse>;

	// Load image by ID
	Load(id: string): Promise<LoadResponse>;

	// Commit moves image from staging to permanent
	Commit(id: string): Promise<CommitResponse>;

	// Cleanup runs removal loop for old images on staging
	Cleanup(ttl: number): Promise<CleanupResponse>;

	// Info returns meta information about storage
	Info(): Promise<InfoResponse>;

	// ResetCleanupTimer resets cleanup timer for the image
	ResetCleanupTimer(id: string): Promise<ResetCleanupTimerResponse>;
}

export function imageRoutes(imageAPI: ImageAPI) {
	return {
		'image.info': imageAPI.Info,
		'image.load': imageAPI.Load,
		'image.commit': imageAPI.Commit,
		'image.cleanup': imageAPI.Cleanup,
		'image.reset_cleanup_timer': imageAPI.ResetCleanupTimer,
		'image.save_with_id': imageAPI.Save
	} as JRpcRoutes;
}
