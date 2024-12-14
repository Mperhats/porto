module.exports = [
  {
    name: "import * from 'ox'",
    path: './src/_dist/index.js',
    import: '*',
    limit: '54 kB',
    modifyWebpackConfig: (config) => {
      config.resolve = {
        fallback: {
          crypto: false,
        },
      }
      return config
    },
  },
]
