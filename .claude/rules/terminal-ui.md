# Terminal UI Rules (MANDATORY)

## ALWAYS Verify Before Reporting

**Before telling the user a change is complete, you MUST:**

1. Run `bun run typecheck` - verify no TypeScript errors
2. Run `bun run test` - verify tests pass
3. Run the actual command if applicable - verify it works

**NEVER report "done" or "compiles" without actually running verification.**

## Use Ink for All Terminal UI Work

**NEVER use custom readline hacks or raw terminal manipulation for CLI UI.**

When building any interactive terminal interface, you MUST use the [Ink](https://github.com/vadimdemedes/ink) library (React for CLI).

### What Counts as Terminal UI

- Interactive prompts and selections
- Progress indicators and spinners
- Formatted output with colors and boxes
- User input with validation
- Multi-step wizards
- Any UI that needs to update dynamically

### Required Pattern

```typescript
// ✅ CORRECT: Use Ink components
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import Spinner from "ink-spinner";

const MyComponent = () => (
  <Box flexDirection="column">
    <Text color="cyan">Interactive prompt</Text>
    <TextInput value={input} onChange={setInput} />
  </Box>
);
```

### Forbidden Patterns

```typescript
// ❌ FORBIDDEN: Raw readline
import * as readline from "node:readline";
const rl = readline.createInterface({ input, output });

// ❌ FORBIDDEN: Console manipulation
process.stdout.write("\x1B[2J"); // clear screen
console.clear();

// ❌ FORBIDDEN: ANSI escape codes
console.log("\x1b[36m%s\x1b[0m", "colored text");
```

### Available Ink Packages

Already installed in this project:
- `ink` - Core React-like components
- `ink-spinner` - Loading spinners
- `ink-text-input` - Text input field

Add as needed:
- `ink-select-input` - Selection lists
- `ink-table` - Formatted tables
- `ink-progress-bar` - Progress bars
- `ink-gradient` - Gradient text

### Component Location

All Ink components go in:
```
src/cli/components/
├── ContactSelector.tsx
├── ProgressDisplay.tsx
└── index.ts
```

### Integration with Effect-TS

Wrap Ink rendering in Effect:

```typescript
import { render } from "ink";
import { Effect } from "effect";

const runInkUI = <T>(Component: React.FC<{ onComplete: (result: T) => void }>) =>
  Effect.async<T>((resume) => {
    const { unmount } = render(
      <Component onComplete={(result) => {
        unmount();
        resume(Effect.succeed(result));
      }} />
    );
  });
```

## Why This Rule Exists

1. **Consistency**: All CLI UIs look and behave the same
2. **Maintainability**: React component model is well-understood
3. **Testing**: Ink components can be tested with ink-testing-library
4. **Cross-platform**: Ink handles terminal differences
5. **No hacks**: Readline/ANSI escape code spaghetti is forbidden
