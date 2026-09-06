// Jest executes CommonJS; Vite supplies this object in browser builds.
module.exports = function viteEnvForTests({ types: t }) {
  return {
    visitor: {
      MemberExpression(path) {
        const { object, property, computed } = path.node;
        if (
          !computed &&
          t.isMetaProperty(object) &&
          object.meta.name === 'import' &&
          object.property.name === 'meta' &&
          t.isIdentifier(property, { name: 'env' })
        ) {
          path.replaceWith(
            t.memberExpression(t.identifier('process'), t.identifier('env'))
          );
        }
      }
    }
  };
};
