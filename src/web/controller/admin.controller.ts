import { AdminsResponse, EmailResponse, EnabledResponse, KeyResponse, OnEventRequest, OnEventResponse } from '@remark42/dto/admin.dto';
import { StoreMongoDAO } from '@persistence/dao/store.dao';
import clientPromise from '@persistence/mongodb';
import { AdminAPI } from '@remark42/api/admin.api';

export class AdminMongoController implements AdminAPI {
	public constructor() {}

	public Admins = async (siteID: string): Promise<AdminsResponse> => {
		const client = await clientPromise;
		return StoreMongoDAO.getSiteAdmins(client, siteID);
	};

	public Email = async (siteID: string): Promise<EmailResponse> => {
		const client = await clientPromise;
		return StoreMongoDAO.getSiteAdminEmail(client, siteID);
	};

	public Enabled = async (siteID: string): Promise<EnabledResponse> => {
		const client = await clientPromise;
		return StoreMongoDAO.isSiteEnabled(client, siteID);
	};

	public Key = async (siteID: string): Promise<KeyResponse> => {
		const client = await clientPromise;
		return StoreMongoDAO.getSiteKey(client, siteID);
	};

	public OnEvent = async ([siteID, ev]: OnEventRequest): Promise<OnEventResponse> => {
		// Does nothing
	};
}
