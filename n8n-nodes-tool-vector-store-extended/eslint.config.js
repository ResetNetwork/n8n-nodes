module.exports = [
	{
		files: ['**/*.ts'],
		languageOptions: {
			parser: require('@typescript-eslint/parser'),
			parserOptions: {
				ecmaVersion: 2020,
				sourceType: 'module',
			},
		},
		plugins: {
			'@typescript-eslint': require('@typescript-eslint/eslint-plugin'),
			'n8n-nodes-base': require('eslint-plugin-n8n-nodes-base'),
		},
		rules: {
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
			'@typescript-eslint/no-explicit-any': 'off',
			'n8n-nodes-base/node-dirname-against-convention': 'error',
			'n8n-nodes-base/node-class-description-inputs-wrong-regular-node': 'error',
			'n8n-nodes-base/node-class-description-outputs-wrong': 'error',
		},
	},
];