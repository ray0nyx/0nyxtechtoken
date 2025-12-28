# TypeScript Configuration Guide

## Overview

This project uses TypeScript for type safety, but due to some complex component libraries and third-party dependencies, you may encounter TypeScript errors during development. This guide explains how to work with TypeScript in this project.

## Development Mode

For development, we've configured TypeScript to be more permissive to allow you to focus on building features without being blocked by type errors. The `tsconfig.json` file has been configured with:

- `"strict": false`
- `"noImplicitAny": false`
- `"skipLibCheck": true`

Additionally, we've created a `dev.sh` script that runs the development server with TypeScript checking disabled:

```bash
./dev.sh
```

This script sets the following environment variables:
- `TSC_COMPILE_ON_ERROR=true`
- `ESLINT_NO_DEV_ERRORS=true`

## Build Mode

For production builds, we use a stricter TypeScript configuration in `tsconfig.build.json`. This ensures that your code is properly type-checked before deployment.

To run a type check with the stricter configuration:

```bash
npx tsc --project tsconfig.build.json --noEmit
```

## Type Declarations

We've added several type declaration files to help TypeScript understand our codebase:

1. `src/types/ui-components.d.ts` - Contains type definitions for UI components
2. `src/types/d3.d.ts` - Contains type definitions for d3 libraries
3. `src/types/modules.d.ts` - Contains type definitions for React and other modules

## Common Issues and Solutions

### Missing Properties on UI Components

If you encounter errors about missing properties on UI components, you may need to update the `src/types/ui-components.d.ts` file to include those properties.

### D3 Library Type Errors

For D3 library type errors, you can:
1. Use the existing type definitions in `src/types/d3.d.ts`
2. Add type assertions (`as any`) when necessary
3. Install official type definitions: `npm install --save-dev @types/d3-scale @types/d3-shape`

### React Type Errors

For React-related type errors, check the `src/types/modules.d.ts` file and update as needed.

## Best Practices

1. **Gradually Improve Types**: Focus on adding proper types to new code while gradually improving existing code.
2. **Use Type Assertions Sparingly**: Only use `as any` when absolutely necessary.
3. **Document Complex Types**: Add comments to explain complex type definitions.
4. **Update Type Declarations**: When adding new UI components or third-party libraries, update the relevant declaration files.

## Resources

- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/) 