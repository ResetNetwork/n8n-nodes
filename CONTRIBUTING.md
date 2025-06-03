# Contributing to n8n Custom Nodes Collection

Thank you for your interest in contributing to the n8n Custom Nodes Collection! This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Prerequisites

- Node.js (version 18 or above)
- npm (version 8 or above)
- Git
- n8n (for testing)

### Development Setup

1. **Fork and clone the repository**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/n8n-nodes.git
   cd n8n-nodes
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Build all packages**:
   ```bash
   npm run build
   ```

4. **Set up local development environment**:
   ```bash
   ./setup-local.sh
   ```

## 🛠️ Development Workflow

### Making Changes

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** in the appropriate package directory

3. **Build and test**:
   ```bash
   # Build specific package
   cd n8n-nodes-your-package
   npm run build
   
   # Or build all packages
   npm run build
   ```

4. **Test in n8n**:
   ```bash
   ./start-n8n.sh
   ```

5. **Run linting and formatting**:
   ```bash
   npm run lint
   npm run lintfix
   npm run format
   ```

### Development Commands

```bash
# Install dependencies for all packages
npm install

# Build all packages
npm run build

# Run development mode (watch) for all packages
npm run dev

# Run linting on all packages
npm run lint

# Fix linting issues
npm run lintfix

# Format code
npm run format
```

### Working with Individual Packages

```bash
# Navigate to a specific package
cd n8n-nodes-contextual-document-loader

# Install dependencies for this package only
npm install

# Build this package only
npm run build

# Run in development mode
npm run dev

# Run linting for this package
npm run lint
```

## 📝 Code Standards

### TypeScript

- Use TypeScript for all new code
- Follow the existing code structure and patterns
- Use proper type annotations
- Target ES2019 or later

### Linting and Formatting

- We use ESLint for linting
- We use Prettier for code formatting
- Run `npm run lint` before committing
- Fix any linting issues with `npm run lintfix`
- Format code with `npm run format`

### Node Structure

Each n8n node should follow this structure:

```
n8n-nodes-your-node/
├── nodes/
│   └── YourNode/
│       ├── YourNode.node.ts
│       └── yourNode.svg
├── package.json
├── tsconfig.json
├── .eslintrc.js
└── README.md
```

### Package.json Requirements

Each package should include:

```json
{
  "name": "n8n-nodes-your-node",
  "version": "0.1.0",
  "description": "Description of your node",
  "keywords": ["n8n-community-node-package", ...],
  "license": "MIT",
  "homepage": "https://github.com/ResetNetwork/n8n-nodes#readme",
  "author": {
    "name": "Reset Network",
    "url": "https://github.com/ResetNetwork"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/ResetNetwork/n8n-nodes.git",
    "directory": "n8n-nodes-your-node"
  },
  "publishConfig": {
    "access": "public"
  },
  "n8n": {
    "n8nNodesApiVersion": 1,
    "nodes": ["dist/nodes/YourNode/YourNode.node.js"]
  }
}
```

## 🧪 Testing

### Local Testing

1. **Build your changes**:
   ```bash
   npm run build
   ```

2. **Link the package locally**:
   ```bash
   ./setup-local.sh
   ```

3. **Start n8n**:
   ```bash
   ./start-n8n.sh
   ```

4. **Test your node** in the n8n interface

### Testing Checklist

- [ ] Node appears in n8n interface
- [ ] Node executes without errors
- [ ] All input/output parameters work correctly
- [ ] Error handling works as expected
- [ ] Documentation is clear and complete
- [ ] Code passes linting
- [ ] No TypeScript errors

## 📦 Adding a New Node

### Step-by-Step Guide

1. **Create the package directory**:
   ```bash
   mkdir n8n-nodes-your-new-node
   cd n8n-nodes-your-new-node
   ```

2. **Create package.json** (use existing packages as template)

3. **Create the node structure**:
   ```bash
   mkdir -p nodes/YourNode
   ```

4. **Implement your node** in `nodes/YourNode/YourNode.node.ts`

5. **Add an icon** (`nodes/YourNode/yourNode.svg`)

6. **Create TypeScript config** (`tsconfig.json`)

7. **Add linting config** (`.eslintrc.js`)

8. **Write documentation** (`README.md`)

9. **Test your node** following the testing guidelines

10. **Update the root README.md** to include your new node

## 🔄 Pull Request Process

### Before Submitting

- [ ] Code follows the established patterns
- [ ] All tests pass
- [ ] Linting passes (`npm run lint`)
- [ ] Code is formatted (`npm run format`)
- [ ] Documentation is updated
- [ ] Changes are tested in n8n

### Pull Request Guidelines

1. **Create a descriptive title**
2. **Provide a detailed description** of your changes
3. **Reference any related issues**
4. **Include screenshots** if UI changes are involved
5. **List any breaking changes**

### Pull Request Template

```markdown
## Description
Brief description of the changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tested locally in n8n
- [ ] All linting passes
- [ ] No TypeScript errors

## Screenshots (if applicable)

## Additional Notes
```

## 🐛 Reporting Issues

### Bug Reports

When reporting bugs, please include:

- **Node name and version**
- **n8n version**
- **Node.js version**
- **Operating system**
- **Steps to reproduce**
- **Expected behavior**
- **Actual behavior**
- **Error messages or logs**
- **Screenshots (if applicable)**

### Feature Requests

When requesting features, please include:

- **Clear description** of the feature
- **Use case** and motivation
- **Proposed implementation** (if you have ideas)
- **Examples** of similar features

## 📋 Release Process

### Version Management

- Use semantic versioning (semver)
- Update version in package.json before releasing
- Create a git tag for releases

### Publishing

1. **Update version**:
   ```bash
   cd n8n-nodes-your-package
   npm version patch  # or minor, major
   ```

2. **Build and test**:
   ```bash
   npm run build
   npm run lint
   ```

3. **Publish** (requires npm permissions):
   ```bash
   npm publish --access public
   ```

## 🤝 Community Guidelines

### Code of Conduct

- Be respectful and inclusive
- Help others learn and grow
- Provide constructive feedback
- Follow the project's coding standards

### Communication

- Use GitHub Issues for bug reports and feature requests
- Use GitHub Discussions for questions and general discussion
- Be clear and concise in your communication
- Provide context and examples when asking for help

## 📚 Resources

- [n8n Documentation](https://docs.n8n.io/)
- [n8n Community Nodes Guide](https://docs.n8n.io/integrations/community-nodes/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Node.js Documentation](https://nodejs.org/docs/)

## 🙏 Recognition

Contributors will be recognized in:
- The project README
- Release notes
- GitHub contributors list

Thank you for contributing to the n8n Custom Nodes Collection! 