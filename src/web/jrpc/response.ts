// https://pkg.go.dev/github.com/go-pkgz/jrpc#Response
export interface JRpcResponse<T> {
	result?: T;
	error?: string;
	id: number;
}
