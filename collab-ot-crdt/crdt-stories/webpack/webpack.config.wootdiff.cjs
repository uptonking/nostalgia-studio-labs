const path = require('path');
const { merge } = require('webpack-merge');
const devServerConfig = require('../../../webpack/webpack.server');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = merge(devServerConfig, {
  // entry: path.resolve(__dirname, '../src/render.ts'),
  entry: path.resolve(__dirname, '../woot-diff/client.ts'),
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, '../dist'),
  },
  plugins: [
    new HtmlWebpackPlugin({
      // template: path.resolve(process.cwd(), 'demo.html'),
      template: './woot-diff/index.html',
      // filename: 'index.html',
    }),
  ],
  // devServer: {
  //   contentBase: path.resolve(__dirname, '../dist'),
  // },
});
