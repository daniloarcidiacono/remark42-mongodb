import { JRpcRoutes } from '@web/jrpc/router';
import { AdminMongoController } from '@web/controller/admin.controller';
import { StoreMongoController } from '@web/controller/store.controller';
import { ImageMongoController } from '@web/controller/image.controller';
import { adminRoutes } from '@remark42/api/admin.api';
import { imageRoutes } from '@remark42/api/image.api';
import { storeRoutes } from '@remark42/api/store.api';

export default {
	...adminRoutes(new AdminMongoController()),
	...storeRoutes(new StoreMongoController()),
	...imageRoutes(new ImageMongoController())
} as JRpcRoutes;
