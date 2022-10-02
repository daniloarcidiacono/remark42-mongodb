const path = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');
const nodeExternals = require('webpack-node-externals');

const {
	NODE_ENV = 'production'
} = process.env;

// https://medium.com/the-andela-way/how-to-set-up-an-express-api-using-webpack-and-typescript-69d18c8c4f52
module.exports = {
	entry: './src/index.ts',
	mode: NODE_ENV,
	devtool: NODE_ENV === 'development' ? 'source-map' : undefined,
	target: 'node',
	output: {
		path: path.resolve(__dirname, 'dist'),
		filename: `remark42-mongodb.js`,
	},
	resolve: {
		extensions: ['.ts', '.js'],
		plugins: [ 
			new TsconfigPathsPlugin({}) 
		]
	},
	plugins: [
		new CleanWebpackPlugin()
	],
	module: {
		rules: [
			{
				test: /\.ts$/,
				use: 'ts-loader'
			},
		],
	},
	externals: [ nodeExternals() ], // in order to ignore all modules in node_modules folder
	externalsPresets: { node: true }, // in order to ignore built-in modules like path, fs, etc.
	watch: NODE_ENV === 'development',
	watchOptions: {
		ignored: [
			path.resolve(__dirname, 'node_modules')
		]
	}
};
