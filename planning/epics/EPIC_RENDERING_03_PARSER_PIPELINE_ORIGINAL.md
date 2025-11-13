# EPIC: WGSL Parser & Pipeline Improvements

**Epic ID:** RENDERING-03
**Status:** Not Started
**Priority:** MEDIUM
**Estimated Effort:** 24 hours
**Target Completion:** Week 3
**Depends On:** RENDERING-01, RENDERING-02

## Objective

Replace fragile regex-based WGSL parsing with a robust tokenizer-based parser, and simplify pipeline state configuration with intuitive presets. Improve shader validation, error messages, and handle all valid WGSL syntax variations.

## Success Criteria

- [x] Tokenizer-based WGSL parser replaces regex parser
- [x] Handle all valid WGSL syntax variations (comments, whitespace, multi-line)
- [x] WebGPU validation integration for immediate error feedback
- [x] Comprehensive WGSL test suite (50+ test cases)
- [x] Pipeline state presets for common render modes
- [x] Improved error messages with line/column information
- [x] Test coverage >80% for parser code
- [x] No performance regression vs regex parser

## Current State

### Problems

#### 1. Regex-Based Parsing Anti-Pattern
```typescript
// Current implementation (fragile)
const bindGroupRegex = /@group\((\d+)\)\s+@binding\((\d+)\)\s+var(?:<([^>]+)>)?\s+(\w+)\s*:\s*([^;]+);/g;
```

**Issues:**
- Fails with whitespace variations
- Can't handle comments between annotations
- Breaks on multi-line declarations
- No support for complex type syntax
- Unclear error messages when parsing fails
- Security concerns (mitigated with 1MB limit)

**Example Failures:**
```wgsl
// FAILS: Comment between annotations
@group(0) // Scene data
@binding(0) var<uniform> scene: SceneData;

// FAILS: Multi-line declaration
@group(0) @binding(0)
var<uniform> scene: SceneData;

// FAILS: Complex type syntax
@group(1) @binding(0) var<storage, read_write> particles: array<Particle, 1000>;
```

#### 2. Pipeline State Confusion
- Verbose configuration (10+ lines for simple blending)
- No presets for common render modes
- Easy to misconfigure (e.g., depth write + transparency)
- No validation for common mistakes

### Impact
- Developer frustration with shader parsing errors
- Time wasted debugging regex failures
- Can't use valid WGSL syntax variations
- Verbose pipeline setup code

## Implementation Tasks

### Task 3.1: WGSL Tokenizer (8 hours)

**Deliverable:** `/packages/rendering/src/shaders/WGSLTokenizer.ts`

```typescript
export enum TokenType {
  // Keywords
  KEYWORD,        // var, fn, struct, let, const, etc.

  // Identifiers and types
  IDENTIFIER,     // Variable names
  TYPE,           // u32, f32, vec3, mat4, etc.

  // Annotations
  ANNOTATION,     // @group, @binding, @location, @builtin, etc.

  // Literals
  NUMBER,         // 123, 1.5, 0x1F
  BOOL,           // true, false

  // Operators
  OPERATOR,       // +, -, *, /, etc.
  COMPARISON,     // ==, !=, <, >, <=, >=
  LOGICAL,        // &&, ||, !
  ASSIGNMENT,     // =, +=, -=, etc.

  // Punctuation
  LPAREN,         // (
  RPAREN,         // )
  LBRACE,         // {
  RBRACE,         // }
  LBRACKET,       // [
  RBRACKET,       // ]
  LANGLE,         // <
  RANGLE,         // >
  SEMICOLON,      // ;
  COLON,          // :
  COMMA,          // ,
  DOT,            // .
  ARROW,          // ->

  // Special
  COMMENT,        // // and /* */
  WHITESPACE,     // Spaces, tabs, newlines
  EOF             // End of file
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
  start: number;
  end: number;
}

export interface TokenizeOptions {
  skipComments?: boolean;
  skipWhitespace?: boolean;
}

export class WGSLTokenizer {
  private source: string;
  private current = 0;
  private line = 1;
  private column = 1;
  private tokens: Token[] = [];

  constructor(source: string) {
    this.source = source;
  }

  /**
   * Tokenize WGSL source code
   */
  tokenize(options: TokenizeOptions = {}): Token[] {
    this.tokens = [];
    this.current = 0;
    this.line = 1;
    this.column = 1;

    while (!this.isAtEnd()) {
      const token = this.scanToken();

      // Skip comments/whitespace if requested
      if (options.skipComments && token.type === TokenType.COMMENT) {
        continue;
      }
      if (options.skipWhitespace && token.type === TokenType.WHITESPACE) {
        continue;
      }

      this.tokens.push(token);
    }

    // Add EOF token
    this.tokens.push({
      type: TokenType.EOF,
      value: '',
      line: this.line,
      column: this.column,
      start: this.current,
      end: this.current
    });

    return this.tokens;
  }

  private scanToken(): Token {
    const start = this.current;
    const startLine = this.line;
    const startColumn = this.column;

    const char = this.advance();

    // Whitespace
    if (this.isWhitespace(char)) {
      return this.scanWhitespace(start, startLine, startColumn);
    }

    // Comments
    if (char === '/' && this.peek() === '/') {
      return this.scanLineComment(start, startLine, startColumn);
    }
    if (char === '/' && this.peek() === '*') {
      return this.scanBlockComment(start, startLine, startColumn);
    }

    // Annotations
    if (char === '@') {
      return this.scanAnnotation(start, startLine, startColumn);
    }

    // Numbers
    if (this.isDigit(char)) {
      return this.scanNumber(start, startLine, startColumn);
    }

    // Identifiers and keywords
    if (this.isAlpha(char)) {
      return this.scanIdentifierOrKeyword(start, startLine, startColumn);
    }

    // Operators and punctuation
    return this.scanOperatorOrPunctuation(char, start, startLine, startColumn);
  }

  private scanWhitespace(start: number, startLine: number, startColumn: number): Token {
    while (!this.isAtEnd() && this.isWhitespace(this.peek())) {
      this.advance();
    }

    return this.makeToken(TokenType.WHITESPACE, start, startLine, startColumn);
  }

  private scanLineComment(start: number, startLine: number, startColumn: number): Token {
    // Skip //
    this.advance();

    // Read until newline
    while (!this.isAtEnd() && this.peek() !== '\n') {
      this.advance();
    }

    return this.makeToken(TokenType.COMMENT, start, startLine, startColumn);
  }

  private scanBlockComment(start: number, startLine: number, startColumn: number): Token {
    // Skip /*
    this.advance();

    // Read until */
    while (!this.isAtEnd()) {
      if (this.peek() === '*' && this.peekNext() === '/') {
        this.advance(); // *
        this.advance(); // /
        break;
      }
      this.advance();
    }

    return this.makeToken(TokenType.COMMENT, start, startLine, startColumn);
  }

  private scanAnnotation(start: number, startLine: number, startColumn: number): Token {
    // Read annotation name
    while (!this.isAtEnd() && (this.isAlphaNumeric(this.peek()) || this.peek() === '_')) {
      this.advance();
    }

    return this.makeToken(TokenType.ANNOTATION, start, startLine, startColumn);
  }

  private scanNumber(start: number, startLine: number, startColumn: number): Token {
    // Hex numbers
    if (this.source[start] === '0' && this.peek() === 'x') {
      this.advance(); // x
      while (!this.isAtEnd() && this.isHexDigit(this.peek())) {
        this.advance();
      }
      return this.makeToken(TokenType.NUMBER, start, startLine, startColumn);
    }

    // Decimal numbers
    while (!this.isAtEnd() && this.isDigit(this.peek())) {
      this.advance();
    }

    // Decimal point
    if (this.peek() === '.' && this.isDigit(this.peekNext())) {
      this.advance(); // .
      while (!this.isAtEnd() && this.isDigit(this.peek())) {
        this.advance();
      }
    }

    // Exponent
    if (this.peek() === 'e' || this.peek() === 'E') {
      this.advance();
      if (this.peek() === '+' || this.peek() === '-') {
        this.advance();
      }
      while (!this.isAtEnd() && this.isDigit(this.peek())) {
        this.advance();
      }
    }

    // Suffix (f for float, u for unsigned, i for signed)
    if (this.peek() === 'f' || this.peek() === 'u' || this.peek() === 'i') {
      this.advance();
    }

    return this.makeToken(TokenType.NUMBER, start, startLine, startColumn);
  }

  private scanIdentifierOrKeyword(start: number, startLine: number, startColumn: number): Token {
    while (!this.isAtEnd() && (this.isAlphaNumeric(this.peek()) || this.peek() === '_')) {
      this.advance();
    }

    const value = this.source.substring(start, this.current);

    // Check if keyword
    if (WGSL_KEYWORDS.has(value)) {
      return this.makeToken(TokenType.KEYWORD, start, startLine, startColumn);
    }

    // Check if builtin type
    if (WGSL_TYPES.has(value)) {
      return this.makeToken(TokenType.TYPE, start, startLine, startColumn);
    }

    // Check if boolean literal
    if (value === 'true' || value === 'false') {
      return this.makeToken(TokenType.BOOL, start, startLine, startColumn);
    }

    return this.makeToken(TokenType.IDENTIFIER, start, startLine, startColumn);
  }

  private scanOperatorOrPunctuation(
    char: string,
    start: number,
    startLine: number,
    startColumn: number
  ): Token {
    // Two-character operators
    const twoChar = char + this.peek();
    if (TWO_CHAR_OPERATORS.has(twoChar)) {
      this.advance();
      return this.makeToken(this.getOperatorType(twoChar), start, startLine, startColumn);
    }

    // Single-character punctuation/operators
    const type = this.getPunctuationType(char);
    return this.makeToken(type, start, startLine, startColumn);
  }

  // Helper methods
  private advance(): string {
    const char = this.source[this.current++];
    if (char === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    return char;
  }

  private peek(): string {
    return this.isAtEnd() ? '\0' : this.source[this.current];
  }

  private peekNext(): string {
    return this.current + 1 >= this.source.length ? '\0' : this.source[this.current + 1];
  }

  private isAtEnd(): boolean {
    return this.current >= this.source.length;
  }

  private isWhitespace(char: string): boolean {
    return char === ' ' || char === '\t' || char === '\n' || char === '\r';
  }

  private isDigit(char: string): boolean {
    return char >= '0' && char <= '9';
  }

  private isHexDigit(char: string): boolean {
    return (char >= '0' && char <= '9') ||
           (char >= 'a' && char <= 'f') ||
           (char >= 'A' && char <= 'F');
  }

  private isAlpha(char: string): boolean {
    return (char >= 'a' && char <= 'z') ||
           (char >= 'A' && char <= 'Z') ||
           char === '_';
  }

  private isAlphaNumeric(char: string): boolean {
    return this.isAlpha(char) || this.isDigit(char);
  }

  private makeToken(type: TokenType, start: number, startLine: number, startColumn: number): Token {
    return {
      type,
      value: this.source.substring(start, this.current),
      line: startLine,
      column: startColumn,
      start,
      end: this.current
    };
  }

  private getOperatorType(op: string): TokenType {
    if (COMPARISON_OPERATORS.has(op)) return TokenType.COMPARISON;
    if (LOGICAL_OPERATORS.has(op)) return TokenType.LOGICAL;
    if (ASSIGNMENT_OPERATORS.has(op)) return TokenType.ASSIGNMENT;
    return TokenType.OPERATOR;
  }

  private getPunctuationType(char: string): TokenType {
    const punctuationMap: Record<string, TokenType> = {
      '(': TokenType.LPAREN,
      ')': TokenType.RPAREN,
      '{': TokenType.LBRACE,
      '}': TokenType.RBRACE,
      '[': TokenType.LBRACKET,
      ']': TokenType.RBRACKET,
      '<': TokenType.LANGLE,
      '>': TokenType.RANGLE,
      ';': TokenType.SEMICOLON,
      ':': TokenType.COLON,
      ',': TokenType.COMMA,
      '.': TokenType.DOT
    };

    return punctuationMap[char] || TokenType.OPERATOR;
  }
}

// WGSL keyword sets
const WGSL_KEYWORDS = new Set([
  'alias', 'break', 'case', 'const', 'const_assert', 'continue',
  'continuing', 'default', 'diagnostic', 'discard', 'else', 'enable',
  'fn', 'for', 'if', 'let', 'loop', 'override', 'requires', 'return',
  'struct', 'switch', 'var', 'while'
]);

const WGSL_TYPES = new Set([
  'bool', 'f16', 'f32', 'i32', 'u32',
  'vec2', 'vec3', 'vec4',
  'vec2i', 'vec3i', 'vec4i',
  'vec2u', 'vec3u', 'vec4u',
  'vec2f', 'vec3f', 'vec4f',
  'vec2h', 'vec3h', 'vec4h',
  'mat2x2', 'mat2x3', 'mat2x4',
  'mat3x2', 'mat3x3', 'mat3x4',
  'mat4x2', 'mat4x3', 'mat4x4',
  'mat2x2f', 'mat2x3f', 'mat2x4f',
  'mat3x2f', 'mat3x3f', 'mat3x4f',
  'mat4x2f', 'mat4x3f', 'mat4x4f',
  'atomic', 'array', 'ptr', 'sampler', 'sampler_comparison',
  'texture_1d', 'texture_2d', 'texture_2d_array', 'texture_3d',
  'texture_cube', 'texture_cube_array', 'texture_multisampled_2d',
  'texture_storage_1d', 'texture_storage_2d', 'texture_storage_2d_array',
  'texture_storage_3d', 'texture_depth_2d', 'texture_depth_2d_array',
  'texture_depth_cube', 'texture_depth_cube_array',
  'texture_depth_multisampled_2d'
]);

const TWO_CHAR_OPERATORS = new Set([
  '==', '!=', '<=', '>=', '&&', '||', '<<', '>>',
  '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=',
  '->'
]);

const COMPARISON_OPERATORS = new Set(['==', '!=', '<', '>', '<=', '>=']);
const LOGICAL_OPERATORS = new Set(['&&', '||', '!']);
const ASSIGNMENT_OPERATORS = new Set(['=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=']);
```

**Acceptance Criteria:**
- [ ] Tokenizer handles all WGSL token types
- [ ] Correct line/column tracking
- [ ] Handle comments (line and block)
- [ ] Handle all number formats (hex, float, exponent)
- [ ] Skip whitespace/comments when requested
- [ ] Comprehensive unit tests (100+ test cases)
- [ ] Performance: <1ms for typical shaders (<10KB)

**Dependencies:** None

---

### Task 3.2: WGSL Parser (8 hours)

**Deliverable:** `/packages/rendering/src/shaders/WGSLParser.ts`

```typescript
export interface ParseOptions {
  validateWithWebGPU?: boolean;
  device?: GPUDevice;
}

export interface ParseError {
  message: string;
  line: number;
  column: number;
  severity: 'error' | 'warning';
}

export class WGSLParser {
  private tokens: Token[] = [];
  private current = 0;
  private errors: ParseError[] = [];

  /**
   * Parse WGSL source and extract reflection data
   */
  async parse(
    source: string,
    options: ParseOptions = {}
  ): Promise<ShaderReflectionData> {
    // Tokenize
    const tokenizer = new WGSLTokenizer(source);
    this.tokens = tokenizer.tokenize({
      skipComments: true,
      skipWhitespace: true
    });

    this.current = 0;
    this.errors = [];

    // WebGPU validation (optional but recommended)
    let compilationInfo: GPUCompilationInfo | undefined;
    if (options.validateWithWebGPU && options.device) {
      compilationInfo = await this.validateWithWebGPU(source, options.device);
    }

    // Parse shader structure
    const bindGroupLayouts = this.parseBindGroups();
    const vertexInputs = this.parseVertexInputs();
    const entryPoints = this.parseEntryPoints();

    // Convert compilation info to errors
    if (compilationInfo) {
      for (const message of compilationInfo.messages) {
        if (message.type === 'error') {
          this.errors.push({
            message: message.message,
            line: message.lineNum,
            column: message.linePos,
            severity: 'error'
          });
        }
      }
    }

    // Throw if errors found
    if (this.errors.length > 0) {
      throw new ShaderParseError(this.errors, source);
    }

    return {
      bindGroupLayouts,
      vertexInputs,
      entryPoints
    };
  }

  /**
   * Validate shader with WebGPU
   */
  private async validateWithWebGPU(
    source: string,
    device: GPUDevice
  ): Promise<GPUCompilationInfo> {
    const module = device.createShaderModule({
      code: source,
      label: 'validation_module'
    });

    return await module.getCompilationInfo();
  }

  /**
   * Parse bind group declarations
   */
  private parseBindGroups(): BindGroupLayoutDescriptor[] {
    const groups = new Map<number, BindGroupLayoutDescriptor>();

    // Reset to start
    this.current = 0;

    while (!this.isAtEnd()) {
      // Look for @group annotation
      if (this.match(TokenType.ANNOTATION) && this.previous().value === '@group') {
        const binding = this.parseBindGroupEntry();
        if (binding) {
          const groupIndex = binding.group;
          if (!groups.has(groupIndex)) {
            groups.set(groupIndex, {
              entries: []
            });
          }
          groups.get(groupIndex)!.entries.push({
            binding: binding.binding,
            visibility: binding.visibility,
            type: binding.type
          });
        }
      } else {
        this.advance();
      }
    }

    // Convert to sorted array
    const result: BindGroupLayoutDescriptor[] = [];
    for (let i = 0; i < 4; i++) {
      if (groups.has(i)) {
        result[i] = groups.get(i)!;
      }
    }

    return result;
  }

  /**
   * Parse a single bind group entry
   */
  private parseBindGroupEntry(): BindGroupEntry | null {
    try {
      // @group(N)
      this.consume(TokenType.LPAREN, "Expected '(' after @group");
      const groupToken = this.consume(TokenType.NUMBER, "Expected group index");
      const group = parseInt(groupToken.value);
      this.consume(TokenType.RPAREN, "Expected ')' after group index");

      // @binding(N)
      this.consume(TokenType.ANNOTATION, "Expected @binding annotation");
      if (this.previous().value !== '@binding') {
        throw new Error("Expected @binding annotation");
      }
      this.consume(TokenType.LPAREN, "Expected '(' after @binding");
      const bindingToken = this.consume(TokenType.NUMBER, "Expected binding index");
      const binding = parseInt(bindingToken.value);
      this.consume(TokenType.RPAREN, "Expected ')' after binding index");

      // var<storage_class> name: type;
      this.consume(TokenType.KEYWORD, "Expected 'var' keyword");
      if (this.previous().value !== 'var') {
        throw new Error("Expected 'var' keyword");
      }

      // Storage class (optional)
      let storageClass: string | undefined;
      if (this.match(TokenType.LANGLE)) {
        storageClass = this.consume(TokenType.IDENTIFIER, "Expected storage class").value;
        // Handle access mode (e.g., read_write)
        if (this.match(TokenType.COMMA)) {
          this.advance(); // Skip access mode for now
        }
        this.consume(TokenType.RANGLE, "Expected '>' after storage class");
      }

      // Variable name
      const name = this.consume(TokenType.IDENTIFIER, "Expected variable name").value;

      // Type annotation
      this.consume(TokenType.COLON, "Expected ':' before type");
      const type = this.parseType();

      // Semicolon
      this.consume(TokenType.SEMICOLON, "Expected ';' after declaration");

      return {
        group,
        binding,
        name,
        type,
        storageClass,
        visibility: this.inferVisibility(storageClass)
      };
    } catch (error) {
      this.errors.push({
        message: (error as Error).message,
        line: this.peek().line,
        column: this.peek().column,
        severity: 'error'
      });
      return null;
    }
  }

  /**
   * Parse type expression
   */
  private parseType(): string {
    const parts: string[] = [];

    // Base type
    if (this.match(TokenType.TYPE, TokenType.IDENTIFIER)) {
      parts.push(this.previous().value);
    }

    // Generic parameters (e.g., array<T>)
    if (this.match(TokenType.LANGLE)) {
      parts.push('<');
      parts.push(this.parseType());
      if (this.match(TokenType.COMMA)) {
        parts.push(', ');
        parts.push(this.parseType());
      }
      this.consume(TokenType.RANGLE, "Expected '>' after type parameters");
      parts.push('>');
    }

    return parts.join('');
  }

  /**
   * Parse vertex input attributes
   */
  private parseVertexInputs(): VertexInputDescriptor[] {
    const inputs: VertexInputDescriptor[] = [];

    this.current = 0;

    while (!this.isAtEnd()) {
      // Look for @location annotation
      if (this.match(TokenType.ANNOTATION) && this.previous().value === '@location') {
        this.consume(TokenType.LPAREN, "Expected '(' after @location");
        const locationToken = this.consume(TokenType.NUMBER, "Expected location index");
        const location = parseInt(locationToken.value);
        this.consume(TokenType.RPAREN, "Expected ')' after location index");

        // Get type
        // Skip to type annotation
        while (!this.isAtEnd() && !this.match(TokenType.COLON)) {
          this.advance();
        }

        if (!this.isAtEnd()) {
          const type = this.parseType();
          inputs.push({ location, type });
        }
      } else {
        this.advance();
      }
    }

    return inputs;
  }

  /**
   * Parse entry points (vertex, fragment, compute)
   */
  private parseEntryPoints(): EntryPointDescriptor[] {
    const entryPoints: EntryPointDescriptor[] = [];

    this.current = 0;

    while (!this.isAtEnd()) {
      // Look for @vertex, @fragment, @compute
      if (this.match(TokenType.ANNOTATION)) {
        const annotation = this.previous().value;
        if (annotation === '@vertex' || annotation === '@fragment' || annotation === '@compute') {
          // Next should be fn name()
          if (this.match(TokenType.KEYWORD) && this.previous().value === 'fn') {
            const name = this.consume(TokenType.IDENTIFIER, "Expected function name").value;
            entryPoints.push({
              stage: annotation.substring(1) as 'vertex' | 'fragment' | 'compute',
              name
            });
          }
        }
      } else {
        this.advance();
      }
    }

    return entryPoints;
  }

  // Token manipulation helpers
  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();

    const token = this.peek();
    throw new Error(`${message} at line ${token.line}, column ${token.column}`);
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }

  private isAtEnd(): boolean {
    return this.current >= this.tokens.length || this.peek().type === TokenType.EOF;
  }

  private inferVisibility(storageClass?: string): GPUShaderStageFlags {
    // Uniform buffers typically used in all stages
    if (storageClass === 'uniform') {
      return GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT;
    }
    // Storage buffers often in compute
    if (storageClass === 'storage') {
      return GPUShaderStage.COMPUTE;
    }
    // Default: all stages
    return GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE;
  }
}

export class ShaderParseError extends Error {
  constructor(
    public readonly errors: ParseError[],
    public readonly source: string
  ) {
    super(ShaderParseError.formatErrors(errors, source));
    this.name = 'ShaderParseError';
  }

  private static formatErrors(errors: ParseError[], source: string): string {
    const lines = source.split('\n');
    const messages = errors.map(error => {
      const line = lines[error.line - 1] || '';
      const pointer = ' '.repeat(error.column - 1) + '^';
      return `Error at line ${error.line}, column ${error.column}:\n` +
             `  ${line}\n` +
             `  ${pointer}\n` +
             `  ${error.message}`;
    });

    return `Shader parsing failed with ${errors.length} error(s):\n\n` + messages.join('\n\n');
  }
}

interface BindGroupEntry {
  group: number;
  binding: number;
  name: string;
  type: string;
  storageClass?: string;
  visibility: GPUShaderStageFlags;
}

interface VertexInputDescriptor {
  location: number;
  type: string;
}

interface EntryPointDescriptor {
  stage: 'vertex' | 'fragment' | 'compute';
  name: string;
}
```

**Acceptance Criteria:**
- [ ] Parse all bind group declarations correctly
- [ ] Handle vertex input attributes
- [ ] Extract entry points (vertex/fragment/compute)
- [ ] WebGPU validation integration
- [ ] Detailed error messages with line/column
- [ ] Handle all valid WGSL syntax variations
- [ ] Comprehensive test suite (50+ WGSL samples)
- [ ] Performance: <5ms for complex shaders

**Dependencies:** Task 3.1

---

### Task 3.3: Replace Regex Parser (4 hours)

**Deliverable:** Update `/packages/rendering/src/ShaderReflection.ts`

**Changes:**
- Remove regex-based parsing code
- Replace with WGSLParser
- Update all call sites
- Add WebGPU validation option
- Maintain backward compatibility for ShaderReflectionData interface

```typescript
// Before (regex)
export function parseShaderReflection(source: string): ShaderReflectionData {
  const bindGroupRegex = /@group\((\d+)\)\s+@binding\((\d+)\)...;/g;
  // Fragile regex parsing...
}

// After (tokenizer + parser)
export async function parseShaderReflection(
  source: string,
  device?: GPUDevice
): Promise<ShaderReflectionData> {
  const parser = new WGSLParser();
  return await parser.parse(source, {
    validateWithWebGPU: !!device,
    device
  });
}
```

**Acceptance Criteria:**
- [ ] All regex code removed
- [ ] WGSLParser integrated
- [ ] All existing tests pass
- [ ] New tests for previously unsupported syntax
- [ ] Error messages improved
- [ ] No breaking changes to public API

**Dependencies:** Task 3.2

---

### Task 3.4: Pipeline State Presets (4 hours)

**Deliverable:** `/packages/rendering/src/pipeline/PipelinePresets.ts`

```typescript
export enum RenderMode {
  OPAQUE = 'opaque',
  TRANSPARENT = 'transparent',
  ADDITIVE = 'additive',
  ALPHA_CUTOUT = 'alpha_cutout',
  WIREFRAME = 'wireframe'
}

export interface PipelineStateDescriptor {
  depthStencil?: {
    depthWriteEnabled: boolean;
    depthCompare: GPUCompareFunction;
    stencilFront?: GPUStencilFaceState;
    stencilBack?: GPUStencilFaceState;
  };
  blending?: {
    enabled: boolean;
    color?: {
      srcFactor: GPUBlendFactor;
      dstFactor: GPUBlendFactor;
      operation?: GPUBlendOperation;
    };
    alpha?: {
      srcFactor: GPUBlendFactor;
      dstFactor: GPUBlendFactor;
      operation?: GPUBlendOperation;
    };
  };
  rasterization?: {
    cullMode: GPUCullMode;
    frontFace?: GPUFrontFace;
    depthBias?: number;
    depthBiasSlopeScale?: number;
  };
  alphaToCoverage?: boolean;
  multisample?: {
    count: number;
    mask: number;
  };
}

export class PipelinePresets {
  /**
   * Opaque rendering (default)
   * - Depth write enabled
   * - Depth test: less
   * - Backface culling
   * - No blending
   */
  static readonly OPAQUE: PipelineStateDescriptor = {
    depthStencil: {
      depthWriteEnabled: true,
      depthCompare: 'less'
    },
    blending: {
      enabled: false
    },
    rasterization: {
      cullMode: 'back',
      frontFace: 'ccw'
    }
  };

  /**
   * Transparent rendering
   * - Depth write DISABLED (important!)
   * - Depth test: less
   * - No culling (see both sides)
   * - Alpha blending: src-alpha / one-minus-src-alpha
   */
  static readonly TRANSPARENT: PipelineStateDescriptor = {
    depthStencil: {
      depthWriteEnabled: false,
      depthCompare: 'less'
    },
    blending: {
      enabled: true,
      color: {
        srcFactor: 'src-alpha',
        dstFactor: 'one-minus-src-alpha',
        operation: 'add'
      },
      alpha: {
        srcFactor: 'one',
        dstFactor: 'one-minus-src-alpha',
        operation: 'add'
      }
    },
    rasterization: {
      cullMode: 'none'
    }
  };

  /**
   * Additive blending (particles, lights)
   * - Depth write disabled
   * - Depth test: less
   * - No culling
   * - Additive blending: one / one
   */
  static readonly ADDITIVE: PipelineStateDescriptor = {
    depthStencil: {
      depthWriteEnabled: false,
      depthCompare: 'less'
    },
    blending: {
      enabled: true,
      color: {
        srcFactor: 'one',
        dstFactor: 'one',
        operation: 'add'
      },
      alpha: {
        srcFactor: 'one',
        dstFactor: 'one',
        operation: 'add'
      }
    },
    rasterization: {
      cullMode: 'none'
    }
  };

  /**
   * Alpha cutout (vegetation, fences)
   * - Depth write enabled
   * - Depth test: less
   * - No culling (see both sides)
   * - Alpha to coverage (MSAA required)
   */
  static readonly ALPHA_CUTOUT: PipelineStateDescriptor = {
    depthStencil: {
      depthWriteEnabled: true,
      depthCompare: 'less'
    },
    blending: {
      enabled: false
    },
    rasterization: {
      cullMode: 'none'
    },
    alphaToCoverage: true
  };

  /**
   * Wireframe rendering (debug)
   * - Depth test: less
   * - No culling
   * - Line topology (set in createRenderPipeline)
   */
  static readonly WIREFRAME: PipelineStateDescriptor = {
    depthStencil: {
      depthWriteEnabled: true,
      depthCompare: 'less'
    },
    blending: {
      enabled: false
    },
    rasterization: {
      cullMode: 'none'
    }
  };

  /**
   * Get preset by render mode
   */
  static fromRenderMode(mode: RenderMode): PipelineStateDescriptor {
    switch (mode) {
      case RenderMode.OPAQUE:
        return this.OPAQUE;
      case RenderMode.TRANSPARENT:
        return this.TRANSPARENT;
      case RenderMode.ADDITIVE:
        return this.ADDITIVE;
      case RenderMode.ALPHA_CUTOUT:
        return this.ALPHA_CUTOUT;
      case RenderMode.WIREFRAME:
        return this.WIREFRAME;
      default:
        throw new Error(`Unknown render mode: ${mode}`);
    }
  }

  /**
   * Create custom preset with validation
   */
  static custom(config: Partial<PipelineStateDescriptor>): PipelineStateDescriptor {
    const preset = { ...this.OPAQUE, ...config };

    // Validate common mistakes
    if (preset.blending?.enabled && preset.depthStencil?.depthWriteEnabled) {
      console.warn(
        'Warning: Transparent objects should disable depth writes. ' +
        'Set depthStencil.depthWriteEnabled = false'
      );
    }

    return preset;
  }

  /**
   * Merge presets (for variations)
   */
  static merge(
    base: PipelineStateDescriptor,
    overrides: Partial<PipelineStateDescriptor>
  ): PipelineStateDescriptor {
    return {
      ...base,
      ...overrides,
      depthStencil: { ...base.depthStencil, ...overrides.depthStencil },
      blending: { ...base.blending, ...overrides.blending },
      rasterization: { ...base.rasterization, ...overrides.rasterization }
    };
  }
}

// Export common presets as constants
export const OPAQUE_PIPELINE_STATE = PipelinePresets.OPAQUE;
export const TRANSPARENT_PIPELINE_STATE = PipelinePresets.TRANSPARENT;
export const ADDITIVE_PIPELINE_STATE = PipelinePresets.ADDITIVE;
export const ALPHA_CUTOUT_PIPELINE_STATE = PipelinePresets.ALPHA_CUTOUT;
export const WIREFRAME_PIPELINE_STATE = PipelinePresets.WIREFRAME;
```

**Acceptance Criteria:**
- [ ] 5 preset render modes defined
- [ ] Validation for common mistakes
- [ ] Merge utility for variations
- [ ] JSDoc comments explaining each preset
- [ ] Unit tests for all presets
- [ ] Integration with Material system

**Dependencies:** None

---

### Task 3.5: Integration and Documentation (4 hours)

**Deliverable:**
- Update ShaderLoader to use new parser
- Create migration guide
- Add examples for pipeline presets

```typescript
// Example: Using pipeline presets
const material = new Material(renderer, {
  shader: 'pbr',
  pipelineState: PipelinePresets.TRANSPARENT // Instead of verbose config
});

// Example: Custom preset with validation
const glowMaterial = new Material(renderer, {
  shader: 'glow',
  pipelineState: PipelinePresets.custom({
    ...PipelinePresets.ADDITIVE,
    rasterization: {
      cullMode: 'back' // Override specific field
    }
  })
});
```

**Acceptance Criteria:**
- [ ] All shader loading uses new parser
- [ ] Migration guide published
- [ ] Examples updated
- [ ] Performance comparison (old vs new parser)
- [ ] Documentation for pipeline presets

**Dependencies:** Task 3.3, Task 3.4

---

## Breaking Changes

### API Changes
- `parseShaderReflection()` now returns `Promise<ShaderReflectionData>` (async for WebGPU validation)
- Shader parsing errors now throw `ShaderParseError` instead of generic `Error`

### Migration Pattern
```typescript
// Before (sync)
const reflection = parseShaderReflection(source);

// After (async)
const reflection = await parseShaderReflection(source, device);
```

## Testing Requirements

### Unit Tests
- [ ] WGSLTokenizer: 100+ test cases for all token types
- [ ] WGSLParser: 50+ WGSL shader samples
- [ ] Edge cases: comments, whitespace, multi-line
- [ ] Error handling: invalid syntax, line/column tracking
- [ ] Pipeline presets: all render modes
- [ ] Preset validation: common mistakes detected

### Integration Tests
- [ ] Parse all built-in shaders successfully
- [ ] Parse all demo shaders successfully
- [ ] WebGPU validation catches errors
- [ ] Error messages are helpful
- [ ] Pipeline presets work with Material system

### Performance Tests
- [ ] Tokenizer: <1ms for 10KB shader
- [ ] Parser: <5ms for complex shader
- [ ] No regression vs regex parser (target: <10% slower)

### Coverage Target
**>80% line coverage** for parser code

## Performance Targets

| Metric | Target | Critical |
|--------|--------|----------|
| Tokenize speed (10KB) | <1ms | <5ms |
| Parse speed (complex) | <5ms | <10ms |
| Regression vs regex | <10% | <50% |
| Memory overhead | <1MB | <5MB |

## Dependencies

### Blocks
- None (parser improvements don't block other work)

### Blocked By
- None (can start immediately alongside other epics)

## Risks & Mitigation

### High Risk
**Parser complexity may introduce bugs**
- *Mitigation:* Comprehensive test suite with 150+ test cases
- *Mitigation:* WebGPU validation as fallback
- *Mitigation:* Gradual rollout with feature flag

### Medium Risk
**Performance regression vs regex parser**
- *Mitigation:* Profile and optimize hot paths
- *Mitigation:* Cache parsed results
- *Mitigation:* Accept <10% slowdown for correctness

### Low Risk
**Developer adoption of pipeline presets**
- *Mitigation:* Clear documentation with examples
- *Mitigation:* Update Material system to use presets by default

## Definition of Done

- [ ] All 5 tasks completed
- [ ] WGSLTokenizer and WGSLParser fully implemented
- [ ] Regex parser removed
- [ ] Pipeline presets with 5 render modes
- [ ] All tests passing with >80% coverage
- [ ] Performance targets met (<10% regression)
- [ ] WebGPU validation integrated
- [ ] Migration guide published
- [ ] All demos updated
- [ ] Code reviewed and approved

---

*Epic created: November 2025*
*Priority: MEDIUM*
*Estimated effort: 24 hours*
