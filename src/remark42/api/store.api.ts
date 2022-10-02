import { JRpcRoutes } from '@web/jrpc/router';
import {
	BlockedUser,
	CloseResponse,
	Comment,
	CommentResponse,
	CountResponse,
	DeleteRequest,
	DeleteResponse,
	FindRequest,
	FindResponse,
	FlagRequest,
	FlagResponse,
	GetRequest,
	GetResponse,
	InfoRequest,
	InfoResponse,
	UserDetailRequest,
	UserDetailResponse
} from '@remark42/dto/store.dto';

export interface StoreAPI {
	// Create new comment
	Create(comment: Comment): Promise<CommentResponse>;

	// Find returns all comments for post and sorts results
	Find(req: FindRequest): Promise<FindResponse>;

	// Get returns comment for locator.URL and commentID string
	Get(req: GetRequest): Promise<GetResponse>;

	// Update updates comment for locator.URL with mutable part of comment
	Update(comment: Comment): Promise<void>;

	// Count returns number of comments for post or user
	Count(req: FindRequest): Promise<CountResponse>;

	// Info get post(s) meta info
	Info(req: InfoRequest): Promise<InfoResponse>;

	// Flag sets and gets flag values
	Flag(req: FlagRequest): Promise<FlagResponse>;

	// ListFlags get list of flagged keys, like blocked & verified user
	// works for full locator (post flags) or with userID
	ListFlags(req: FlagRequest): Promise<string[] | BlockedUser[]>;

	// UserDetail sets or gets single detail value, or gets all details for requested site.
	// UserDetail returns list even for single entry request is a compromise in order to have both single detail getting and setting
	// and all site's details listing under the same function (and not to extend engine interface by two separate functions).
	UserDetail(req: UserDetailRequest): Promise<UserDetailResponse>;

	// Delete post(s), user, comment, user details, or everything
	Delete(req: DeleteRequest): Promise<DeleteResponse>;

	Close(): Promise<CloseResponse>;
}

export function storeRoutes(storeAPI: StoreAPI) {
	return {
		'store.count': storeAPI.Count,
		'store.find': storeAPI.Find,
		'store.flag': storeAPI.Flag,
		'store.user_detail': storeAPI.UserDetail,
		'store.create': storeAPI.Create,
		'store.get': storeAPI.Get,
		'store.update': storeAPI.Update,
		'store.delete': storeAPI.Delete,
		'store.list_flags': storeAPI.ListFlags,
		'store.info': storeAPI.Info,
		'store.close': storeAPI.Close
	} as JRpcRoutes;
}
