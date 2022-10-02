import { UserDocument } from '@persistence/entity/user.entity';
import { User } from '@remark42/dto/store.dto';

export abstract class UserAdapter {
	public static toModel(user: UserDocument, extra?: Partial<User>): User {
		return {
			id: user.uid,
			name: user.name,
			picture: user.picture,
			ip: user.ip,
			admin: user.admin,
			block: user.blocked !== null && user.blocked !== undefined,
			verified: user.verified,
			email_subscription: user.email_subscription,
			paid_sub: user.paid_sub,
			site_id: user.site,
			...extra
		};
	}

	public static toEntity(user: User): UserDocument {
		return {
			_id: null,
			uid: user.id,
			name: user.name,
			picture: user.picture,
			ip: user.ip,
			admin: user.admin,
			blocked: null,
			verified: user.verified || false,
			email_subscription: user.email_subscription || false,
			paid_sub: user.paid_sub || false,
			site: user.site_id,

			// TODO: How??
			email: '',
			telegram: ''
		};
	}
}
