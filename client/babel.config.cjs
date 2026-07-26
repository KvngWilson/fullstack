module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    ['@babel/preset-react', { runtime: 'automatic' }],
  ],
  plugins: [
    function transformImportMetaEnv({ types: t }) {
      const isImportMeta = (node) =>
        t.isMetaProperty(node) &&
        t.isIdentifier(node.meta, { name: 'import' }) &&
        t.isIdentifier(node.property, { name: 'meta' });

      const isImportMetaEnv = (node) =>
        t.isMemberExpression(node) &&
        isImportMeta(node.object) &&
        t.isIdentifier(node.property, { name: 'env' });

      return {
        visitor: {
          MemberExpression(path) {
            const { node } = path;

            if (isImportMetaEnv(node)) {
              path.replaceWith(
                t.memberExpression(t.identifier('process'), t.identifier('env')),
              );
              return;
            }

            if (t.isMemberExpression(node.object) && isImportMetaEnv(node.object)) {
              path.replaceWith(
                t.memberExpression(
                  t.memberExpression(t.identifier('process'), t.identifier('env')),
                  node.property,
                  node.computed,
                ),
              );
            }
          },
        },
      };
    },
  ],
};