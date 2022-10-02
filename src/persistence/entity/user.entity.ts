import { ObjectId } from 'bson';

export interface UserDocument {
	_id: ObjectId;

	// User id (unique per site)
	uid: string;
	name: string;
	email: string;
	telegram: string;
	picture: string;
	ip?: string;
	site: string;
	admin: boolean;
	blocked?: Date;
	verified?: boolean;
	email_subscription?: boolean;
	paid_sub?: boolean;
}
