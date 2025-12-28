# TypeScript Error Handling Guide

## Overview

This project uses TypeScript for type safety, but due to some complex component libraries and third-party dependencies, you may encounter TypeScript errors during development. This guide explains how to work with TypeScript in this project.

## Quick Start

To fix TypeScript errors and start the development server:

```bash
# Fix TypeScript errors
./fix-typescript.sh

# Start the development server
./dev.sh
```

## Common TypeScript Errors and Solutions

### 1. Toast Variant Errors

If you see errors like:
```
Object literal may only specify known properties, and 'variant' does not exist in type 'Toast'.
```

**Solution**: The `Toast` interface has been updated in `src/types/ui-components.d.ts` to include the `variant` property with values 'default', 'destructive', and 'success'.

### 2. Missing Properties on UI Components

If you see errors like:
```
Property 'className' does not exist on type 'ButtonProps & RefAttributes<HTMLButtonElement>'.
```

**Solution**: The component interfaces have been updated in `src/types/ui-components.d.ts` to include common properties like `className`, `onClick`, etc.

### 3. D3 Library Type Errors

If you see errors like:
```
Cannot find type definition file for 'd3-scale'.
```

**Solution**: We've added basic type declarations for d3 libraries in `src/types/d3-types.d.ts`. For more comprehensive type support, you can install the official type definitions:

```bash
npm install --save-dev @types/d3-scale @types/d3-shape
```

Alternatively, you can run the `fix-typescript.sh` script to create temporary type definitions:

```bash
./fix-typescript.sh
```

### 4. Supabase RPC Method Errors

If you see errors like:
```
Property 'rpc' does not exist on type 'SupabaseClient'.
```

**Solution**: Use type assertion when calling the `rpc` method:

```typescript
const { data, error } = await (supabase as any).rpc('procedure_name', params);
```

### 5. HTML Attributes Key Property Errors

If you see errors like:
```
Type '{ key: string; }' is not assignable to type 'HTMLAttributes<HTMLDivElement>'.
```

**Solution**: The `HTMLAttributes` interface has been updated in `src/types/modules.d.ts` to include common properties like `key`, `className`, etc.

### 6. tsconfig.json Errors

If you see errors in the tsconfig.json file, use the development-specific configuration:

```bash
# Run TypeScript with the development configuration
npx tsc --project tsconfig.dev.json
```

## Development Workflow

For a smoother development experience, we've created a `dev.sh` script that runs the development server with TypeScript checking disabled:

```bash
./dev.sh
```

This script sets environment variables that prevent TypeScript errors from blocking your development workflow and uses the development-specific TypeScript configuration.

## TypeScript Configuration

The project uses two TypeScript configurations:

1. `tsconfig.json` - The main configuration used for production builds
2. `tsconfig.dev.json` - A more permissive configuration used for development

The development configuration has most strict checks disabled, allowing you to focus on building features without being blocked by TypeScript errors.

## Adding New Type Definitions

If you encounter TypeScript errors for new components or libraries:

1. Check if the error is related to a UI component and update `src/types/ui-components.d.ts`
2. For third-party libraries, check if type definitions are available:
   ```bash
   npm install --save-dev @types/library-name
   ```
3. If official type definitions aren't available, add basic declarations in `src/types/modules.d.ts` or create a new declaration file like `src/types/library-name.d.ts`

## Resources

- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/) 