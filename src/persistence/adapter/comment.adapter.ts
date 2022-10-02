import { CommentDocument } from '@persistence/entity/comment.entity';
import { Time } from '@util/time';
import { Comment } from '@remark42/dto/store.dto';

export abstract class CommentAdapter {
	public static toEntity(comment: Comment): CommentDocument {
		return {
			_id: null,
			cid: comment.id,
			pid: comment.pid,
			locator: {
				site: comment.locator.site,
				url: comment.locator.url
			},
			text: comment.text,
			orig: comment.orig,
			score: comment.score,
			controversy: comment.controversy || 0,
			votes: comment.votes || {},
			voted_ips: comment.voted_ips || {},
			user: comment.user.id,
			time: comment.time.date,
			pin: comment.pin || false,
			delete: comment.delete || false,
			imported: comment.imported || false,
			title: comment.title,
			edit: comment.edit
				? {
						summary: comment.edit.summary,
						time: comment.edit.time.date
				  }
				: undefined
		};
	}

	public static toModel(comment: CommentDocument, extra?: Partial<Comment> & Pick<Comment, 'user'>): Comment {
		return {
			id: comment.cid,
			pid: comment.pid,
			text: comment.text,
			orig: comment.orig,
			// user: UserAdapter.toModel(userMap[comment.user], { site_id: req.locator.site }),
			locator: {
				site: comment.locator.site,
				url: comment.locator.url
			},
			score: comment.score,
			controversy: comment.controversy,
			votes: comment.votes,
			voted_ips: comment.voted_ips,
			vote: undefined,
			time: new Time(comment.time.toJSON()),
			edit: comment.edit
				? {
						summary: comment.edit.summary,
						time: new Time(comment.edit.time.toJSON())
				  }
				: undefined,
			pin: comment.pin,
			delete: comment.delete,
			imported: comment.imported,
			title: comment.title,

			...extra
		};
	}
}
