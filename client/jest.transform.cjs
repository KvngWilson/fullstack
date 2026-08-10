const babelJest = require('babel-jest');

const baseTransformer = babelJest.createTransformer({
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    ['@babel/preset-react', { runtime: 'automatic' }],
  ],
});

module.exports = {
  process(src, filename, ...rest) {
    const normalizedSource = src
      .replace(/import\.meta\.env\.([A-Za-z_$][\w$]*)/g, 'process.env.$1')
      .replace(/import\.meta\.env/g, 'process.env');

    return baseTransformer.process(normalizedSource, filename, ...rest);
  },
};
