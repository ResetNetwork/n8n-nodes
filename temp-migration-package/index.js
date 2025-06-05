console.error(`
⚠️  PACKAGE MOVED ⚠️

This package has been moved to: @resettech/n8n-nodes-semantic-text-splitter

Please update your installation:
  npm uninstall n8n-nodes-semantic-text-splitter
  npm install @resettech/n8n-nodes-semantic-text-splitter

For n8n users:
  1. Go to Settings > Community Nodes
  2. Uninstall: n8n-nodes-semantic-text-splitter
  3. Install: @resettech/n8n-nodes-semantic-text-splitter

More info: https://www.npmjs.com/package/@resettech/n8n-nodes-semantic-text-splitter
`);

throw new Error('Package moved to @resettech/n8n-nodes-semantic-text-splitter'); 