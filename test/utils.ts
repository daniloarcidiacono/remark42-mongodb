import { Response } from 'express';
import { expect } from '@jest/globals';
import { CommentDocument } from '@persistence/entity/comment.entity';
import { UserDocument } from '@persistence/entity/user.entity';
import { ObjectId } from 'bson';

export function genComment(props: Partial<CommentDocument>): CommentDocument {
	return {
		_id: new ObjectId(),
		cid: 'c1',
		pid: null,
		text: 'Hello!',
		user: 'u1',
		score: 0,
		votes: {},
		voted_ips: {},
		controversy: 0,
		time: new Date('2022-09-08T15:40:00Z'),
		pin: false,
		delete: false,
		imported: false,
		title: 'Hello world!',
		locator: {
			site: 'remark',
			url: 'http://127.0.0.1/web/'
		},
		edit: undefined,
		...props
	};
}

export function genUser(props: Partial<UserDocument>): UserDocument {
	return {
		_id: new ObjectId(),
		uid: 'u1',
		name: 'UserOne',
		email: 'user.one@example.com',
		telegram: '',
		picture: '',
		ip: null,
		admin: false,
		blocked: null,
		verified: false,
		email_subscription: false,
		paid_sub: true,
		site: '',
		...props
	};
}

// https://codewithhugo.com/express-request-response-mocking/
export function mockResponse<ResBody = any>(): Response<ResBody> {
	const res = {} as Partial<Response<ResBody>>;
	res.status = jest.fn().mockReturnValue(res);
	res.json = jest.fn().mockReturnValue(res);
	res.send = jest.fn().mockReturnValue(res);
	res.end = jest.fn().mockReturnValue(res);
	return res as Response<ResBody>;
}

// https://stackoverflow.com/questions/47144187/can-you-write-async-tests-that-expect-tothrow
export async function expectAsyncThrows(f: Function, e: unknown) {
	return expect(async () => {
		try {
			await f();
		} catch (ex) {
			// The function you're testing must throw an actual Error object throw new Error(...).
			// Jest does not seem to recognize if you just throw an expression like throw 'An error occurred!'.
			if (typeof ex === 'string') {
				throw new Error(ex);
			} else {
				throw ex;
			}
		}
	}).rejects.toThrow(e);
}
