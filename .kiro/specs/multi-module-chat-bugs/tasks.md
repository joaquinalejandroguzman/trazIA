# Implementation Plan

## Overview

Fix 3 bugs in the multi-module chat feature: (1) `analyzingModules` dead code due to React batching in `use_chat.ts`, (2) unnecessary `sourceContent` in general repo questions, and (3) hardcoded "1/N" counter in loading indicator. Uses exploratory bug condition methodology: write tests first to confirm bugs, then implement fixes, then verify.

## Tasks

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - includeSnippets:false Still Includes sourceContent
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate Bug 2 exists (sourceContent leaking into general questions)
  - **Scoped PBT Approach**: Generate random ModuleNode arrays where all modules have sourceContent, invoke `buildRepoContext(modules, { focusModules: modules, includeSnippets: false })`, and assert the output NEVER contains any module's sourceContent
  - Since `includeSnippets` option does not yet exist in `BuildRepoContextOptions`, the test will demonstrate that passing `includeSnippets: false` has no effect — sourceContent still appears in the output
  - Use fast-check to generate arrays of ModuleNode with unique `sourceContent` prefixed markers (e.g., `__SOURCE__<random>__`)
  - Assert: for all modules in the array, `result` does NOT contain `mod.sourceContent`
  - Assert: for all modules, `result` DOES contain metadata (mod.name, mod.path, mod.specStatus)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (sourceContent appears in output because `includeSnippets` is not implemented yet — this confirms Bug 2 exists)
  - Document counterexamples found (e.g., "buildRepoContext with includeSnippets:false still includes `--- Código fuente ---` sections")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.2_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - focusModules with includeSnippets=true/undefined Maintains Snippets
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: `buildRepoContext(modules, { focusModules })` on unfixed code includes sourceContent of focus modules truncated to 500/300 chars
  - Observe: `buildRepoContext(modules)` (no focusModules) excludes all sourceContent
  - Observe: `buildRepoContext(modules, { focusModule: singleMod })` (deprecated API) still includes sourceContent of that module
  - Write property-based tests with fast-check:
    - **Preservation A**: For all ModuleNode[] with sourceContent and focusModules specified (no `includeSnippets` param), output includes sourceContent truncated to snippetLimit (500 for <5 modules, 300 for >=5) — same as current behavior
    - **Preservation B**: For all ModuleNode[] without focusModules, output excludes all sourceContent — same as current behavior
    - **Preservation C**: For all single ModuleNode with deprecated `focusModule` param, output includes its sourceContent — backward compat
    - **Preservation D**: For all messages with keyword + mentioned module, `isGeneralRepoQuestion` returns false
    - **Preservation E**: For all arrays of ModuleNode, `detectMentionedModules` produces no duplicates
  - Verify tests pass on UNFIXED code (current implementation satisfies these preservation properties)
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 3. Fix for multi-module chat bugs (3 bugs across 4 files)

  - [x] 3.1 Fix analyzingModules state lifecycle in use_chat.ts
    - Add `setAnalyzingModules(null)` at the START of `sendMessage` (before the fetch, after setIsLoading) to clear state from previous message
    - Remove the `setAnalyzingModules(null)` line AFTER adding the assistant message (the one at line ~60 that causes React batching) — this is the root cause of Bug 1
    - Keep `setAnalyzingModules(null)` in the `catch` block for error cleanup
    - Result: `analyzingModules` is set when response arrives and persists during `isLoading === true` until next `sendMessage`
    - _Bug_Condition: isBugCondition(bug=1) — responseHasModules AND both setState calls batched in same async handler_
    - _Expected_Behavior: analyzingModules visible during entire loading period, cleared only at start of next sendMessage_
    - _Preservation: clearChat() still resets to null; no modules → still shows "Pensando..."_
    - _Requirements: 2.1, 3.1, 3.3_

  - [x] 3.2 Add includeSnippets option to BuildRepoContextOptions in context_builder.ts
    - Add `includeSnippets?: boolean` field to `BuildRepoContextOptions` interface
    - In `buildRepoContext`, condition the sourceContent inclusion block: change `if (focusIds.has(mod.id) && mod.sourceContent)` to `if (focusIds.has(mod.id) && mod.sourceContent && options?.includeSnippets !== false)`
    - When `includeSnippets` is `undefined` or `true`, behavior is unchanged (backward compat)
    - When `includeSnippets` is `false`, skip `--- Código fuente ---` section even for focusModules
    - _Bug_Condition: isBugCondition(bug=2) — isGeneralRepoQuestion AND focusModules=allModules AND sourceContent included_
    - _Expected_Behavior: buildRepoContext with includeSnippets:false never includes sourceContent_
    - _Preservation: includeSnippets:true/undefined produces identical output to original implementation_
    - _Requirements: 2.2, 3.4, 3.5_

  - [x] 3.3 Pass includeSnippets: false for general questions in chat.ts
    - In the `if (isGeneral)` branch, change `buildRepoContext(modules, { readme, focusModules })` to `buildRepoContext(modules, { readme, focusModules, includeSnippets: false })`
    - Non-general questions (mentionedModules path) continue without `includeSnippets` → defaults to true (snippets included)
    - _Bug_Condition: isBugCondition(bug=2) — general question sends all sourceContent to LLM_
    - _Expected_Behavior: general questions only send metadata, not code snippets_
    - _Preservation: module-specific questions still include snippets as before_
    - _Requirements: 2.2, 3.2_

  - [x] 3.4 Fix counter text in chat_panel.tsx
    - Replace `` `Analizando (1/${analyzingModules.length})...` `` with `` `Analizando ${analyzingModules.length} módulo${analyzingModules.length > 1 ? 's' : ''}...` ``
    - Handles singular ("Analizando 1 módulo...") and plural ("Analizando 3 módulos...") correctly
    - _Bug_Condition: isBugCondition(bug=3) — analyzingModules.length > 0 AND displayText contains "1/"_
    - _Expected_Behavior: text shows "Analizando N módulo(s)..." without fake progress counter_
    - _Preservation: "Pensando..." still shown when analyzingModules is null or empty array_
    - _Requirements: 2.3, 3.1, 3.6_

  - [x] 3.5 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - includeSnippets:false Excludes All sourceContent
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior (no sourceContent when includeSnippets:false)
    - When this test passes, it confirms Bug 2 is fixed and expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.2_

  - [x] 3.6 Verify preservation tests still pass
    - **Property 2: Preservation** - focusModules with includeSnippets=true/undefined Maintains Snippets
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions — includeSnippets:true/undefined still works as before)
    - Confirm all preservation tests still pass after fix (no regressions)

- [x] 4. Update existing property tests to use non-deprecated API
  - Update Property 13 test in `context_builder.property.test.ts`: change `detectMentionedModule` (singular) → `detectMentionedModules` (plural) and adapt assertions for array return
  - Update Property 15 test: change `focusModule` (deprecated singular) → `focusModules` array in `buildRepoContext` calls
  - Ensure all existing property tests (Properties 6, 7, 8, 13, 15) still pass with the changes
  - _Requirements: 3.4, 3.5_

- [x] 5. Write unit tests for new and updated functions
  - **detectMentionedModules** (context_builder.test.ts):
    - Multi-match: message mentions 2+ modules → returns all in order of input array
    - Deduplication: same module matches by name and path → appears only once
    - Empty cases: empty message → [], empty modules → []
  - **isGeneralRepoQuestion** (context_builder.test.ts):
    - Keyword + module mentioned → false
    - Only keyword, no module → true
    - No keyword, no module → false
    - Empty/whitespace message → false
  - **buildRepoContext with includeSnippets: false** (context_builder.test.ts):
    - focusModules with includeSnippets:false → no sourceContent in output, metadata present
    - focusModules with includeSnippets:true → sourceContent truncated (same as no param)
  - **buildRepoContext with focusModules array** (context_builder.test.ts):
    - 3 focus modules → snippets truncated to 500 chars each
    - 5+ focus modules → snippets truncated to 300 chars each
  - _Requirements: 2.2, 3.2, 3.4, 3.5_

- [x] 6. Checkpoint - Ensure all tests pass
  - Run full test suite: `npm test` in packages/backend
  - Verify all property-based tests pass (Properties 1, 2, 6, 7, 8, 13, 15)
  - Verify all unit tests pass (context_builder.test.ts, router.test.ts, chat.test.ts)
  - Verify no TypeScript compilation errors: `npx tsc --noEmit`
  - Ensure all tests pass, ask the user if questions arise.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2"] },
    { "id": 1, "tasks": ["3.1", "3.2", "3.4"] },
    { "id": 2, "tasks": ["3.3", "3.5", "3.6"] },
    { "id": 3, "tasks": ["4", "5"] },
    { "id": 4, "tasks": ["6"] }
  ]
}
```

## Notes

- Tasks 1 and 2 MUST be executed BEFORE any implementation (tasks 3.x) to establish baseline
- Bug 1 fix (task 3.1) is frontend-only (React state lifecycle in use_chat.ts)
- Bug 2 fix (tasks 3.2, 3.3) is backend-only and the primary target of property-based testing
- Bug 3 fix (task 3.4) is frontend-only (simple text change in chat_panel.tsx)
- Property tests use fast-check library (already installed as dev dependency)
- Existing property tests in `context_builder.property.test.ts` use deprecated singular API — task 4 migrates them
- The `includeSnippets` option defaults to `true` (undefined treated as true) for full backward compatibility
