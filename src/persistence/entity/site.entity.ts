export interface SiteDocument {
	_id: string;
	enabled: boolean;
	key: string;
	adminEmail: string;
	posts: PostSubDocument[];
}

export interface PostSubDocument {
	url: string;
	readOnly: boolean;
}
