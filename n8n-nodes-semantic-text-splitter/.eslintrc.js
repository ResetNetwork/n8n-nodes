module.exports = {
  root: true,
  env: {
    node: true,
  },
  parser: '@typescript-eslint/parser',
  plugins: ['eslint-plugin-n8n-nodes-base'],
  extends: ['plugin:n8n-nodes-base/community'],
  ignorePatterns: ['dist/', 'node_modules/', '.eslintrc.js'],
  rules: {
    'n8n-nodes-base/node-filename-against-convention': 'off',
  },
}; 