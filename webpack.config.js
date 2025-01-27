// webpack.config.js
const webpack = require('webpack')

'use strict';

const path = require( 'path-browserify' );

module.exports = {
    // mode: 'development',
    mode: 'production',
    entry: './app.js',

    output: {
        path: path.resolve( 'dist' ),
        filename: 'bundle.js'
    },

    module: {
        rules: [
            {
                test: /.(svg|ico|gif|png)$/,
                use: [ 'url-loader' ]
            }
        ]
    },

    // Useful for debugging.
    devtool: 'source-map',

    // By default webpack logs warnings if the bundle is bigger than 200kb.
    performance: { hints: false },
    resolve: {
        fallback: {
            "http": require.resolve("stream-http"),
            "https": require.resolve("https-browserify"),
            "url": require.resolve("url/"),
            "buffer": require.resolve("buffer/"),
            "zlib": require.resolve("browserify-zlib"),
            "crypto": require.resolve("crypto-browserify"),
            "stream": require.resolve("stream-browserify"),
            "assert": require.resolve("assert/"),
            "os": require.resolve("os-browserify/browser"),
            "buffer": require.resolve("buffer")
        }
    },
    plugins: [
        new webpack.ProvidePlugin({
            process: 'process/browser',
            Buffer: ['buffer', 'Buffer'],
        }),
    ]
};
