import { NextFunction, Request, Response } from 'express';
import { JRpcResponse } from '@web/jrpc/response';
import { JRpcRequest } from '@web/jrpc/request';
import { JRpcEndpoint } from '@web/jrpc/endpoint';
import { Time } from '@util/time';
import { Duration } from '@util/duration';
import Logger from '@logging/index';

export type JRpcRoutes = { [method: string]: JRpcEndpoint<any, any> };

function truncate(req: JRpcRequest<any>, res: JRpcResponse<any>): [JRpcRequest<any>, JRpcResponse<any>] {
	let truncReq: JRpcRequest<any> = { ...req };
	let truncRes: JRpcResponse<any> = { ...res };

	if (truncReq.method === 'image.save_with_id') {
		truncReq.params[1] = '<base64>';
	}

	if (truncReq.method === 'image.load') {
		truncRes.result = '<base64>';
	}

	return [truncReq, truncRes];
}

export function JRpcRouter(routes: JRpcRoutes) {
	const stringify = (o: any): string => JSON.stringify(o, Time.REPLACER(Duration.REPLACER()));

	return async (req: Request<any, JRpcResponse<any>, JRpcRequest<any>>, res: Response<JRpcResponse<any>>, next: NextFunction) => {
		if (!routes.hasOwnProperty(req.body.method)) {
			const response: JRpcResponse<any> = {
				error: `method '${req.body.method}' not found`,
				id: req.body.id
			};

			Logger.http('%s ===> %s', req.body, response);
			return res.status(200).json(response);
		}

		try {
			// Invoke the endpoint
			const endpoint = routes[req.body.method];
			const result = await endpoint(req.body.params);
			const response: JRpcResponse<any> = { result, id: req.body.id };

			// Log
			const [logRequest, logResponse] = truncate(req.body, response);
			Logger.http('%s ===> %s', stringify(logRequest), stringify(logResponse));

			// Send the response
			return res.status(200).json(response);
		} catch (ex) {
			const response: JRpcResponse<any> = {
				error: ex,
				id: req.body.id
			};

			// Log
			const [logRequest] = truncate(req.body, response);
			Logger.http('%s ===> %s', stringify(logRequest), stringify(response));

			// Send the response
			return res.status(200).json(response);
		}
	};
}
