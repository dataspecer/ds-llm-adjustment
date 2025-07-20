const nodeExternals = require('webpack-node-externals');

module.exports = function (options, webpack) {
  return {
    ...options,
    externals: [
      nodeExternals({
        allowlist: ['webpack/hot/poll?100'],
      }),
    ],
    resolve: {
      ...options.resolve,
      fallback: {
        crypto: false, // Don't bundle crypto, use Node.js built-in
        stream: false,
        buffer: false,
        util: false,
        url: false,
        querystring: false,
      },
    },
    target: 'node',
    node: {
      __dirname: false,
      __filename: false,
    },
  };
}; 