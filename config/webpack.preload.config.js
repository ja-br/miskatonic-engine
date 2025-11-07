const path = require('path');

module.exports = {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  target: 'electron-preload',
  entry: './packages/preload/src/index.ts',
  output: {
    path: path.resolve(__dirname, '../dist/preload'),
    filename: 'index.js',
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      '@miskatonic/shared': path.resolve(__dirname, '../packages/shared/src'),
    },
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: 'ts-loader',
          options: {
            configFile: path.resolve(__dirname, '../packages/preload/tsconfig.json'),
            transpileOnly: true, // Skip type checking in webpack (use npm run typecheck instead)
          },
        },
        exclude: /node_modules/,
      },
    ],
  },
  externals: {
    electron: 'commonjs electron',
  },
  devtool: process.env.NODE_ENV === 'production' ? false : 'source-map',
};
