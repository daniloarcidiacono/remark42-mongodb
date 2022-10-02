import {ServerOptions} from "@web/server/options";

export {};

declare global {
	var serverOpts: ServerOptions;

	// Used in tests
	var __MONGO_URI__: string;
	var __MONGO_DB_NAME__: string;
}
