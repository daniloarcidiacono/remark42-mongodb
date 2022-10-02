import {
	AllUserDetails,
	Blocked,
	BlockedUser,
	CloseResponse,
	Comment,
	CommentResponse,
	CountResponse,
	DeleteRequest,
	DeleteResponse,
	FindRequest,
	FindResponse,
	FlagNonSet,
	FlagRequest,
	FlagResponse,
	FlagTrue,
	GetRequest,
	GetResponse,
	InfoRequest,
	InfoResponse,
	ReadOnly,
	UserDetailRequest,
	UserDetailResponse,
	UserEmail,
	UserTelegram,
	Verified
} from '@remark42/dto/store.dto';
import clientPromise from '@persistence/mongodb';
import { isBlank } from '@util/string';
import { StoreMongoDAO } from '@persistence/dao/store.dao';
import { SiteDocument } from '@persistence/entity/site.entity';
import { StoreAPI } from '@remark42/api/store.api';

export class StoreMongoController implements StoreAPI {
	public Close = async (): Promise<CloseResponse> => {
		// Do nothing
	};

	public Count = async (req: FindRequest): Promise<CountResponse> => {
		const client = await clientPromise;

		// If site not found return 0
		if (!(await StoreMongoDAO.siteExists(client, req.locator.site))) {
			return 0;
		}

		// if locator has url
		if (!isBlank(req.locator.url)) {
			// count all comments for a specific post
			return StoreMongoDAO.countPostComments(client, req.locator);
		}

		// if locator does not have url but request has userid
		if (!isBlank(req.user_id)) {
			// count all comments for a user in all posts
			return StoreMongoDAO.countUserComments(client, req.user_id, req.locator.site);
		}

		// otherwise throw
		throw `invalid count request ${req}`;
	};

	public Create = async (comment: Comment): Promise<CommentResponse> => {
		const client = await clientPromise;

		// Fetch the site and post
		const site: SiteDocument | null = await StoreMongoDAO.getPost(client, comment.locator);

		// Check that site exists
		if (site === null) {
			throw `site ${comment.locator.site} not found`;
		}

		// If no post found
		if (site.posts.length === 0) {
			// If we're not allowed to create posts dynamically, reject the comment
			if (!global.serverOpts.dynamicPosts) {
				throw `post ${comment.locator.url} not found`;
			}

			// Create a new post (non read-only)
			await StoreMongoDAO.createPost(client, comment.locator);
		} else {
			// Post found, check if it's read-only
			if (site.posts[0].readOnly) {
				throw `post ${comment.locator.url} is read-only`;
			}
		}

		// Create the user if it does not exist
		await StoreMongoDAO.createUser(client, comment.user);

		// Save the comment if not duplicated
		return StoreMongoDAO.createComment(client, comment);
	};

	public Delete = async (req: DeleteRequest): Promise<DeleteResponse> => {
		const client = await clientPromise;

		if (!isBlank(req.user_detail)) {
			// delete user detail
			// TODO: Original code uses req.user_id as unique key without site!
			// prettier-ignore
			return StoreMongoDAO.deleteUserDetail(client, req.locator.site, req.user_id, req.user_detail);
		} else if (!isBlank(req.locator.url) && !isBlank(req.comment_id)) {
			// delete comment
			// TODO: Original code uses locator.url as unique key without site!
			// prettier-ignore
			return StoreMongoDAO.deleteComment(client, req.locator, req.comment_id, req.del_mode);
		} else if (!isBlank(req.locator.site) && !isBlank(req.user_id) && isBlank(req.comment_id)) {
			// delete user
			// prettier-ignore
			return StoreMongoDAO.deleteUser(client, req.locator.site, req.user_id, req.del_mode);
		} else if (!isBlank(req.locator.site) && isBlank(req.locator.url) && isBlank(req.comment_id) && isBlank(req.user_id)) {
			// delete site
			return StoreMongoDAO.deleteSite(client, req.locator.site);
		}

		throw 'invalid delete request';
	};

	public Find = async (req: FindRequest): Promise<FindResponse> => {
		const client = await clientPromise;

		// If site not found throw
		if (!(await StoreMongoDAO.siteExists(client, req.locator.site))) {
			throw 'Site not found';
		}

		if (!isBlank(req.locator.site) && !isBlank(req.locator.url)) {
			// find post comments, i.e. for site and url
			// prettier-ignore
			return StoreMongoDAO.getPostComments(client, req.locator, req.since ? req.since.date : undefined, req.sort);
		} else if (!isBlank(req.locator.site) && isBlank(req.locator.url) && isBlank(req.user_id)) {
			// find last comments for site
			// prettier-ignore
			return StoreMongoDAO.getSiteLastComments(client, req.locator.site, req.limit,req.since ? req.since.date : undefined);
		} else if (!isBlank(req.locator.site) && !isBlank(req.user_id)) {
			// find comments for user
			// prettier-ignore
			return StoreMongoDAO.getSiteUserComments(client, req.locator.site, req.user_id, req.limit, req.skip);
		}

		throw 'invalid find request';
	};

	public Flag = async (req: FlagRequest): Promise<FlagResponse> => {
		const client = await clientPromise;

		if (req.update === undefined || req.update === null || req.update === FlagNonSet) {
			// read flag value, no update requested
			if (req.flag === ReadOnly) {
				return StoreMongoDAO.isPostReadOnly(client, req.locator);
			}

			if (req.flag === Blocked) {
				return StoreMongoDAO.isUserBlocked(client, req.locator.site, req.user_id);
			}

			if (req.flag === Verified) {
				return StoreMongoDAO.isUserVerified(client, req.locator.site, req.user_id);
			}
		}

		// write flag value
		const status = req.update === FlagTrue;
		if (req.flag === ReadOnly) {
			await StoreMongoDAO.setPostReadOnly(client, req.locator, status);
			return status;
		}

		if (req.flag === Blocked) {
			let blockUntil = null;
			if (req.update === FlagTrue) {
				if (req.ttl !== undefined && req.ttl.gt(0)) {
					blockUntil = new Date();
					blockUntil.setTime(req.ttl.ns * 1e-6);
				} else {
					// permanent is 100 years
					blockUntil = new Date();
					blockUntil.setFullYear(blockUntil.getFullYear() + 100);
				}
			}

			// prettier-ignore
			await StoreMongoDAO.setUserBlocked(client, req.locator.site, req.user_id, blockUntil);
			return status;
		}

		if (req.flag === Verified) {
			await StoreMongoDAO.setUserVerified(client, req.locator.site, req.user_id, status);
			return status;
		}

		throw `Invalid flag ${req.flag}`;
	};

	public Get = async (req: GetRequest): Promise<GetResponse> => {
		const client = await clientPromise;
		return StoreMongoDAO.getComment(client, req.locator, req.comment_id);
	};

	public Info = async (req: InfoRequest): Promise<InfoResponse> => {
		const client = await clientPromise;
		if (!isBlank(req.locator.url)) {
			return StoreMongoDAO.getPostInfo(client, req.locator, req.ro_age);
		}

		if (isBlank(req.locator.url) && !isBlank(req.locator.site)) {
			return StoreMongoDAO.getSiteInfo(client, req.locator.site);
		}

		throw 'Invalid info request';
	};

	public ListFlags = async (req: FlagRequest): Promise<string[] | BlockedUser[]> => {
		const client = await clientPromise;
		if (req.flag === Verified) {
			return StoreMongoDAO.getVerifiedUsers(client, req.locator.site);
		}

		if (req.flag === Blocked) {
			return StoreMongoDAO.getBlockedUsers(client, req.locator.site);
		}

		throw `Flag ${req.flag} not listable`;
	};

	public Update = async (comment: Comment): Promise<void> => {
		const client = await clientPromise;
		return StoreMongoDAO.updateComment(client, comment.id, comment.locator, comment);
	};

	public UserDetail = async (req: UserDetailRequest): Promise<UserDetailResponse> => {
		const client = await clientPromise;

		switch (req.detail) {
			case UserEmail:
			case UserTelegram: {
				if (isBlank(req.user_id)) {
					throw 'userid cannot be empty in request for single detail';
				}

				// read detail value, no update requested
				if (isBlank(req.update)) {
					// prettier-ignore
					return StoreMongoDAO.getUserDetail(client, req.locator.site, req.user_id, req.detail);
				}

				// prettier-ignore
				return StoreMongoDAO.setUserDetail(client, req.locator.site, req.user_id, req.detail, req.update);
			}

			case AllUserDetails: {
				// list of all details returned in case request is a read request
				// (Update is not set) and does not have UserID or Detail set
				if (isBlank(req.update) && isBlank(req.user_id)) {
					// read list of all details
					return StoreMongoDAO.listSiteUsersDetails(client, req.locator.site);
				}

				throw 'unsupported request with userdetail all';
			}
		}

		throw `unsupported detail ${req.detail}`;
	};
}
