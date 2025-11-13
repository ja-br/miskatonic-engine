# WGSL Parser Migration Guide

**Epic 3.14 Phase 3 - Task 6: Integration & Migration**

## ⚠️ EXPERIMENTAL FEATURE - NOT PRODUCTION READY

The AST-based parser (`ShaderReflector`) is currently **EXPERIMENTAL** and has known limitations. This guide documents the migration strategy from the regex-based parser to the AST-based parser.

---

## Known Limitations

### Current Limitations (Blocking for Production)

1. **Vertex attributes NOT extracted**
   - Returns: Empty array `[]`
   - Impact: Vertex layouts must be manually specified
   - Status: TODO Epic 3.14 Phase 4

2. **Workgroup size NOT extracted**
   - Returns: `undefined`
   - Impact: Compute shaders must manually specify workgroup size
   - Status: TODO Epic 3.14 Phase 4

3. **Storage textures NOT supported**
   - Throws error when encountered
   - Reason: Legacy API cannot represent storage texture format/access
   - Workaround: Use `ShaderReflector` directly or disable AST parser

4. **Data loss in conversion**
   - Lost: `textureSampleType` (float/sint/uint)
   - Lost: `samplerType` (filtering/comparison)
   - Lost: `isRuntimeSizedArray` flag
   - Reason: Legacy `BindGroupLayoutDescriptor` API is less detailed than `BindingInfo`

---

## When to Use AST Parser

### ✅ Good Use Cases
- Testing and validation only
- Shaders **without** storage textures
- Shaders that **don't** rely on vertex attribute extraction
- Non-compute shaders (or compute shaders with explicit workgroup size)
- Development/debugging to verify parser correctness

### ❌ Don't Use For
- **Production environments** (not ready yet)
- Shaders **with** storage textures
- Compute shaders **requiring** workgroup size extraction
- Shaders **requiring** vertex attribute extraction
- Performance-critical parsing (AST parser is ~1.5-2x slower)

---

## Enabling AST Parser

### Method 1: Runtime Toggle (Recommended)

```typescript
import { WGSLReflectionParser } from '@miskatonic/rendering';

// Enable AST parser (experimental)
WGSLReflectionParser.setUseASTParser(true);

// Check current state
console.log('Using AST parser?', WGSLReflectionParser.isUsingASTParser());

// Disable and return to regex parser
WGSLReflectionParser.setUseASTParser(false);
```

### Method 2: Environment Variable (Build-time)

```bash
# Enable during build
NODE_ENV=development npm run dev

# The parser automatically enables validation in development mode
```

---

## Validation Mode

In development mode, both parsers run side-by-side and results are compared:

```typescript
// Automatic in development
if (process.env.NODE_ENV === 'development') {
  // Both parsers run
  // Results are compared
  // Discrepancies logged to console
}
```

**Output:**
- ✅ `Parser validation passed - regex and AST results match`
- ❌ `Parser validation failed: [errors]` (with detailed JSON diff)

---

## Migration Phases

### Phase 1: Testing (Current - Week 3)
**Status:** In progress
**Duration:** 1 week

- Both parsers run in parallel when validation enabled
- Results compared and mismatches logged
- No breaking changes to public API
- Performance benchmarked

**Actions:**
```bash
# Enable validation
NODE_ENV=development npm run dev

# Run test suite
npm test --workspace=@miskatonic/rendering
```

### Phase 2: Opt-in AST Parser (Week 4)
**Status:** Not started
**Goal:** Make AST parser available for opt-in testing

- AST parser available via `setUseASTParser(true)`
- Default remains regex parser
- Users can explicitly test AST parser
- Feedback collected

**Actions:**
```typescript
// Opt in to experimental AST parser
WGSLReflectionParser.setUseASTParser(true);
```

### Phase 3: Default to AST Parser (Week 5)
**Status:** Not started
**Blockers:** Implement attribute extraction, workgroup size extraction

- AST parser becomes default
- Regex parser still available as fallback
- Monitor for issues in production

**Actions:**
```bash
# Use legacy regex parser if issues found
WGSLReflectionParser.setUseASTParser(false);
```

### Phase 4: Remove Legacy Parser (Week 6+)
**Status:** Not started
**Prerequisites:**
- Attribute extraction implemented
- Workgroup size extraction implemented
- Storage texture support (new high-level API)
- 1 week stable in production

- Remove regex parser implementation
- Remove feature flag
- Remove conversion bridge
- Update documentation

---

## API Compatibility

### Public API (Unchanged)

```typescript
export class WGSLReflectionParser {
  parse(source: string): ShaderReflectionData
  validate(reflection: ShaderReflectionData): void
}
```

**Input:** WGSL shader source string
**Output:** `ShaderReflectionData` (same format as before)

### Internal Changes

Internally, the AST parser returns `ShaderReflectionResult` which is automatically converted to `ShaderReflectionData` by the bridge layer.

---

## Performance Targets

### Current Baseline (Regex Parser)
- Typical shader: ~3-5ms median
- Complex shader: ~10-15ms median
- 95th percentile: <20ms

### AST Parser Target
- Must stay within **2x** of regex parser
- Typical shader: <10ms median
- Complex shader: <30ms median
- 95th percentile: <40ms

### Current Performance (Measured)
- AST parser: ~1.5-2x slower than regex
- Within acceptable range for experimental feature
- Optimization planned for Phase 4

---

## Error Handling

### Storage Texture Error

```typescript
// Shader with storage texture
const shader = `
  @group(0) @binding(0) var outputTexture: texture_storage_2d<rgba8unorm, write>;
`;

// Throws error with actionable message
try {
  parser.parse(shader);
} catch (error) {
  // Error: Storage textures are not supported by legacy WGSLReflectionParser API.
  // Binding: outputTexture, Format: rgba8unorm, Access: write-only.
  // Solution: Either (1) use ShaderReflector directly for full API,
  // (2) disable AST parser with WGSLReflectionParser.setUseASTParser(false),
  // or (3) wait for new high-level API in Epic 3.14 Phase 4.
}
```

### Fallback Behavior

If AST parser throws an unexpected error, the system automatically falls back to regex parser:

```typescript
// AST parser fails
console.error('AST parser failed, falling back to regex:', error);

// Regex parser succeeds
return regexResult; // No crash, graceful degradation
```

---

## Validation Tests

### Running Migration Validation

```bash
# Run full migration test suite
npm test -- ParserMigration.test.ts

# Run with verbose output
npm test -- ParserMigration.test.ts --reporter=verbose
```

### Test Coverage

The migration test suite validates:
1. **Bind group layout equivalence** (50+ shaders)
2. **Entry point extraction** (vertex/fragment/compute)
3. **Performance benchmarks** (must be <2x regression)
4. **Edge case handling** (comments, multiline, nested structs)
5. **Negative tests** (AST fails, regex succeeds)
6. **Storage texture errors** (throws with helpful message)

---

## Rollback Plan

If critical issues are discovered:

### Step 1: Disable AST Parser
```typescript
WGSLReflectionParser.setUseASTParser(false);
```

### Step 2: Report Issue
File bug report with:
- Shader source that failed
- Error logs from console
- Parser validation output
- Expected vs actual behavior

### Step 3: Verify Fallback
```bash
# Verify regex parser still works
npm test --workspace=@miskatonic/rendering
```

Existing regex parser continues working - **zero downtime**.

---

## Success Criteria

Before Phase 3 (default to AST):

- [ ] All 50+ test corpus shaders parse correctly
- [ ] Performance within 2x of regex parser
- [ ] Zero breaking changes to public API (except storage textures)
- [ ] All existing tests pass with AST parser
- [ ] Attribute extraction implemented
- [ ] Workgroup size extraction implemented
- [ ] 1 week stable in development with no regressions

Before Phase 4 (remove regex):

- [ ] 1 week stable in production with AST parser as default
- [ ] New high-level API supports storage textures
- [ ] All consumers migrated to new API
- [ ] Performance optimizations complete (<1.5x regression)
- [ ] Comprehensive documentation
- [ ] Migration guide for external users

---

## Known Issues

### Issue #1: Vertex Attributes Not Extracted
**Severity:** High
**Impact:** Vertex layouts must be manually specified
**Workaround:** Use regex parser for shaders with vertex inputs
**Fix:** Epic 3.14 Phase 4 (2-4 hours)

### Issue #2: Workgroup Size Not Extracted
**Severity:** Medium
**Impact:** Compute shaders must manually specify workgroup size
**Workaround:** Use regex parser for compute shaders
**Fix:** Epic 3.14 Phase 4 (1-2 hours)

### Issue #3: Storage Textures Not Supported
**Severity:** High (blocking for some use cases)
**Impact:** Shaders with storage textures throw error
**Workaround:** (1) Use `ShaderReflector` directly, (2) Disable AST parser
**Fix:** New high-level API in Epic 3.14 Phase 4 (8-12 hours)

### Issue #4: Data Loss in Legacy API
**Severity:** Medium
**Impact:** Detailed binding info (sample types, formats) is discarded
**Workaround:** Use `ShaderReflector` directly for full details
**Fix:** New high-level API in Epic 3.14 Phase 4

---

## FAQ

### Q: Why is the AST parser experimental?
**A:** It's missing critical features (attribute extraction, workgroup size) and doesn't support storage textures due to legacy API limitations.

### Q: When will it be production-ready?
**A:** After Phase 4 tasks complete (attribute extraction, workgroup size, new high-level API). Estimated 2-3 weeks.

### Q: Will my existing code break?
**A:** No, the AST parser is opt-in via feature flag. Default behavior (regex parser) is unchanged.

### Q: Why use the AST parser if it's slower?
**A:** AST parser is more correct (handles edge cases), more maintainable (no regex), and enables future features (optimizations, error recovery, IDE integration).

### Q: Can I use both parsers?
**A:** Yes, in development mode both run and results are validated. In production, only the enabled parser runs.

### Q: What about storage textures?
**A:** Use `ShaderReflector` directly for full API, or wait for new high-level API in Phase 4.

---

## Contact

**Questions or issues?**
File bug report in `planning/issues/` with:
- Shader source
- Error logs
- Expected behavior
- Actual behavior

**Epic tracking:**
See `planning/epics/EPIC_RENDERING_03_PARSER_PIPELINE.md` for detailed progress.
