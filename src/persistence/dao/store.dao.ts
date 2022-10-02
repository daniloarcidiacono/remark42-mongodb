import { Filter, MongoClient, MongoServerError, Sort } from 'mongodb';
import { CommentDocument } from '@persistence/entity/comment.entity';
import { UserDocument } from '@persistence/entity/user.entity';
import { first, getCommentsCollection, getSitesCollection, getUsersCollection, nullFallback } from './utils';
import {
	AllUserDetails,
	BlockedUser,
	Comment,
	DeleteMode,
	HardDelete,
	InfoResponse,
	Locator,
	PostInfo,
	SortType,
	User,
	UserDetail,
	UserDetailEntry,
	UserEmail,
	UserTelegram
} from '@remark42/dto/store.dto';
import { PostSubDocument, SiteDocument } from '@persistence/entity/site.entity';
import { CommentAdapter } from '@persistence/adapter/comment.adapter';
import { isBlank } from '@util/string';
import { UserAdapter } from '@persistence/adapter/user.adapter';
import { Time } from '@util/time';
import { ImageMongoDAO } from '@persistence/dao/image.dao';

export abstract class StoreMongoDAO {
	private static readonly filterPostsByUrl = (url: string) => ({
		$filter: {
			input: '$posts',
			as: 'post',
			cond: {
				$eq: ['$$post.url', url]
			}
		}
	});

	/**
	 * Checks whether data for a specific site exists.
	 *
	 * @param client the mongodb client
	 * @param site the site name
	 */
	public static async siteExists(client: MongoClient, site: string): Promise<boolean> {
		const sitesCollection = getSitesCollection(client);
		const siteCount = await sitesCollection.countDocuments(
			{
				_id: {
					$eq: site
				}
			},
			{
				limit: 1
			}
		);

		return siteCount > 0;
	}

	/**
	 * Checks whether a specific post exists.
	 *
	 * @param client the mongodb client
	 * @param locator the post locator
	 */
	public static async postExists(client: MongoClient, locator: Locator): Promise<boolean> {
		const sitesCollection = getSitesCollection(client);
		const postCount = await sitesCollection.countDocuments(
			{
				_id: {
					$eq: locator.site
				},

				// https://www.mongodb.com/docs/manual/tutorial/query-arrays/#query-an-array-for-an-element
				'posts.url': locator.url
			},
			{
				limit: 1
			}
		);

		return postCount > 0;
	}

	/**
	 * Counts the number of comments on a post.
	 *
	 * @param client the mongodb client
	 * @param locator the post locator
	 */
	public static async countPostComments(client: MongoClient, locator: Locator): Promise<number> {
		const commentsCollection = getCommentsCollection(client);
		const postCount = await commentsCollection.countDocuments({
			'locator.site': {
				$eq: locator.site
			},
			'locator.url': {
				$eq: locator.url
			},
			delete: false
		});

		return postCount;
	}

	/**
	 * Counts the number of comments made by a user across all posts on a site.
	 *
	 * @param client the mongodb client
	 * @param userId the user id
	 * @param site the site identifier
	 */
	public static async countUserComments(client: MongoClient, userId: string, site: string): Promise<number> {
		const commentsCollection = getCommentsCollection(client);
		const userCommentsCount = await commentsCollection.countDocuments({
			'locator.site': {
				$eq: site
			},
			user: {
				$eq: userId
			},
			delete: false
		});

		return userCommentsCount;
	}

	/**
	 * Retrieves the secret key for a site.
	 *
	 * @param client the mongodb client
	 * @param site the site identifier
	 */
	public static async getSiteKey(client: MongoClient, site: string): Promise<string> {
		return StoreMongoDAO.getSiteField(client, site, 'key', '');
	}

	/**
	 * Retrieves the admin email for a site.
	 *
	 * @param client the mongodb client
	 * @param site the site identifier
	 */
	public static async getSiteAdminEmail(client: MongoClient, site: string): Promise<string> {
		return StoreMongoDAO.getSiteField(client, site, 'adminEmail', '');
	}

	/**
	 * Retrieves whether a site is enabled.
	 *
	 * @param client the mongodb client
	 * @param site the site identifier
	 */
	public static async isSiteEnabled(client: MongoClient, site: string): Promise<boolean> {
		return StoreMongoDAO.getSiteField(client, site, 'enabled', false);
	}

	/**
	 * Returns list of admin ids of a site.
	 *
	 * @param client the mongodb client
	 * @param site the site identifier
	 */
	public static async getSiteAdmins(client: MongoClient, site: string): Promise<string[]> {
		const usersCollection = getUsersCollection(client);
		const siteAdmins: string[] = (
			await usersCollection
				.find(
					{
						site,
						admin: true
					},
					{
						projection: {
							uid: 1
						}
					}
				)
				.toArray()
		).map(document => document.uid);

		return siteAdmins;
	}

	/**
	 * Gets a post.
	 *
	 * @param client the mongodb client
	 * @param locator the post locator
	 */
	public static async getPost(client: MongoClient, locator: Locator): Promise<SiteDocument | null> {
		const sitesCollection = getSitesCollection(client);
		const siteWithPost = await sitesCollection
			.aggregate<SiteDocument>([
				{
					$match: {
						_id: locator.site
					}
				},
				{
					$project: {
						_id: 1,
						enabled: 1,
						posts: {
							$filter: {
								input: '$posts',
								as: 'post',
								cond: {
									$eq: ['$$post.url', locator.url]
								}
							}
						}
					}
				}
			])
			.toArray();

		return siteWithPost && siteWithPost.length > 0 ? siteWithPost[0] : null;
	}

	/**
	 * Retrieves all comments for a post with the user infos.
	 *
	 * @param client the mongodb client
	 * @param locator the post locator
	 * @param since an optional date
	 * @param sort sorting criteria
	 */
	public static async getPostComments(client: MongoClient, locator: Locator, since?: Date, sort?: SortType): Promise<Comment[]> {
		const commentsCollection = getCommentsCollection(client);

		// Filter and sort the comments
		const filter: Filter<CommentDocument> = { locator };
		if (since) {
			filter.time = { $gt: since };
		}
		// prettier-ignore
		const comments = await commentsCollection
			.find(filter, { sort: StoreMongoDAO.buildSort(sort) })
			.toArray();
		return StoreMongoDAO.mergeCommentsAndUsers(client, locator, comments);
	}

	/**
	 * Returns up to max last comments for given siteID
	 *
	 * @param client the mongodb client
	 * @param site the site id
	 * @param max the maximum number of comments to fetch (0 = no limit)
	 * @param since an optional date
	 */
	public static async getSiteLastComments(client: MongoClient, site: string, max: number, since?: Date): Promise<Comment[]> {
		const lastLimit = 1000;
		if (max > lastLimit || max == 0) {
			max = lastLimit;
		}

		const commentsCollection = getCommentsCollection(client);
		const filter: Filter<CommentDocument> = { 'locator.site': site };
		if (since) {
			filter.time = { $gt: since };
			filter.delete = false;
		}

		// prettier-ignore
		const comments = await commentsCollection
			.find(filter)
			.sort({ time: -1 })
			.limit(max)
			.toArray();

		return StoreMongoDAO.mergeCommentsAndUsers(client, { site, url: undefined }, comments);
	}

	/**
	 * Extracts all comments for given site and given userID.
	 *
	 * @param client the mongodb client
	 * @param site the site id
	 * @param user_id the user id
	 * @param limit the maximum number of comments to fetch (0 = no limit)
	 * @param skip number of comments to skip
	 */
	public static async getSiteUserComments(client: MongoClient, site: string, user_id: string, limit: number, skip: number): Promise<Comment[]> {
		const userLimit = 500;
		if (limit == 0 || limit > userLimit) {
			limit = userLimit;
		}

		const commentsCollection = getCommentsCollection(client);
		const comments = await commentsCollection
			.find({
				'locator.site': site,
				user: user_id,
				delete: false
			})
			.sort({ time: -1 })
			.skip(skip || 0)
			.limit(limit)
			.toArray();

		return StoreMongoDAO.mergeCommentsAndUsers(client, { site, url: undefined }, comments);
	}

	/**
	 * Checks whether a post is readonly.
	 *
	 * @param client the mongodb client
	 * @param locator the post locator
	 */
	public static async isPostReadOnly(client: MongoClient, locator: Locator): Promise<boolean> {
		// Note: Remark42 Bolt implementation returns false for non-existing posts
		return StoreMongoDAO.getPostField(client, locator, 'readOnly', false);
	}

	/**
	 * Sets the readonly status of a post.
	 *
	 * @param client the mongodb client
	 * @param locator the post locator
	 * @param value the value to set
	 */
	public static async setPostReadOnly(client: MongoClient, locator: Locator, value: boolean): Promise<void> {
		return StoreMongoDAO.setPostField(client, locator, 'readOnly', value);
	}

	/**
	 * Checks whether a user is blocked.
	 *
	 * @param client the mongodb client
	 * @param site the site identifier
	 * @param userId the user identifier
	 */
	public static async isUserBlocked(client: MongoClient, site: string, userId: string): Promise<boolean> {
		const blockedDate: Date | null = await StoreMongoDAO.getUserField(client, site, userId, 'blocked', null);
		return blockedDate !== null && blockedDate.getTime() >= new Date().getTime();
	}

	/**
	 * Sets the blocked flag of a user.
	 *
	 * @param client the mongodb client
	 * @param site the site identifier
	 * @param userId the user identifier
	 * @param until date until block the user
	 */
	public static async setUserBlocked(client: MongoClient, site: string, userId: string, until: Date | null): Promise<void> {
		return StoreMongoDAO.setUserField(client, site, userId, 'blocked', until);
	}

	/**
	 * Checks whether a user is verified.
	 *
	 * @param client the mongodb client
	 * @param site the site identifier
	 * @param userId the user identifier
	 */
	public static async isUserVerified(client: MongoClient, site: string, userId: string): Promise<boolean> {
		return StoreMongoDAO.getUserField(client, site, userId, 'verified', false);
	}

	/**
	 * Sets the verified flag of a user.
	 *
	 * @param client the mongodb client
	 * @param site the site identifier
	 * @param userId the user identifier
	 * @param value the value to set
	 */
	public static async setUserVerified(client: MongoClient, site: string, userId: string, value: boolean): Promise<void> {
		return StoreMongoDAO.setUserField(client, site, userId, 'verified', value);
	}

	/**
	 * Saves a user if not exists.
	 *
	 * @param client the mongodb client
	 * @param user the user
	 */
	public static async createUser(client: MongoClient, user: User): Promise<void> {
		const usersCollection = getUsersCollection(client);
		try {
			await usersCollection.insertOne(UserAdapter.toEntity(user));
		} catch (e) {
			if (e instanceof MongoServerError && e.code === 11000) {
				// Duplicate key
				return;
			}

			// Other errors
			throw e;
		}
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
		const sitesCollection = getSitesCollection(client);
		await sitesCollection.updateOne(
			{
				_id: locator.site
			},
			{
				$push: {
					posts: {
						url: locator.url,
						readOnly
					} as PostSubDocument
				}
			}
		);
	}

	/**
	 * Saves a comment (note: the id must already be populated!).
	 * <p>Note: this does not check if the post is readonly nor for duplicates.
	 *
	 * @param client the mongodb client
	 * @param comment the comment
	 * @return the id of the comment
	 */
	public static async createComment(client: MongoClient, comment: Comment): Promise<string> {
		const commentsCollection = getCommentsCollection(client);
		if (isBlank(comment.id)) {
			throw 'Comment is missing id!';
		}

		try {
			// Note: this relies on (cid, locator.site, locator.url) unique index!
			await commentsCollection.insertOne(CommentAdapter.toEntity(comment));
			return comment.id;
		} catch (e) {
			if (e instanceof MongoServerError && e.code === 11000) {
				// Duplicate key
				throw `key ${comment.id} already in store`;
			}

			// Other errors
			throw e;
		}
	}

	/**
	 * Removes a comment.
	 * <p>The user is kept even if it has no more comments.
	 *
	 * @param client the mongodb client
	 * @param locator the post locator
	 * @param comment_id the id of the comment
	 * @param del_mode the deletion mode
	 */
	public static async deleteComment(client: MongoClient, locator: Locator, comment_id: string, del_mode: DeleteMode): Promise<void> {
		const commentsCollection = getCommentsCollection(client);
		await commentsCollection.updateOne(
			{
				cid: comment_id,
				locator
			},
			{
				$set: StoreMongoDAO.deleteCommentUpdate(del_mode)
			}
		);
	}

	/**
	 * Retrieves a comment.
	 *
	 * @param client the mongodb client
	 * @param locator the post locator
	 * @param comment_id the id of the comment
	 */
	public static async getComment(client: MongoClient, locator: Locator, comment_id: string): Promise<Comment> {
		const commentsCollection = getCommentsCollection(client);
		const comment = await commentsCollection.findOne({
			cid: comment_id,
			locator
		});

		const usersCollection = getUsersCollection(client);
		const user = await usersCollection.findOne({
			uid: comment.user,
			site: locator.site
		});

		return CommentAdapter.toModel(comment, { user: UserAdapter.toModel(user) });
	}

	/**
	 * Updates a comment (only the mutable parts).
	 *
	 * @param client the mongodb client
	 * @param commentId the comment id
	 * @param locator the post locator
	 * @param comment the comment
	 */
	public static async updateComment(client: MongoClient, commentId: string, locator: Locator, comment: Partial<Comment>): Promise<void> {
		const update = CommentAdapter.toEntity(comment as Comment);

		// preserve immutable fields
		delete update._id;
		delete update.cid;
		delete update.pid;
		delete update.locator;
		delete update.time;
		delete update.user;

		const commentsCollection = getCommentsCollection(client);

		// Update the comment
		const filter: Filter<CommentDocument> = {
			cid: commentId,
			locator
		};
		await commentsCollection.updateOne(filter, { $set: { ...update } });
	}

	/**
	 * Returns the verified users of a site.
	 *
	 * @param client the mongodb client
	 * @param site the site name
	 */
	public static async getVerifiedUsers(client: MongoClient, site: string): Promise<string[]> {
		const usersCollection = getUsersCollection(client);
		const verifiedUsers: string[] = (
			await usersCollection
				.find(
					{
						site,
						verified: true
					},
					{
						projection: {
							uid: 1
						}
					}
				)
				.toArray()
		).map(document => document.uid);

		return verifiedUsers;
	}

	/**
	 * Returns the blocked users of a site.
	 *
	 * @param client the mongodb client
	 * @param site the site name
	 */
	public static async getBlockedUsers(client: MongoClient, site: string): Promise<BlockedUser[]> {
		const usersCollection = getUsersCollection(client);
		const blockedUsers: BlockedUser[] = (
			await usersCollection
				.find(
					{
						site,
						$and: [
							{ blocked: { $ne: null } },

							// The algorithm is to get all user of a given site which blocked TTL >= Time.now()
							{ blocked: { $gte: new Date() } }
						]
					},
					{
						projection: {
							uid: 1,
							name: 1,
							blocked: 1
						}
					}
				)
				.toArray()
		).map(
			document =>
				({
					id: document.uid,
					name: document.name,
					time: new Time(document.blocked.toJSON())
				} as BlockedUser)
		);

		return blockedUsers;
	}

	/**
	 * Gets information about a post.
	 *
	 * @param client the mongodb client
	 * @param locator the post locator
	 * @param ro_age readonly age in days
	 */
	public static async getPostInfo(client: MongoClient, locator: Locator, ro_age?: number): Promise<InfoResponse> {
		const commentsCollection = getCommentsCollection(client);
		const postInfos = (
			(await commentsCollection
				.aggregate<PostInfo>([
					{
						$match: {
							locator
						}
					},
					{
						$group: {
							_id: null,
							count: {
								$sum: 1
							},
							first_time: {
								$min: '$time'
							},
							last_time: {
								$max: '$time'
							}
						}
					}
				])
				.toArray()) || []
		).map(
			x =>
				({
					url: locator.url,
					count: x.count,
					read_only: false,
					first_time: new Time((x.first_time as unknown as Date).toJSON()),
					last_time: new Time((x.last_time as unknown as Date).toJSON())
				} as PostInfo)
		);

		if (postInfos.length === 0) {
			postInfos.push({
				url: locator.url,
				count: 0,
				read_only: false,
				first_time: Time.zero(),
				last_time: Time.zero()
			});

			// throw `can't load info for ${locator.url}`;
		}

		// set read-only from age and manual bucket
		const info = postInfos[0];
		// prettier-ignore
		info.read_only =
			ro_age !== undefined &&
			ro_age > 0 &&
			!info.first_time.isZero() &&
			info.first_time.addDays(ro_age).before(Time.now());

		if (!info.read_only) {
			info.read_only = await StoreMongoDAO.isPostReadOnly(client, locator);
		}

		return [postInfos[0]];
	}

	/**
	 * Gets information about a site.
	 *
	 * @param client the mongodb client
	 * @param site the site identifier
	 * @param limit the maximum number of infos to fetch (0 = no limit)
	 * @param skip number of infos to skip
	 */
	public static async getSiteInfo(client: MongoClient, site: string, limit?: number, skip?: number): Promise<InfoResponse> {
		const commentsCollection = getCommentsCollection(client);
		const stages = [
			{
				$match: {
					'locator.site': site
				}
			},
			{
				$group: {
					_id: '$locator.url',
					count: {
						$sum: 1
					},
					last_time: {
						$max: '$time'
					}
				}
			},
			{
				$sort: {
					_id: 1
				}
			},
			{
				$skip: skip || 0
			},
			limit !== undefined && limit > 0
				? {
						$limit: limit
				  }
				: null
		].filter(stage => stage !== null);

		// prettier-ignore
		const postInfos = (
			(await commentsCollection.aggregate<PostInfo>(stages).toArray()) || []
		).map(
			x =>
				({
					url: (x as any)._id,
					count: x.count,
					last_time: new Time((x.last_time as unknown as Date).toJSON())
				} as PostInfo)
		);

		return postInfos;
	}

	/**
	 * Retrieves a user detail.
	 *
	 * @param client the mongodb client
	 * @param site the site identifier
	 * @param userId the user identifier
	 * @param detail the detail to get
	 */
	public static async getUserDetail(client: MongoClient, site: string, userId: string, detail: UserDetail): Promise<UserDetailEntry[]> {
		switch (detail) {
			case UserEmail: {
				const detail = await StoreMongoDAO.getUserField(client, site, userId, 'email', '');
				return !isBlank(detail) ? [{ user_id: userId, email: detail }] : [];
			}

			case UserTelegram: {
				const detail = await StoreMongoDAO.getUserField(client, site, userId, 'telegram', '');
				return !isBlank(detail) ? [{ user_id: userId, telegram: detail }] : [];
			}
		}

		return [];
	}

	/**
	 * Sets a user detail.
	 *
	 * @param client the mongodb client
	 * @param site the site identifier
	 * @param userId the user identifier
	 * @param detail the detail to set
	 * @param update the value to set
	 */
	public static async setUserDetail(
		client: MongoClient,
		site: string,
		userId: string,
		detail: UserDetail,
		update: string
	): Promise<UserDetailEntry[]> {
		switch (detail) {
			case UserEmail: {
				await StoreMongoDAO.setUserField(client, site, userId, 'email', update || '');
				return [
					{
						user_id: userId,
						email: update || ''
					}
				];
			}

			case UserTelegram: {
				await StoreMongoDAO.setUserField(client, site, userId, 'telegram', update || '');
				return [
					{
						user_id: userId,
						telegram: update || ''
					}
				];
			}
		}

		return [];
	}

	/**
	 * Deletes a user detail.
	 *
	 * @param client the mongodb client
	 * @param site the site identifier
	 * @param userId the user identifier
	 * @param detail the detail to set
	 */
	public static async deleteUserDetail(client: MongoClient, site: string, userId: string, detail: UserDetail): Promise<void> {
		if (detail === AllUserDetails) {
			// Delete all user details in one go
			const usersCollection = getUsersCollection(client);
			await usersCollection.updateOne(
				{
					uid: userId,
					site
				},
				{
					$set: {
						email: '',
						telegram: ''
					}
				}
			);
		} else {
			await StoreMongoDAO.setUserDetail(client, site, userId, detail, '');
		}
	}

	/**
	 * Deletes a user along with all its data.
	 *
	 * @param client the mongodb client
	 * @param site the site identifier
	 * @param userId the user id
	 * @param del_mode the deletion mode
	 */
	public static async deleteUser(client: MongoClient, site: string, userId: string, del_mode: DeleteMode): Promise<void> {
		const commentsCollection = getCommentsCollection(client);
		const usersCollection = getUsersCollection(client);
		await commentsCollection.updateMany(
			{
				'locator.site': site,
				user: userId
			},
			{
				$set: StoreMongoDAO.deleteCommentUpdate(del_mode)
			}
		);

		if (del_mode === HardDelete) {
			// Braze the user
			await usersCollection.deleteOne({ uid: userId, site });
		} else {
			await StoreMongoDAO.deleteUserDetail(client, site, userId, AllUserDetails);
		}
	}

	/**
	 * Deletes a site.
	 *
	 * @param client the mongodb client
	 * @param site the site identifier
	 */
	public static async deleteSite(client: MongoClient, site: string): Promise<void> {
		const sitesCollection = getSitesCollection(client);
		const commentsCollection = getCommentsCollection(client);
		const usersCollection = getUsersCollection(client);

		// Get all the users of a site
		const siteUsers: string[] = (
			await usersCollection
				.find(
					{
						site
					},
					{
						projection: {
							uid: 1
						}
					}
				)
				.toArray()
		).map(x => x.uid);

		// Delete everything
		await Promise.all([
			sitesCollection.deleteOne({ _id: site }),
			commentsCollection.deleteMany({ 'locator.site': site }),
			usersCollection.deleteMany({ site }),
			ImageMongoDAO.deleteUserImages(client, siteUsers)
		]);
	}

	/**
	 * Lists all the user details for a given site id.
	 *
	 * @param client the mongodb client
	 * @param site the site identifier
	 */
	public static async listSiteUsersDetails(client: MongoClient, site: string): Promise<UserDetailEntry[]> {
		const usersCollection = getUsersCollection(client);
		const result = await usersCollection
			.find(
				{
					site
				},
				{
					projection: {
						uid: 1,
						email: 1,
						telegram: 1
					}
				}
			)
			.toArray();

		return result
			.map(user => {
				return [
					!isBlank(user.email)
						? {
								user_id: user.uid,
								email: user.email
						  }
						: null,
					!isBlank(user.telegram)
						? {
								user_id: user.uid,
								telegram: user.telegram
						  }
						: null
				].filter(x => x !== null);
			})
			.flatMap(x => x);
	}

	/**
	 * Helper method to retrieve a single field of a site.
	 *
	 * @param client the mongodb client
	 * @param site the site identifier
	 * @param fieldName the name of the field to retrieve
	 * @param defaultValue the default value to return if the site is not found
	 * @private
	 */
	private static async getSiteField<T>(client: MongoClient, site: string, fieldName: keyof SiteDocument, defaultValue: T): Promise<T> {
		const sitesCollection = getSitesCollection(client);

		interface FieldDocument {
			field: T;
		}

		const result = await sitesCollection.findOne<FieldDocument>(
			{
				_id: site
			},
			{
				projection: {
					field: `$${fieldName}`
				}
			}
		);

		return result !== null ? result.field : defaultValue;
	}

	/**
	 * Helper method to retrieve a single field of a post.
	 *
	 * @param client the mongodb client
	 * @param locator the post locator
	 * @param fieldName the name of the field to retrieve
	 * @param defaultValue the default value to return if the post is not found
	 * @private
	 */
	private static async getPostField<T>(client: MongoClient, locator: Locator, fieldName: keyof PostSubDocument, defaultValue: T): Promise<T> {
		const sitesCollection = getSitesCollection(client);

		interface FieldDocument {
			field: T;
		}

		const result = await sitesCollection
			.aggregate<FieldDocument>([
				{
					$match: { _id: locator.site }
				},
				{
					$project: {
						// prettier-ignore
						posts: nullFallback(
							first(StoreMongoDAO.filterPostsByUrl(locator.url)),
							{
								[fieldName]: defaultValue
							}
						)
					}
				},
				{
					$project: {
						field: `$posts.${fieldName}`
					}
				}
			])
			.toArray();

		return result.length > 0 ? result[0].field : defaultValue;
	}

	/**
	 * Helper method to set a single field of a post.
	 *
	 * @param client the mongodb client
	 * @param locator the post locator
	 * @param fieldName the name of the field to retrieve
	 * @param value the value to set
	 * @private
	 */
	private static async setPostField<T>(client: MongoClient, locator: Locator, fieldName: keyof PostSubDocument, value: T): Promise<void> {
		const sitesCollection = getSitesCollection(client);
		await sitesCollection.updateOne(
			{
				_id: locator.site
			},
			{
				$set: {
					[`posts.$[elem].${fieldName}`]: value
				} as Partial<PostSubDocument>
			},
			{
				arrayFilters: [
					{
						'elem.url': {
							$eq: locator.url
						}
					}
				]
			}
		);
	}

	/**
	 * Helper method to retrieve a single field of a user.
	 *
	 * @param client the mongodb client
	 * @param site the site identifier
	 * @param userId the user identifier
	 * @param fieldName the name of the field to retrieve
	 * @param defaultValue the default value to return if the post is not found
	 * @private
	 */
	private static async getUserField<T>(
		client: MongoClient,
		site: string,
		userId: string,
		fieldName: keyof UserDocument,
		defaultValue: T
	): Promise<T> {
		const usersCollection = getUsersCollection(client);
		const result = await usersCollection.findOne(
			{
				uid: userId,
				site
			},
			{
				projection: {
					[fieldName]: 1
				}
			}
		);

		return result ? (result[fieldName] as unknown as T) : defaultValue;
	}

	/**
	 * Helper method to set a single field of a user.
	 *
	 * @param client the mongodb client
	 * @param site the site identifier
	 * @param userId the user identifier
	 * @param fieldName the name of the field to retrieve
	 * @param value the value to set
	 * @private
	 */
	private static async setUserField<T>(client: MongoClient, site: string, userId: string, fieldName: keyof UserDocument, value: T): Promise<void> {
		const usersCollection = getUsersCollection(client);
		await usersCollection.updateOne(
			{
				uid: userId,
				site
			},
			{
				$set: {
					[fieldName]: value
				} as Partial<UserDocument>
			}
		);
	}

	/**
	 * Returns the update (to be used in $set) for deleting a comment
	 *
	 * @param del_mode the deletion mode
	 * @private
	 */
	private static deleteCommentUpdate(del_mode: DeleteMode): Partial<CommentDocument> {
		return {
			text: '',
			orig: '',
			score: 0,
			votes: {},
			voted_ips: {},
			edit: null,
			delete: true,
			pin: false,

			...(del_mode === HardDelete
				? ({
						user: 'deleted' // TODO: Check this
						// user: {
						// 	name: "deleted",
						// 	id: "deleted",
						// 	picture: "",
						// 	ip: ""
						// }
				  } as Partial<CommentDocument>)
				: {})
		};
	}

	/**
	 * Helper method to build the sorting criteria for comments.
	 * <p>Note: Go backend will sort comments anyway when building the comments tree!
	 *
	 * @param sort the criteria
	 * @private
	 */
	private static buildSort(sort?: SortType): Sort {
		// Newest, Recently Updated
		if (sort === '-time' || sort === '-active') {
			return {
				time: 'descending'
			};
		}

		// Oldest, Least recently Updated
		if (sort === '+time' || sort === '+active' || sort === 'time' || sort === 'active') {
			return {
				time: 'ascending'
			};
		}

		// Best
		if (sort === '-score') {
			return {
				score: 'descending',
				time: 'ascending'
			};
		}

		// Worst
		if (sort === '+score' || sort === 'score') {
			return {
				score: 'ascending',
				time: 'ascending'
			};
		}

		// Most Controversial
		if (sort === '-controversy') {
			return {
				controversy: 'descending',
				time: 'ascending'
			};
		}

		// Least Controversial
		if (sort === '+controversy' || sort === 'controversy') {
			return {
				controversy: 'ascending',
				time: 'ascending'
			};
		}

		// Default (oldest)
		return {
			time: 'ascending'
		};
	}

	/**
	 * Helper method to fetch and merge comments users.
	 *
	 * @param client the mongodb client
	 * @param locator the post locator
	 * @param comments the comments
	 * @private
	 */
	private static async mergeCommentsAndUsers(client: MongoClient, locator: Locator, comments: CommentDocument[]): Promise<Comment[]> {
		// Fetch the users referenced in comments
		// Note: $lookup aggregation operator does not work with sharded collections prior to MongoDB 5.1, so we avoid using it
		// Note: MongoDB Atlas Free Tier has MongoDB 5.0.12
		const usersCollection = getUsersCollection(client);
		const userIds = Array.from(new Set(comments.map(comment => comment.user)));
		const users = await usersCollection
			.find({
				site: locator.site,
				uid: {
					$in: userIds
				}
			})
			.toArray();

		// Build map user_id => user for fast lookup
		const userMap: { [id: string]: UserDocument } = Object.fromEntries(users.map(u => [u.uid, u]));

		// Map the comments
		return comments.map(c =>
			CommentAdapter.toModel(c, {
				user: UserAdapter.toModel(userMap[c.user]),
				locator: c.locator
			})
		);
	}
}
