const js = require('@eslint/js');
const typescript = require('@typescript-eslint/eslint-plugin');
const typescriptParser = require('@typescript-eslint/parser');
const globals = require('globals');

module.exports = [
	js.configs.recommended,
	{
		files: ['**/*.ts'],
		languageOptions: {
			parser: typescriptParser,
			parserOptions: {
				sourceType: 'module',
			},
			globals: {
				...globals.node,
			},
		},
		plugins: {
			'@typescript-eslint': typescript,
		},
		rules: {
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
			'no-unused-vars': 'off',
		},
	},
	{
		ignores: ['dist/**', 'node_modules/**'],
	},
]; 