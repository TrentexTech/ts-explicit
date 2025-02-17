# ts-explicit

`ts-explicit` is a CLI tool that automatically adds explicit type annotations to your TypeScript code using type inference via ts-morph. It improves code clarity and maintainability by ensuring that functions, variables, and class properties have explicit type declarations.

## Installation

Install `ts-explicit` as a development dependency in your project:

```bash
npm install --save-dev ts-explicit
```

## Usage

Run the tool with `npx`:

```bash
npx ts-explicit "<glob-pattern>" [--tsconfig=<path>] [--include-literal-types]
```

- `<glob-pattern>`: Glob pattern to match the TypeScript files you want to process.
- `--tsconfig=<path>`: (Optional) Path to a custom `tsconfig.json` file (defaults to `./tsconfig.json`).
- `--include-literal-types`: (Optional) Include literal types when adding annotations.

### Example

Assume you have the following file before running `ts-explicit`:

#### Before Transformation

```ts
// src/example.ts
function multiply(a: number, b) {
  return a * b;
}

const count = 42;
const result = multiply(count, 2);
```

When you run:

```bash
npx ts-explicit "src/**/*.ts"
```

It transforms the code to:

#### After Transformation

```ts
// src/example.ts
function multiply(a: number, b: any): number {
  return a * b;
}

const count = 42;
const result: number = multiply(count, 2);
```

This default transformation ensures that functions and variables have explicit type annotations.
