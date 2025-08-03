#!/usr/bin/env node

import { Project, Node } from "ts-morph";
import * as path from "node:path";
import * as fs from "node:fs";

// Get command line arguments (required: glob pattern)
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Error: glob pattern is required.");
  process.exit(1);
}

// Check for invalid arguments
const invalidArgs = args
  .slice(1)
  .filter(
    (arg) =>
      !arg.startsWith("--tsconfig=") &&
      !arg.startsWith("--include-literal-types") &&
      !arg.startsWith("--ignore-any-type")
  );
if (invalidArgs.length > 0) {
  console.error("Error: Invalid arguments:", invalidArgs.join(", "));
  console.error(
    "Usage: ts-explicit <glob-pattern> [--tsconfig=<path>] [--include-literal-types]"
  );
  process.exit(1);
}

const globPattern = args[0];

// tsconfig path can be specified with --tsconfig=<path> option, defaults to tsconfig.json in current directory
let tsConfigPath = path.join(process.cwd(), "tsconfig.json");
let isExplicitTsConfig = false;
let includeLiteralTypes = false;
let ignoreAnyType = false;

args.slice(1).forEach((arg) => {
  if (arg.startsWith("--tsconfig=")) {
    tsConfigPath = path.resolve(process.cwd(), arg.replace("--tsconfig=", ""));
    isExplicitTsConfig = true;
  } else if (arg === "--include-literal-types") {
    includeLiteralTypes = true;
  } else if (arg === "--ignore-any-type") {
    ignoreAnyType = true;
  }
});

// Error if explicitly specified tsconfig does not exist
if (isExplicitTsConfig && !fs.existsSync(tsConfigPath)) {
  console.error(`Error: Specified tsconfig file not found: ${tsConfigPath}`);
  process.exit(1);
}

const projectOptions: {
  tsConfigFilePath?: string;
  skipAddingFilesFromTsConfig: boolean;
} = {
  skipAddingFilesFromTsConfig: true, // Ignore include settings in tsconfig
};

// Only set tsConfigFilePath if the file exists
if (fs.existsSync(tsConfigPath)) {
  projectOptions.tsConfigFilePath = tsConfigPath;
}

const project = new Project(projectOptions);

// Add files matching the glob pattern relative to current directory
project.addSourceFilesAtPaths(path.join(process.cwd(), globPattern));
const sourceFiles = project.getSourceFiles();

sourceFiles.forEach((sourceFile) => {
  let annotationCount = 0;
  const fileName = sourceFile.getFilePath();

  // --- Function-like nodes (function declarations, function expressions, arrow functions, methods) ---
  sourceFile.forEachDescendant((node) => {
    if (
      Node.isFunctionDeclaration(node) ||
      Node.isFunctionExpression(node) ||
      Node.isArrowFunction(node) ||
      Node.isMethodDeclaration(node)
    ) {
      // Add parameter type annotations
      node.getParameters().forEach((param) => {
        if (!param.getTypeNode()) {
          const inferredType = param.getType().getText(param);
          if (ignoreAnyType && inferredType === "any") return;
          param.setType(inferredType);
          annotationCount++;
        }
      });
      // Add return type annotations
      if (!node.getReturnTypeNode()) {
        const inferredReturnType = node.getReturnType().getText(node);
        if (ignoreAnyType && inferredReturnType === "any") return;
        node.setReturnType(inferredReturnType);
        annotationCount++;
      }
    }
  });

  // --- Variable declarations ---
  sourceFile.getVariableDeclarations().forEach((varDecl) => {
    if (!varDecl.getTypeNode() && varDecl.getInitializer()) {
      const type = varDecl.getType();
      // Skip literal types unless --include-literal-types is specified
      if (
        !includeLiteralTypes &&
        (type.isLiteral() ||
          type.isStringLiteral() ||
          type.isNumberLiteral() ||
          type.isBooleanLiteral())
      ) {
        return;
      }
      const inferredType = type.getText(varDecl);
      if (ignoreAnyType && inferredType === "any") return;
      varDecl.setType(inferredType);
      annotationCount++;
    }
  });

  // --- Class properties ---
  sourceFile.getClasses().forEach((cls) => {
    // Add type annotations to constructor parameters
    const constructor = cls.getConstructors()[0];
    if (constructor) {
      constructor.getParameters().forEach((param) => {
        if (!param.getTypeNode()) {
          const inferredType = param.getType().getText(param);
          if (ignoreAnyType && inferredType === "any") return;
          param.setType(inferredType);
          annotationCount++;
        }
      });
    }

    cls.getProperties().forEach((prop) => {
      if (!prop.getTypeNode() && prop.getInitializer()) {
        const inferredType = prop.getType().getText(prop);
        if (ignoreAnyType && inferredType === "any") return;
        prop.setType(inferredType);
        annotationCount++;
      }
    });

    // Add return type annotations to get accessors
    cls.getGetAccessors().forEach((decl) => {
      if (!decl.getReturnTypeNode()) {
        const inferredReturnType = decl.getReturnType().getText(decl);
        if (ignoreAnyType && inferredReturnType === "any") return;
        decl.setReturnType(inferredReturnType);
        annotationCount++;
      }
    });
  });

  if (annotationCount > 0) {
    console.log(`[${fileName}] Added ${annotationCount} type annotations`);
  }

  sourceFile.saveSync();
});

console.log("All source files update completed.");
