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
			'@typescript-eslint/no-unused-vars': 'off',
			'no-unused-vars': 'off',
			'no-useless-catch': 'off',
			'no-useless-escape': 'off',
		},
	},
	{
		ignores: ['dist/**', 'node_modules/**'],
	},
];