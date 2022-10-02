import { describe, expect, test } from '@jest/globals';
import { Request } from 'express';
import { JRpcRouter, JRpcRoutes } from '@web/jrpc/router';
import { JRpcResponse } from '@web/jrpc/response';
import { JRpcRequest } from '@web/jrpc/request';
import { mockResponse } from '@test/utils';

jest.mock('@logging/index');

describe('JrpcRouter', () => {
	const routes: JRpcRoutes = {
		'method.one': async (name: string): Promise<string> => {
			return 'one-' + name;
		},
		'method.two': async ([name, surname]: [string, string]): Promise<string> => {
			return `two-${name}-${surname}`;
		},
		'method.three': async () => {
			throw 'test error!';
		}
	};

	const router = JRpcRouter(routes);

	test('call with one parameter', async () => {
		const mockRequest: Partial<Request<any, JRpcResponse<any>, JRpcRequest<any>>> = {
			body: {
				id: 12345,
				method: 'method.one',
				params: 'testName'
			}
		};

		const mockRes = mockResponse<JRpcResponse<any>>();
		await router(mockRequest as Request, mockRes, jest.fn());
		expect(mockRes.status).toHaveBeenCalledWith(200);
		expect(mockRes.json).toHaveBeenCalledWith({ result: 'one-testName', id: 12345 });
	});

	test('call with two parameters', async () => {
		// Call method.two
		const mockRequest: Partial<Request<any, JRpcResponse<any>, JRpcRequest<any>>> = {
			body: {
				id: 4323,
				method: 'method.two',
				params: ['testName', 'testSurname']
			}
		};
		const mockRes = mockResponse<JRpcResponse<any>>();
		await router(mockRequest as Request, mockRes, jest.fn());
		expect(mockRes.status).toHaveBeenCalledWith(200);
		expect(mockRes.json).toHaveBeenCalledWith({ result: 'two-testName-testSurname', id: 4323 });
	});

	test('call with error', async () => {
		const mockRequest: Partial<Request<any, JRpcResponse<any>, JRpcRequest<any>>> = {
			body: {
				id: 1111,
				method: 'method.three'
			}
		};
		const mockRes = mockResponse<JRpcResponse<any>>();
		await router(mockRequest as Request, mockRes, jest.fn());
		expect(mockRes.status).toHaveBeenCalledWith(200);
		expect(mockRes.json).toHaveBeenCalledWith({ error: 'test error!', id: 1111 });
	});

	test('call with unknown method', async () => {
		const mockRequest: Partial<Request<any, JRpcResponse<any>, JRpcRequest<any>>> = {
			body: {
				id: 1111,
				method: 'method.unknown'
			}
		};
		const mockRes = mockResponse<JRpcResponse<any>>();
		await router(mockRequest as Request, mockRes, jest.fn());
		expect(mockRes.status).toHaveBeenCalledWith(200);
		expect(mockRes.json).toHaveBeenCalledWith({ error: "method 'method.unknown' not found", id: 1111 });
	});
});
