import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

const level = () => {
	const env = process.env.NODE_ENV || 'production';
	const isDevelopment = env === 'development';
	return isDevelopment ? 'debug' : 'http';
};

winston.addColors({
	error: 'red',
	warn: 'yellow',
	info: 'green',
	http: 'magenta',
	debug: 'white'
});

// https://stackoverflow.com/questions/23953232/winston-logging-separate-levels-to-separate-transports
const levelFilter = (levels: string[]): winston.Logform.FormatWrap => {
	return winston.format((info, opts) => {
		return levels.includes(info.level) ? info : false;
	});
};

const defaultFormat = winston.format.combine(
	winston.format.splat(),
	winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
	winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
);

const consoleFormat = winston.format.combine(
	winston.format.splat(),
	winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
	winston.format.colorize({ all: true }),
	winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
);

const toDays = (days?: number) => (days !== undefined ? days + 'd' : undefined);

let logger: winston.Logger;

function getLogger() {
	if (!logger) {
		// Create the logger instance that has to be exported
		// and used to log messages.
		logger = winston.createLogger({
			level: level(),
			levels: {
				error: 0,
				warn: 1,
				http: 2,
				info: 3,
				debug: 4
			},
			format: defaultFormat,
			transports: [
				new DailyRotateFile({
					// This filename can include the %DATE% placeholder which will include the
					// formatted datePattern at that point in the filename.
					filename: path.join(global.serverOpts.logDir, 'access-%DATE%.log'),

					// Logs will rotate each day
					// Note: do not specify the 'frequency' parameter, otherwise the %DATA% won't be resolved
					// (see https://github.com/winstonjs/winston-daily-rotate-file/issues/312)
					datePattern: 'YYYY-MM-DD',
					zippedArchive: true,
					maxSize: global.serverOpts.logMaxSize,

					// Maximum number of logs to keep. If not set, no logs will be removed
					maxFiles: toDays(global.serverOpts.logMaxFiles),
					level: 'http',
					format: winston.format.combine(levelFilter(['http'])(), defaultFormat)
				}),

				new DailyRotateFile({
					// This filename can include the %DATE% placeholder which will include the
					// formatted datePattern at that point in the filename.
					filename: path.join(global.serverOpts.logDir, 'main-%DATE%.log'),

					// Logs will rotate each day
					// Note: do not specify the 'frequency' parameter, otherwise the %DATA% won't be resolved
					// (see https://github.com/winstonjs/winston-daily-rotate-file/issues/312)
					datePattern: 'YYYY-MM-DD',
					zippedArchive: true,
					maxSize: global.serverOpts.logMaxSize,

					// Maximum number of logs to keep. If not set, no logs will be removed
					maxFiles: toDays(global.serverOpts.logMaxFiles),
					level: 'debug',
					format: winston.format.combine(levelFilter(['debug', 'info', 'warn'])(), defaultFormat)
				}),

				new DailyRotateFile({
					// This filename can include the %DATE% placeholder which will include the
					// formatted datePattern at that point in the filename.
					filename: path.join(global.serverOpts.logDir, 'error-%DATE%.log'),

					// Logs will rotate each day
					// Note: do not specify the 'frequency' parameter, otherwise the %DATA% won't be resolved
					// (see https://github.com/winstonjs/winston-daily-rotate-file/issues/312)
					datePattern: 'YYYY-MM-DD',
					zippedArchive: true,
					maxSize: global.serverOpts.logMaxSize,

					// Maximum number of logs to keep. If not set, no logs will be removed
					maxFiles: toDays(global.serverOpts.logMaxFiles),
					level: 'error'
				}),

				new winston.transports.Console({
					format: winston.format.combine(levelFilter(['debug', 'info', 'warn'])(), consoleFormat)
				})
			]
		});
	}

	return logger;
}

export default getLogger;
