import { Time } from '@util/time';
import { Duration } from '@util/duration';

export type SortType =
	| '+time'
	| '-time'
	| 'time'
	| '+active'
	| '-active'
	| 'active'
	| '+score'
	| '-score'
	| 'score'
	| '+controversy'
	| '-controversy'
	| 'controversy';

export interface User {
	id: string;
	name: string;
	picture: string;
	ip?: string;
	admin: boolean;
	block?: boolean;
	verified?: boolean;
	email_subscription?: boolean;
	site_id?: string;
	paid_sub?: boolean;
}

// BlockedUser holds id and ts for blocked user
export interface BlockedUser {
	id: string;
	name: string;
	time: Time;
}

// VotedIPInfo keeps timestamp and voting value (direction). Used as VotedIPs value
export interface VotedIPInfo {
	Timestamp: Date;
	Value: boolean;
}

// Comment represents a single comment with optional reference to its parent
export interface Comment {
	id: string;
	pid: string;
	text: string;
	orig?: string;
	user: User;
	locator: Locator;
	score: number;
	votes?: { [id: string]: boolean };
	// voted ips (hashes) with TS
	voted_ips?: { [id: string]: VotedIPInfo };

	// vote for the current user, -1/1/0.
	vote: -1 | 1 | 0;
	controversy?: number;
	time: Time;
	// pointer to have empty default in json response
	edit?: Edit;
	pin?: boolean;
	delete?: boolean;
	imported?: boolean;
	title?: string;
}

// Edit indication
export interface Edit {
	time: Time;
	summary: string;
}

// Locator keeps site and url of the post
export interface Locator {
	site: string;
	url: string;
}

// UserDetailEntry contains single user details entry
export interface UserDetailEntry {
	// duplicate user's id to use this structure not only embedded but separately
	user_id: string;

	// UserEmail
	email?: string;

	// UserTelegram
	telegram?: string;
}

// Flag defines type of binary attribute
export type Flag = string;

// FlagStatus represents values of the flag update
export type FlagStatus = number;

// enum of update values
export const FlagNonSet: FlagStatus = 0;
export const FlagTrue: FlagStatus = 1;
export const FlagFalse: FlagStatus = -1;

// Enum of all flags
export const ReadOnly: Flag = 'readonly';
export const Verified: Flag = 'verified';
export const Blocked: Flag = 'blocked';

// DeleteMode defines how much comment info will be erased
export type DeleteMode = number;

// DeleteMode enum
export const SoftDelete: DeleteMode = 0;
export const HardDelete: DeleteMode = 1;

// UserDetail defines name of the user detail
export type UserDetail = string;

// All possible user details
// UserEmail is a user email
export const UserEmail: UserDetail = 'email';

// UserTelegram is a user telegram
export const UserTelegram: UserDetail = 'telegram';

// AllUserDetails used for listing and deletion requests
export const AllUserDetails: UserDetail = 'all';

// User holds user-related info
export type CommentResponse = string;

export interface FindRequest {
	// lack of URL means site operation
	locator: Locator;

	// presence of UserID treated as user-related find
	user_id?: string;

	// sort order with +/-field syntax
	sort?: SortType;

	// time limit for found results
	since?: Time;
	limit: number;
	skip: number;
}

export type FindResponse = Comment[];

// GetRequest is the input for Get func
export interface GetRequest {
	locator: Locator;
	comment_id: string;
}

export type GetResponse = Comment;

export type CountResponse = number;

// InfoRequest is the input of Info operation used to get meta data about posts
export interface InfoRequest {
	locator: Locator;
	limit?: number;
	skip?: number;
	ro_age?: number;
}

// PostInfo holds summary for given post url
export interface PostInfo {
	url: string;
	count: number;
	read_only?: boolean;
	first_time?: Time;
	last_time?: Time;
}

export type InfoResponse = PostInfo[];

export type FlagResponse = boolean;

// FlagRequest is the input for both get/set for flags, like blocked, verified and so on
export interface FlagRequest {
	// flag type
	flag: Flag;

	// post locator
	locator: Locator;

	// for flags setting user status
	user_id?: string;

	// if FlagNonSet it will be get op, if set will set the value
	update?: FlagStatus;

	// ttl for time-sensitive flags only, like blocked for some period
	ttl?: Duration;
}

export type UserDetailResponse = UserDetailEntry[];

// UserDetailRequest is the input for both get/set for details, like email
export interface UserDetailRequest {
	// detail name
	detail: UserDetail;

	// post locator
	locator: Locator;

	// user id for get\set
	user_id: string;

	// update value
	update?: string;
}

// DeleteRequest is the input for all delete operations (comments, sites, users)
export interface DeleteRequest {
	// lack of URL means site operation
	locator: Locator;
	comment_id?: string;
	user_id?: string;
	user_detail?: UserDetail;
	del_mode: DeleteMode;
}

export type CloseResponse = void;
export type DeleteResponse = void;
