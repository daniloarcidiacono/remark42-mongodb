import { Collection, GridFSBucket, GridFSFile, MongoClient } from 'mongodb';
import { SiteDocument } from '@persistence/entity/site.entity';
import { CommentDocument } from '@persistence/entity/comment.entity';
import { UserDocument } from '@persistence/entity/user.entity';
import { isBlank } from '@util/string';

export function getSitesCollection(client: MongoClient): Collection<SiteDocument> {
	const db = client.db();
	return db.collection('remark_sites');
}

export function getCommentsCollection(client: MongoClient): Collection<CommentDocument> {
	const db = client.db();
	return db.collection('remark_comments');
}

export function getUsersCollection(client: MongoClient): Collection<UserDocument> {
	const db = client.db();
	return db.collection('remark_users');
}

export function getImagesBucket(client: MongoClient): GridFSBucket {
	const db = client.db();
	return new GridFSBucket(db, { bucketName: 'remark_images' });
}

export function getImagesFilesCollection(client: MongoClient): Collection<GridFSFile> {
	const db = client.db();
	return db.collection('remark_images.files');
}

export function hasAvatars(): boolean {
	return !isBlank(global.serverOpts.avatars);
}

export function getAvatarsBucket(client: MongoClient): GridFSBucket | null {
	if (!hasAvatars()) {
		return null;
	}

	const db = client.db();
	return new GridFSBucket(db, { bucketName: global.serverOpts.avatars });
}

export function getAvatarsFilesCollection(client: MongoClient): Collection<GridFSFile> | null {
	if (!hasAvatars()) {
		return null;
	}

	const db = client.db();
	return db.collection(`${global.serverOpts.avatars}.files`);
}

export function first(expr: any) {
	return { $arrayElemAt: [expr, 0] };
}

export function nullFallback(expr: any, fallback: any) {
	return { $ifNull: [expr, fallback] };
}
