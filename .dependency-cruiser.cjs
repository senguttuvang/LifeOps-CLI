/**
 * LifeOps CLI - Dependency Cruiser Configuration
 *
 * Enforces DDD/Clean Architecture layer boundaries:
 * - Domain layer is pure (no infrastructure dependencies)
 * - Application layer depends only on domain
 * - Infrastructure implements adapters
 * - CLI/Commands are entry points that wire everything together
 *
 * Architecture:
 * ┌─────────────────────────────────────────┐
 * │           CLI / Commands                │  ← Entry points
 * └────────────────┬────────────────────────┘
 *                  │
 * ┌────────────────▼────────────────────────┐
 * │         Infrastructure                  │  ← Adapters (DB, APIs)
 * └────────────────┬────────────────────────┘
 *                  │
 * ┌────────────────▼────────────────────────┐
 * │          Application                    │  ← Use cases
 * └────────────────┬────────────────────────┘
 *                  │
 * ┌────────────────▼────────────────────────┐
 * │            Domain                       │  ← Pure business logic
 * └─────────────────────────────────────────┘
 *
 * @type {import('dependency-cruiser').IConfiguration}
 */
module.exports = {
  forbidden: [
    // ============================================
    // Clean Architecture Layer Violations
    // ============================================

    {
      name: "domain-must-be-pure",
      comment:
        "Domain layer cannot depend on infrastructure, CLI, or external adapters. " +
        "Domain should contain only pure business logic with Effect-TS patterns. " +
        "Exception: domain/ports is the designated anti-corruption layer that re-exports infrastructure Tags.",
      severity: "error",
      from: {
        path: "^src/domain",
        pathNot: "^src/domain/ports", // Ports are allowed to import from infrastructure
      },
      to: {
        path: "^src/(infrastructure|cli|db|ai)",
        pathNot: [
          "^src/infrastructure/db/schema\\.ts$", // Schema types needed for Drizzle queries
          "^src/infrastructure/db/signal-schema\\.ts$", // Signal schema types
          "^src/infrastructure/whatsapp/whatsapp\\.types\\.ts$", // WhatsApp types (data structures only)
          "^src/infrastructure/adapters/whatsapp/whatsapp\\.adapter\\.ts$", // Adapter interface types
        ],
      },
    },

    {
      name: "domain-no-external-io",
      comment:
        "Domain layer should not import I/O libraries directly. " +
        "Use Effect-TS service patterns with dependency injection.",
      severity: "error",
      from: { path: "^src/domain" },
      to: {
        path: "node_modules/(better-sqlite3|@anthropic-ai|openai|@lancedb)",
      },
    },

    // ============================================
    // Bounded Context Isolation (DDD)
    // ============================================

    {
      name: "bounded-context-isolation",
      comment:
        "Domain modules should not directly import from other domain modules. " +
        "Use application layer services or domain events for cross-context communication. " +
        "Exception: domain/ports is the shared interface layer.",
      severity: "warn",
      from: { path: "^src/domain/([^/]+)" },
      to: {
        path: "^src/domain/([^/]+)",
        pathNot: [
          "^src/domain/$1", // Allow same subdomain
          "^src/domain/ports", // Allow importing from shared ports
        ],
      },
    },

    // ============================================
    // Circular Dependencies
    // ============================================

    {
      name: "no-circular",
      comment:
        "Circular dependencies indicate tightly coupled code. " +
        "Refactor using dependency inversion or extract shared code.",
      severity: "error",
      from: {},
      to: {
        circular: true,
      },
    },

    // ============================================
    // Effect-TS Patterns
    // ============================================

    {
      name: "services-use-effect-patterns",
      comment:
        "Services should use Effect-TS Context.Tag pattern, not direct instantiation.",
      severity: "info",
      from: { path: "^src/(domain|application)" },
      to: {
        // Flag direct imports of concrete implementations
        path: "^src/infrastructure/.*\\.impl\\.",
      },
    },

    // ============================================
    // Test Isolation
    // ============================================

    {
      name: "no-test-to-src-except-imports",
      comment: "Test files should only import from src, not have src depend on tests.",
      severity: "error",
      from: { pathNot: "^(test|spec)" },
      to: { path: "^(test|spec)" },
    },

    // ============================================
    // General Quality Rules
    // ============================================

    {
      name: "no-orphans",
      comment:
        "Files that are not imported anywhere may be dead code. " +
        "Either use them or remove them.",
      severity: "warn",
      from: {
        orphan: true,
        pathNot: [
          // Entry points and config files are expected orphans
          "(^|/)\\.[^/]+\\.(js|cjs|mjs|ts|json)$", // dotfiles
          "\\.d\\.ts$", // type definitions
          "(^|/)index\\.ts$", // barrel exports
          "^src/cli/main\\.ts$", // CLI entry point
          "^src/cli/commands/", // Command files (entry points)
          "vitest\\.config\\.", // test config
          "drizzle\\.config\\.", // drizzle config
          "eslint\\.config\\.", // eslint config
        ],
      },
      to: {},
    },

    {
      name: "no-deprecated-modules",
      comment: "Do not depend on deprecated modules.",
      severity: "warn",
      from: {},
      to: {
        dependencyTypes: ["deprecated"],
      },
    },

    {
      name: "no-non-package-json",
      comment:
        "Do not depend on modules not declared in package.json. " +
        "This can cause issues in production.",
      severity: "error",
      from: {},
      to: {
        dependencyTypes: ["npm-no-pkg", "npm-unknown"],
      },
    },
  ],

  options: {
    doNotFollow: {
      path: "node_modules",
    },

    // TypeScript configuration
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: "./tsconfig.json",
    },

    // Enhanced detection for Effect-TS
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
      mainFields: ["module", "main", "types"],
    },

    // Reporter options for visualization
    reporterOptions: {
      dot: {
        collapsePattern: "node_modules/(@[^/]+/[^/]+|[^/]+)",
        theme: {
          graph: {
            splines: "ortho",
            rankdir: "TB",
          },
          modules: [
            {
              criteria: { source: "^src/domain" },
              attributes: { fillcolor: "#ccffcc" },
            },
            {
              criteria: { source: "^src/application" },
              attributes: { fillcolor: "#ccccff" },
            },
            {
              criteria: { source: "^src/infrastructure" },
              attributes: { fillcolor: "#ffcccc" },
            },
            {
              criteria: { source: "^src/cli" },
              attributes: { fillcolor: "#ffffcc" },
            },
          ],
          dependencies: [
            {
              criteria: { resolved: "^src/domain" },
              attributes: { color: "#00aa00" },
            },
            {
              criteria: { valid: false },
              attributes: { color: "red", fontcolor: "red" },
            },
          ],
        },
      },
      archi: {
        collapsePattern:
          "^(node_modules|packages|src/(domain|application|infrastructure|cli|db|ai))/[^/]+",
        theme: {
          modules: [
            {
              criteria: { source: "^src/domain" },
              attributes: { fillcolor: "#ccffcc" },
            },
            {
              criteria: { source: "^src/application" },
              attributes: { fillcolor: "#ccccff" },
            },
            {
              criteria: { source: "^src/infrastructure" },
              attributes: { fillcolor: "#ffcccc" },
            },
            {
              criteria: { source: "^src/cli" },
              attributes: { fillcolor: "#ffffcc" },
            },
          ],
        },
      },
    },
  },
};
