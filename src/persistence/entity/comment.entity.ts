import { ObjectId } from 'bson';
import { VotedIPInfo } from '@remark42/dto/store.dto';

export interface CommentDocument {
	_id: ObjectId;

	// Comment id (unique per site)
	cid: string;

	// Parent id
	pid: string;
	text: string;
	orig?: string;
	user: string;
	locator: {
		site: string;
		url: string;
	};

	// These are computed by the Go backend on each vote
	score: number;
	controversy: number;

	// Since Remark sends the whole votes/voted_ips each time, we just store it as-is
	// Storing a single list is not possible because we cannot map user with IPs
	votes: { [id: string]: boolean };
	voted_ips: { [id: string]: VotedIPInfo };

	time: Date;
	edit: {
		summary: string;
		time: Date;
	};

	pin?: boolean;
	delete?: boolean;
	imported?: boolean;
	title: string;
}
