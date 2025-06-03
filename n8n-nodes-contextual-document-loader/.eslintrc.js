module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  extends: [
    'plugin:n8n-nodes-base/nodes',
  ],
  plugins: [
    'n8n-nodes-base',
  ],
  rules: {
    'n8n-nodes-base/node-dirname-against-convention': 'off',
    'n8n-nodes-base/node-class-description-inputs-wrong-regular-node': 'off',
    'n8n-nodes-base/node-class-description-outputs-wrong': 'off',
  },
}; 