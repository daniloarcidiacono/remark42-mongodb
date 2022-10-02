import fs from 'fs';
import yargs, { CommandModule } from 'yargs';
import { hideBin } from 'yargs/helpers';
import inquirer from 'inquirer';
import 'colors';
import { MongoClient } from 'mongodb';
import packageJson from '../../package.json';
import { CLIMongoDAO } from '@persistence/dao/cli.dao';
import { PostSubDocument, SiteDocument } from '@persistence/entity/site.entity';
import { StoreMongoDAO } from '@persistence/dao/store.dao';
import { Locator } from '@remark42/dto/store.dto';
import { DEFAULT_SERVER_OPTIONS, ServerOptions } from '@web/server/options';
import { isBlank } from '@util/string';
import yn from '@util/yn';

export class CLI {
	private initCommand: CommandModule;
	private serveCommand: CommandModule;
	private sitesCreateCommand: CommandModule;
	private sitesListCommand: CommandModule;
	private sitesCommand: CommandModule;
	private postsCreateCommand: CommandModule;
	private postsListCommand: CommandModule;
	private postsCommand: CommandModule;

	public constructor() {
		this.initCommand = {
			command: 'init',
			builder: yargs => {
				return yargs.option('yes', {
					description: 'Accept defaults',
					alias: 'y',
					default: false,
					type: 'boolean'
				});
			},
			describe: 'Set up the configuration file',
			handler: args => {
				return this.init(args.yes as boolean);
			}
		};

		this.serveCommand = {
			command: 'serve',
			describe: 'Starts the server',
			handler: () => {
				this.serve();
			}
		};

		this.sitesCreateCommand = {
			command: 'create [name]',
			describe: 'Creates a new site',
			builder: {
				name: {
					type: 'string',
					description: 'Site identifier name',
					demandOption: true
				}
			},
			handler: args => {
				return this.createSite(args.name as string);
			}
		};

		this.sitesListCommand = {
			command: 'list',
			describe: 'Lists posts',
			handler: () => {
				return this.listSites();
			}
		};

		this.sitesCommand = {
			command: 'sites <command>',
			describe: 'Manages sites',
			builder: yargs => {
				// prettier-ignore
				return yargs
                    .command(this.sitesCreateCommand)
                    .command(this.sitesListCommand);
			},
			handler: () => {}
		};

		this.postsCreateCommand = {
			command: 'create [site] [url]',
			describe: 'Creates a new post',
			builder: {
				site: {
					type: 'string',
					description: 'Site identifier name',
					demandOption: true
				},
				url: {
					type: 'string',
					description: 'Post URL',
					demandOption: true
				}
			},
			handler: args => {
				return this.createPost(args.site as unknown as string, args.url as unknown as string);
			}
		};

		this.postsListCommand = {
			command: 'list [site]',
			describe: 'Lists posts',
			builder: {
				site: {
					type: 'string',
					description: 'Site identifier name',
					demandOption: true
				}
			},
			handler: args => {
				return this.listPosts(args.site as unknown as string);
			}
		};

		this.postsCommand = {
			command: 'posts <command>',
			describe: 'Manages posts',
			builder: yargs => {
				// prettier-ignore
				return yargs
                    .command(this.postsCreateCommand)
                    .command(this.postsListCommand);
			},
			handler: () => {}
		};
	}

	public run() {
		return yargs(hideBin(process.argv))
			.scriptName('remark42-mongodb')
			.strict()
			.command(this.initCommand)
			.command(this.serveCommand)
			.command(this.sitesCommand)
			.command(this.postsCommand)
			.demandCommand()
			.help()
			.alias('help', 'h')
			.parse();
	}

	public async init(acceptDefaults: boolean) {
		console.info(`Remark42 MongoDB Server v${packageJson.version}`.cyan);

		// If the configuration file exists...
		if (fs.existsSync(this.configPath)) {
			// Ask permission to overwrite it
			const { overwrite } = await inquirer.prompt([
				{
					name: 'overwrite',
					message: `Config file '${this.configPath}' exists. Overwrite?`,
					type: 'confirm',
					default: false
				}
			]);

			// Permission denied, stop
			if (!overwrite) {
				return;
			}
		}

		// Init default values
		let config: ServerOptions = {
			...DEFAULT_SERVER_OPTIONS
		};

		// Ask for configuration values if not accepting the defaults
		if (!acceptDefaults) {
			config = (await inquirer.prompt([
				{
					name: 'port',
					message: 'Server port',
					type: 'number',
					default: config.port
				},
				{
					name: 'hostname',
					message: 'Server hostname',
					type: 'string',
					default: config.hostname
				},
				{
					name: 'database',
					message: 'MongoDB connection string',
					type: 'string',
					default: config.database
				},
				{
					name: 'avatars',
					message: 'Avatars GridFS bucket name',
					type: 'string',
					required: false
				},
				{
					name: 'bodyLimit',
					message: 'Body maximum size',
					type: 'string',
					default: config.bodyLimit
				},
				{
					name: 'dynamicPosts',
					message: 'Create posts dynamically',
					type: 'boolean',
					default: config.dynamicPosts
				},
				{
					name: 'logDir',
					message: 'Log folder path',
					type: 'string',
					default: config.logDir
				},
				{
					name: 'logMaxSize',
					message: 'Log files maximum size (e.g. 1k, 1m, 1g)',
					type: 'string',
					default: config.logMaxSize
				},
				{
					name: 'logMaxFiles',
					message: 'Maximum number of logs to keep in days. If negative, no logs will be removed.',
					type: 'number',
					default: config.logMaxFiles
				}
			])) as unknown as ServerOptions;

			if (config.avatars === '') {
				delete config.avatars;
			}
			if (config.logMaxFiles < 0) {
				delete config.logMaxFiles;
			}
		}

		// Write
		fs.writeFileSync(this.configPath, JSON.stringify(config, null, 4), { encoding: 'utf-8' });
		console.info(`Written config file '${this.configPath}'.`.green);
	}

	public async serve() {
		console.info(`Remark42 MongoDB Server v${packageJson.version}`.cyan);
		await this.loadConfig();

		// Load and run the server
		const { Remark42MongoDBServer } = await import('@web/server');
		return new Remark42MongoDBServer().run();
	}

	public async listSites() {
		console.info(`Remark42 MongoDB Server v${packageJson.version}`.cyan);
		await this.loadConfig();

		const client: MongoClient = await this.connectDb();
		try {
			const sites: SiteDocument[] = await CLIMongoDAO.listSites(client);
			if (sites.length > 0) {
				console.table(sites);
			} else {
				console.info('No sites.');
			}
		} finally {
			return client.close();
		}
	}

	public async createSite(name: string) {
		console.info(`Remark42 MongoDB Server v${packageJson.version}`.cyan);
		await this.loadConfig();

		// Connect to database
		const client: MongoClient = await this.connectDb();

		try {
			if (await CLIMongoDAO.siteExists(client, name)) {
				console.error(`Site '${name}' already exists!`.red);
				process.exit(1);
			}

			const { key, adminEmail } = await inquirer.prompt([
				{
					name: 'key',
					message: 'Encryption key',
					type: 'password'
				},
				{
					name: 'adminEmail',
					message: 'Administrator email',
					type: 'string'
				}
			]);

			// Create the site
			await CLIMongoDAO.createSite(client, name, key, adminEmail);
			console.info(`Site '${name}' created`.green);
		} finally {
			return client.close();
		}
	}

	public async listPosts(site: string) {
		console.info(`Remark42 MongoDB Server v${packageJson.version}`.cyan);
		await this.loadConfig();

		const client: MongoClient = await this.connectDb();
		try {
			if (!(await CLIMongoDAO.siteExists(client, site))) {
				console.error(`Site '${site}' not found!`.red);
				process.exit(1);
			}

			const posts: PostSubDocument[] = await CLIMongoDAO.listPosts(client, site);
			if (posts.length > 0) {
				console.table(posts);
			} else {
				console.info('No posts.');
			}
		} finally {
			return client.close();
		}
	}

	public async createPost(site: string, url: string) {
		console.info(`Remark42 MongoDB Server v${packageJson.version}`.cyan);
		await this.loadConfig();

		// Connect to database
		const client: MongoClient = await this.connectDb();

		try {
			if (!(await CLIMongoDAO.siteExists(client, site))) {
				console.error(`Site '${site}' not found!`.red);
				process.exit(1);
			}

			const locator: Locator = { site, url };
			if (await StoreMongoDAO.postExists(client, locator)) {
				console.error(`Post '${url}' already exists!`.red);
				process.exit(1);
			}

			const { readOnly } = await inquirer.prompt([
				{
					name: 'readOnly',
					message: 'Read only',
					type: 'confirm',
					default: false
				}
			]);

			// Create the post
			await CLIMongoDAO.createPost(client, locator, readOnly);
			console.info(`Post '${url}' created`.green);
		} finally {
			return client.close();
		}
	}

	private async loadConfig() {
		// Check for config file existence
		if (!fs.existsSync(this.configPath)) {
			console.error(`Configuration file '${this.configPath}' not found!`.red);
			process.exit(1);
		}

		// Read and parse the config file
		let config: Partial<ServerOptions>;
		try {
			config = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
		} catch (e) {
			console.error(`Cannot read config file '${this.configPath}'!`.red);
			process.exit(1);
		}

		console.info(`Loaded configuration file '${this.configPath}'`);

		// Setup default configuration object
		global.serverOpts = {
			...DEFAULT_SERVER_OPTIONS
		};

		// Inject properties from JSON (one by one to prevent pollution)
		if (config.port !== undefined) {
			global.serverOpts.port = config.port;
		}
		if (config.hostname !== undefined) {
			global.serverOpts.hostname = config.hostname;
		}
		if (config.database !== undefined) {
			global.serverOpts.database = config.database;
		}
		if (config.avatars !== undefined) {
			global.serverOpts.avatars = config.avatars;
		}
		if (config.bodyLimit !== undefined) {
			global.serverOpts.bodyLimit = config.bodyLimit;
		}
		if (config.dynamicPosts !== undefined) {
			global.serverOpts.dynamicPosts = config.dynamicPosts;
		}
		if (config.logDir !== undefined) {
			global.serverOpts.logDir = config.logDir;
		}
		if (config.logMaxSize !== undefined) {
			global.serverOpts.logMaxSize = config.logMaxSize;
		}
		global.serverOpts.logMaxFiles = config.logMaxFiles;

		// Check if environment variables are set
		if (process.env.hasOwnProperty('REMARK42_MONGODB_PORT') && !isBlank(process.env.REMARK42_MONGODB_PORT)) {
			global.serverOpts.port = parseInt(process.env.REMARK42_MONGODB_PORT as string);
			console.info('Picked ' + 'REMARK42_MONGODB_PORT'.cyan.bold);
		}
		if (process.env.hasOwnProperty('REMARK42_MONGODB_HOSTNAME') && !isBlank(process.env.REMARK42_MONGODB_HOSTNAME)) {
			global.serverOpts.hostname = process.env.REMARK42_MONGODB_HOSTNAME as string;
			console.info('Picked ' + 'REMARK42_MONGODB_HOSTNAME'.cyan.bold);
		}
		if (process.env.hasOwnProperty('REMARK42_MONGODB_DATABASE') && !isBlank(process.env.REMARK42_MONGODB_DATABASE)) {
			global.serverOpts.database = process.env.REMARK42_MONGODB_DATABASE as string;
			console.info('Picked ' + 'REMARK42_MONGODB_DATABASE'.cyan.bold);
		}
		if (process.env.hasOwnProperty('REMARK42_MONGODB_AVATARS')) {
			global.serverOpts.avatars = !isBlank(process.env.REMARK42_MONGODB_AVATARS) ? (process.env.REMARK42_MONGODB_AVATARS as string) : undefined;
			console.info('Picked ' + 'REMARK42_MONGODB_AVATARS'.cyan.bold);
		}
		if (process.env.hasOwnProperty('REMARK42_MONGODB_BODY_LIMIT') && !isBlank(process.env.REMARK42_MONGODB_BODY_LIMIT)) {
			global.serverOpts.bodyLimit = process.env.REMARK42_MONGODB_BODY_LIMIT as string;
			console.info('Picked ' + 'REMARK42_MONGODB_BODY_LIMIT'.cyan.bold);
		}
		if (process.env.hasOwnProperty('REMARK42_MONGODB_DYNAMIC_POSTS') && !isBlank(process.env.REMARK42_MONGODB_DYNAMIC_POSTS)) {
			global.serverOpts.dynamicPosts = yn(process.env.REMARK42_MONGODB_DYNAMIC_POSTS);
			console.info('Picked ' + 'REMARK42_MONGODB_DYNAMIC_POSTS'.cyan.bold);
		}
		if (process.env.hasOwnProperty('REMARK42_MONGODB_LOG_DIR') && !isBlank(process.env.REMARK42_MONGODB_LOG_DIR)) {
			global.serverOpts.logDir = process.env.REMARK42_MONGODB_LOG_DIR as string;
			console.info('Picked ' + 'REMARK42_MONGODB_LOG_DIR'.cyan.bold);
		}
		if (process.env.hasOwnProperty('REMARK42_MONGODB_LOG_MAX_SIZE') && !isBlank(process.env.REMARK42_MONGODB_LOG_MAX_SIZE)) {
			global.serverOpts.logMaxSize = process.env.REMARK42_MONGODB_LOG_MAX_SIZE as string;
			console.info('Picked ' + 'REMARK42_MONGODB_LOG_MAX_SIZE'.cyan.bold);
		}
		if (process.env.hasOwnProperty('REMARK42_MONGODB_LOG_MAX_FILES')) {
			global.serverOpts.logMaxFiles = !isBlank(process.env.REMARK42_MONGODB_LOG_MAX_FILES)
				? parseInt(process.env.REMARK42_MONGODB_LOG_MAX_FILES as string)
				: undefined;
			console.info('Picked ' + 'REMARK42_MONGODB_LOG_MAX_FILES'.cyan.bold);
		}
	}

	private async connectDb(): Promise<MongoClient> {
		const clientPromise: Promise<MongoClient> = (await import('@persistence/mongodb')).default as unknown as Promise<MongoClient>;
		let client: MongoClient = null;

		try {
			client = await clientPromise;
			return client;
		} catch (e) {
			console.error('Could not connect to database!'.red);
			process.exit(1);
		}
	}

	private get configPath(): string {
		return process.env.CONFIG_PATH || 'remark42-mongodb.json';
	}
}
