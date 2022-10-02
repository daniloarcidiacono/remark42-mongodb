export type JRpcEndpoint<P, R> = (params: P) => Promise<R>;
