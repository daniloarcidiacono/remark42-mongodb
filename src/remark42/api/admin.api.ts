import { AdminsResponse, EmailResponse, EnabledResponse, KeyResponse, OnEventRequest, OnEventResponse } from '@remark42/dto/admin.dto';
import { JRpcRoutes } from '@web/jrpc/router';

export interface AdminAPI {
	// Key executes find by siteID and returns substructure with secret key
	Key(siteID: string): Promise<KeyResponse>;

	// Admins executes find by siteID and returns admins ids
	Admins(siteID: string): Promise<AdminsResponse>;

	// Email executes find by siteID and returns admin's email
	Email(siteID: string): Promise<EmailResponse>;

	// Enabled return
	Enabled(siteID: string): Promise<EnabledResponse>;

	// OnEvent reacts on events from updates, created, delete and vote
	OnEvent([siteID, ev]: OnEventRequest): Promise<OnEventResponse>;
}

export function adminRoutes(adminAPI: AdminAPI) {
	return {
		'admin.key': adminAPI.Key,
		'admin.admins': adminAPI.Admins,
		'admin.email': adminAPI.Email,
		'admin.enabled': adminAPI.Enabled,
		'admin.event': adminAPI.OnEvent
	} as JRpcRoutes;
}
