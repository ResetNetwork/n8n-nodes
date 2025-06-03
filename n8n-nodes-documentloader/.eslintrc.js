module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
    sourceType: 'module',
  },
  extends: ['plugin:n8n-nodes-base/nodes'],
  ignorePatterns: ['.eslintrc.js', 'gulpfile.js', 'dist/**/*', 'node_modules/**/*'],
  rules: {
    'n8n-nodes-base/node-dirname-against-convention': 'off',
    'n8n-nodes-base/node-class-description-inputs-wrong-regular-node': 'off',
    'n8n-nodes-base/node-class-description-outputs-wrong': 'off',
  },
}; 