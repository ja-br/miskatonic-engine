# EPIC: WGSL Parser & Pipeline State Management

**Epic ID:** RENDERING-03
**Status:** READY
**Priority:** HIGH
**Estimated Effort:** 40-48 hours
**Target Completion:** Week 3-4
**Depends On:** RENDERING-01 (✅ Complete), RENDERING-02 (✅ Complete)
**Blocks:** RENDERING-04 (Error Recovery), RENDERING-05 (Performance)

## Executive Summary

Replace the existing regex-based WGSL parser in `WGSLReflectionParser` with a robust tokenizer/AST-based parser that handles all WGSL syntax correctly. Enhance pipeline state management with validated presets that prevent common configuration errors.

## Current State Analysis

### What Exists
- `WGSLReflectionParser` uses regex with security limits (1MB max size)
- Basic regex handles simple bind groups/attributes
- `PipelineStateDescriptor` has OPAQUE and ALPHA_BLEND presets
- `ShaderLoader` handles GLSL-style includes (not WGSL)
- Material system uses pipeline states directly

### Problems with Current Implementation

1. **Fragile Regex Parsing**
   ```typescript
   // Current: Breaks on valid WGSL
   /@group\((\d+)\)\s+@binding\((\d+)\)/g

   // Fails on:
   @group(0) // comment
   @binding(0) var<uniform> data: Data;

   @group(0) @binding(1)
   var<storage, read_write> buffer: array<f32>;
   ```

2. **Limited Pipeline Presets**
   - Only 2 presets (opaque, alpha)
   - No validation for invalid combinations
   - Missing common modes (additive, cutout, wireframe)

3. **No WebGPU Validation**
   - Errors only caught at runtime
   - Poor error messages
   - No line/column information

## Success Criteria

- ✅ All valid WGSL 1.0 syntax parsed correctly
- ✅ WebGPU compilation validation integrated
- ✅ 5+ pipeline state presets with validation
- ✅ Error messages with line/column info
- ✅ >85% test coverage on parser code
- ✅ Performance within 2x of regex parser
- ✅ Zero breaking changes to public API

## Implementation Tasks

### Task 0: Performance Baseline (2 hours)
**Priority:** MUST DO FIRST
**Deliverable:** Performance benchmark of current regex parser

```typescript
// packages/rendering/tests/benchmarks/ParserBenchmark.test.ts
describe('Parser Performance Baseline', () => {
  const testShaders = loadTestCorpus(); // 50+ real shaders

  it('measures regex parser performance', () => {
    for (const shader of testShaders) {
      const start = performance.now();
      parser.parse(shader);
      const time = performance.now() - start;

      expect(time).toBeLessThan(5); // Current: <5ms
      recordBaseline(shader.name, time);
    }
  });
});
```

**Acceptance Criteria:**
- [ ] 50+ real shader samples collected
- [ ] Baseline timings recorded
- [ ] Memory usage measured
- [ ] Results saved to `benchmarks/baseline.json`

---

### Task 1: Pipeline State Presets (4 hours)
**Priority:** HIGH (Independent, can start immediately)
**Deliverable:** Enhanced pipeline presets with validation

```typescript
// packages/rendering/src/pipeline/PipelinePresets.ts
export class PipelinePresets {
  static readonly OPAQUE = { /* existing */ };
  static readonly TRANSPARENT = { /* existing as ALPHA_BLEND */ };

  // NEW presets
  static readonly ADDITIVE = {
    blend: {
      enabled: true,
      srcFactor: 'one',
      dstFactor: 'one'
    },
    depthStencil: {
      depthWriteEnabled: false, // Critical for additive
      depthCompare: 'less'
    }
  };

  static readonly ALPHA_CUTOUT = {
    multisample: {
      alphaToCoverageEnabled: true // Smooth cutout edges
    }
  };

  static readonly WIREFRAME = {
    topology: 'line-list', // Changed from triangle-list
    rasterization: { cullMode: 'none' }
  };

  // Validation to prevent mistakes
  static validate(state: PipelineStateDescriptor): string[] {
    const errors: string[] = [];

    if (state.blend?.enabled && state.depthStencil?.depthWriteEnabled) {
      errors.push('Transparent objects should disable depth writes');
    }

    if (state.topology === 'line-list' && state.blend?.enabled) {
      errors.push('Wireframe rendering should not use blending');
    }

    return errors;
  }
}
```

**Acceptance Criteria:**
- [ ] 5 presets defined (opaque, transparent, additive, cutout, wireframe)
- [ ] Validation catches common errors
- [ ] Integration with existing Material system works
- [ ] Unit tests for each preset
- [ ] JSDoc documentation complete

---

### Task 2: Test Corpus & Infrastructure (4 hours)
**Deliverable:** WGSL test shaders and benchmark harness

```typescript
// packages/rendering/tests/fixtures/wgsl-corpus/
// - simple/     (20 basic shaders)
// - complex/    (20 real-world shaders)
// - edge-cases/ (20 syntax edge cases)
// - invalid/    (20 error cases)

// packages/rendering/tests/helpers/ParserTestUtils.ts
export class ParserTestUtils {
  static loadCorpus(): TestShader[];
  static compareAST(a: AST, b: AST): boolean;
  static measurePerformance(parser: Parser): Metrics;
  static generateFuzzCases(seed: number): string[];
}
```

**Acceptance Criteria:**
- [ ] 80+ test shaders organized by category
- [ ] Test utilities for AST comparison
- [ ] Performance measurement helpers
- [ ] Fuzz test case generator
- [ ] Covers all WGSL features used in project

---

### Task 3: WGSL Tokenizer (12 hours)
**Deliverable:** Complete WGSL tokenizer with all token types

```typescript
// packages/rendering/src/shaders/tokenizer/WGSLTokenizer.ts
export class WGSLTokenizer {
  tokenize(source: string): Token[];

  // Handles:
  // - All WGSL keywords (40+)
  // - All operators and punctuation
  // - Numbers (hex, float, scientific)
  // - Comments (line, block, nested)
  // - Unicode identifiers
  // - Preprocessor directives

  // Performance optimizations:
  // - Character lookup tables
  // - Streaming tokenization
  // - Token pooling
}

// packages/rendering/tests/tokenizer/WGSLTokenizer.test.ts
// 200+ test cases covering all token types
```

**Acceptance Criteria:**
- [ ] All WGSL 1.0 tokens recognized
- [ ] Line/column tracking accurate
- [ ] Handles Unicode correctly
- [ ] Performance <1ms for 10KB shader
- [ ] 100% branch coverage in tests
- [ ] Memory efficient (no regex backtracking)

---

### Task 4: WGSL Parser (16 hours)
**Deliverable:** AST-based parser with error recovery

```typescript
// packages/rendering/src/shaders/parser/WGSLParser.ts
export class WGSLParser {
  private tokens: Token[];
  private ast: AST;
  private errors: ParseError[];

  parse(source: string): ParseResult {
    const tokens = tokenizer.tokenize(source);
    this.parseModule();

    return {
      ast: this.ast,
      errors: this.errors,
      reflection: this.extractReflection()
    };
  }

  // Recursive descent parsing
  private parseModule(): ModuleNode;
  private parseGlobalDecl(): GlobalNode;
  private parseFunction(): FunctionNode;
  private parseStatement(): StatementNode;
  private parseExpression(): ExpressionNode;

  // Error recovery
  private synchronize(): void; // Skip to next sync point
  private recover(): void;      // Try alternative parse
}

// packages/rendering/src/shaders/parser/AST.ts
// Complete AST node definitions for WGSL
```

**Acceptance Criteria:**
- [ ] Parses all test corpus shaders
- [ ] Generates correct AST
- [ ] Error recovery continues parsing
- [ ] Helpful error messages
- [ ] <10ms for complex shaders
- [ ] Handles 100KB+ shaders

---

### Task 5: WebGPU Validation Integration (6 hours)
**Deliverable:** Optional GPU compilation validation

```typescript
// packages/rendering/src/shaders/validator/WebGPUValidator.ts
export class WebGPUValidator {
  constructor(private device?: GPUDevice) {}

  async validate(source: string): Promise<ValidationResult> {
    if (!this.device) {
      return { valid: true, warnings: ['No GPU device for validation'] };
    }

    const module = this.device.createShaderModule({ code: source });
    const info = await module.getCompilationInfo();

    return {
      valid: !info.messages.some(m => m.type === 'error'),
      errors: this.formatErrors(info.messages),
      warnings: this.formatWarnings(info.messages)
    };
  }
}

// Integration with parser
export class WGSLParser {
  async parseWithValidation(
    source: string,
    device?: GPUDevice
  ): Promise<ParseResult> {
    const result = this.parse(source);

    if (device && result.errors.length === 0) {
      const validation = await validator.validate(source);
      result.errors.push(...validation.errors);
    }

    return result;
  }
}
```

**Acceptance Criteria:**
- [ ] GPU validation optional (works without device)
- [ ] Validation errors merged with parse errors
- [ ] Clear error formatting
- [ ] Performance impact <10ms
- [ ] Graceful fallback without GPU

---

### Task 6: Migration & Integration (8 hours)
**Deliverable:** Replace regex parser, update all code

```typescript
// packages/rendering/src/ShaderReflection.ts
export class WGSLReflectionParser {
  private legacyParser = new RegexParser(); // Temporary
  private newParser = new WGSLParser();

  parse(source: string): ShaderReflectionData {
    // Feature flag for gradual rollout
    if (process.env.USE_NEW_PARSER === 'true') {
      const result = this.newParser.parse(source);
      return this.extractReflection(result.ast);
    }

    return this.legacyParser.parse(source);
  }
}
```

**Migration Steps:**
1. Add feature flag (default: false)
2. Run both parsers in tests, compare results
3. Fix any discrepancies
4. Enable by default in dev
5. Remove legacy parser after 1 week stable

**Acceptance Criteria:**
- [ ] Feature flag for rollout
- [ ] All existing tests pass
- [ ] No breaking API changes
- [ ] Performance regression <2x
- [ ] Migration guide written
- [ ] Legacy parser removed (final step)

---

## Risk Mitigation

### High Risk: Parser Complexity
**Mitigation:**
- Start with subset of WGSL (only what we use)
- Incremental implementation with tests
- Consider using existing WGSL parser library if available

### Medium Risk: Performance Regression
**Mitigation:**
- Measure baseline first (Task 0)
- Profile and optimize hot paths
- Cache parsed results aggressively
- Accept 2x slowdown for correctness

### Low Risk: WebGPU Device Availability
**Mitigation:**
- Validation is optional enhancement
- Parser works without GPU device
- Mock device for testing

## Testing Strategy

### Unit Tests
- Tokenizer: 200+ cases covering all tokens
- Parser: 100+ cases covering all grammar rules
- Presets: 20+ cases for validation logic
- Integration: 50+ real shaders

### Performance Tests
```typescript
describe('Parser Performance', () => {
  it('stays within 2x of baseline', () => {
    const baseline = loadBaseline();
    const current = measureCurrent();

    expect(current.p95).toBeLessThan(baseline.p95 * 2);
    expect(current.memory).toBeLessThan(baseline.memory * 1.5);
  });
});
```

### Coverage Requirements
- Parser code: >85% line coverage
- Tokenizer: 100% branch coverage
- Critical paths: 100% coverage

## Definition of Done

- [ ] All 7 tasks completed and tested
- [ ] Test coverage >85% overall
- [ ] Performance within 2x of regex parser
- [ ] All test corpus shaders parse correctly
- [ ] WebGPU validation working when device available
- [ ] No breaking changes to public API
- [ ] Migration complete, legacy parser removed
- [ ] Documentation updated
- [ ] Code review approved
- [ ] Benchmarks show acceptable performance

## Follow-up Epics

- **RENDERING-04**: Advanced error recovery and diagnostics
- **RENDERING-05**: Performance optimization (target: match regex speed)
- **RENDERING-06**: WGSL language server for IDE support

---

*Epic refined: November 2024*
*Ready for implementation*
*Breaking changes: NONE (backward compatible)*