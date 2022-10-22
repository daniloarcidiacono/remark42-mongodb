import winston from 'winston';

let logger: winston.Logger;

function getLogger() {
	if (!logger) {
		// https://stackoverflow.com/questions/38363292/disable-winston-logging-when-running-unit-tests
		logger = winston.createLogger({
			transports: [
				new winston.transports.Console({
					silent: process.argv.indexOf('--silent') >= 0
				})
			]
		});
	}

	return logger;
}

export default getLogger;
