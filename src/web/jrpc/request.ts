// https://pkg.go.dev/github.com/go-pkgz/jrpc#Request
export interface JRpcRequest<T> {
	method: string;
	params?: T;
	id: number;
}
