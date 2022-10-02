import express, { NextFunction, Request, Response } from 'express';
import bodyParser from 'body-parser';
import { JRpcRouter } from '@web/jrpc/router';
import endpoints from '@web/controller';
import { Time } from '@util/time';
import { Duration } from '@util/duration';
import Logger from '@logging/index';
import clientPromise from '@persistence/mongodb';
import { createIndices, isConnected } from '@persistence/utils';
import { MongoClient } from 'mongodb';
import type { Server } from 'http';

export class Remark42MongoDBServer {
	private app;
	private server: Server;

	public constructor() {
		// https://expressjs.com/it/api.html#app.settings.table
		this.app = express();
		this.app.set('json replacer', Time.REPLACER(Duration.REPLACER()));

		// Setup JSON body parsing
		this.app.use(
			bodyParser.json({
				limit: global.serverOpts.bodyLimit,
				reviver: Time.REVIVER(['Time', 'FirstStagingImageTS', 'time', 'since', 'first_time', 'last_time'], Duration.REVIVER(['ttl']))
			})
		);

		this.app.use((req: Request, res: Response, next: NextFunction) => {
			// Inject CORS headers
			res.setHeader('Access-Control-Allow-Origin', '*');
			res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE');
			res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

			next();
		});

		this.app.get('/health', this.healthCheck);

		this.app.post(
			'/',
			JRpcRouter({
				...endpoints
			})
		);
	}

	public async run() {
		Logger.info('Starting server...');

		// First connection to database
		let client: MongoClient;
		try {
			client = await clientPromise;
		} catch (e) {
			Logger.error('Failed to initialize the database: ' + e.message);
			console.error('Could not connect to database!'.red);
			process.exit(1);
		}

		try {
			// Ensure indices are created on startup
			await createIndices(client);
		} catch (e) {
			Logger.error('Failed to initialize the database: ' + e.message);
			console.error('Failed to initialize the database!'.red);
			process.exit(1);
		}

		// Start the server
		this.server = this.app.listen(global.serverOpts.port, global.serverOpts.hostname, () => {
			Logger.info(`Server started on ` + `${global.serverOpts.hostname}:${global.serverOpts.port}`.white.bold);
		});

		// Graceful shutdown
		process.once('SIGTERM', this.shutdown.bind(this));
		process.once('SIGINT', this.shutdown.bind(this));
	}

	public shutdown() {
		Logger.info('Shutting down...');

		this.server.close((err?: Error) => {
			Logger.info('Server closed');
			process.exit(err ? 1 : 0);
		});
	}

	private async healthCheck(req: Request, res: Response, next: NextFunction) {
		try {
			const client = await clientPromise;
			if (!(await isConnected(client))) {
				throw 'Database not connected';
			}

			res.status(200).send();
		} catch (error) {
			res.status(503).send();
		}
	}
}
