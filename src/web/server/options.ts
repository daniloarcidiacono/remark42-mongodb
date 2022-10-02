export interface ServerOptions {
	/**
	 * Server port.
	 */
	port: number;

	/**
	 * Hostname.
	 */
	hostname: string;

	/**
	 * MongoDB connection string.
	 */
	database: string;

	/**
	 * MongoDB avatars bucket name.
	 */
	avatars: string | undefined;

	/**
	 * Maximum request body size.
	 */
	bodyLimit: string;

	/**
	 * Logs directory.
	 */
	logDir: string;

	/**
	 * Log files maximum size (e.g. 1k, 1m, 1g)
	 */
	logMaxSize: string;

	/**
	 * Maximum number of logs to keep in days. If not set, no logs will be removed.
	 */
	logMaxFiles?: number;

	/**
	 * Whether to create posts dynamically.
	 */
	dynamicPosts: boolean;
}

export const DEFAULT_SERVER_OPTIONS: ServerOptions = {
	port: 9000,
	hostname: 'localhost',
	database: 'mongodb://localhost:27017/remark42-mongodb',
	avatars: undefined,
	bodyLimit: '8mb',
	dynamicPosts: true,
	logDir: 'logs',
	logMaxSize: '8m',
	logMaxFiles: 30
};
