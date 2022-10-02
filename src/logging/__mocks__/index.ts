import winston from 'winston';

// https://stackoverflow.com/questions/38363292/disable-winston-logging-when-running-unit-tests
const Logger = winston.createLogger({
	transports: [
		new winston.transports.Console({
			silent: process.argv.indexOf('--silent') >= 0
		})
	]
});

export default Logger;
