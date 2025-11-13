/**
 * WGSL Tokenizer
 * Epic 3.14 Phase 3 - Task 3
 *
 * High-performance tokenizer for WGSL 1.0 specification
 */

import { Token, TokenType, SourceLocation, KEYWORDS, RESERVED_KEYWORDS } from './Token';

/**
 * Tokenizer error
 */
export class TokenizerError extends Error {
  constructor(
    message: string,
    public location: SourceLocation
  ) {
    super(`${message} at line ${location.line}, column ${location.column}`);
    this.name = 'TokenizerError';
  }
}

/**
 * Character classification lookup tables for performance
 */
const isDigitTable: boolean[] = new Array(128).fill(false);
const isAlphaTable: boolean[] = new Array(128).fill(false);
const isAlphaNumericTable: boolean[] = new Array(128).fill(false);
const isWhitespaceTable: boolean[] = new Array(128).fill(false);

// Initialize lookup tables
for (let i = 48; i <= 57; i++) isDigitTable[i] = true; // 0-9
for (let i = 65; i <= 90; i++) isAlphaTable[i] = true; // A-Z
for (let i = 97; i <= 122; i++) isAlphaTable[i] = true; // a-z
isAlphaTable[95] = true; // _

for (let i = 0; i < 128; i++) {
  isAlphaNumericTable[i] = isAlphaTable[i] || isDigitTable[i];
}

isWhitespaceTable[9] = true;  // tab
isWhitespaceTable[10] = true; // newline
isWhitespaceTable[13] = true; // carriage return
isWhitespaceTable[32] = true; // space

/**
 * Fast character classification (uses lookup tables for ASCII)
 */
function isDigit(char: string): boolean {
  const code = char.charCodeAt(0);
  return code < 128 ? isDigitTable[code] : false;
}

function isAlpha(char: string): boolean {
  const code = char.charCodeAt(0);
  return code < 128 ? isAlphaTable[code] : char > '\x7f'; // Allow Unicode identifiers
}

function isAlphaNumeric(char: string): boolean {
  const code = char.charCodeAt(0);
  return code < 128 ? isAlphaNumericTable[code] : char > '\x7f';
}

function isWhitespace(char: string): boolean {
  const code = char.charCodeAt(0);
  return code < 128 ? isWhitespaceTable[code] : false;
}

/**
 * Maximum shader source size (1MB)
 */
const MAX_SHADER_SIZE = 1_000_000;

/**
 * WGSL Tokenizer
 */
export class WGSLTokenizer {
  private source: string = '';
  private tokens: Token[] = [];
  private start = 0;
  private current = 0;
  private line = 1;
  private column = 1;
  private startLine = 1;
  private startColumn = 1;

  /**
   * Tokenize WGSL source code
   */
  tokenize(source: string): Token[] {
    // Security: Reject shaders larger than 1MB
    if (source.length > MAX_SHADER_SIZE) {
      throw new TokenizerError(
        `Shader source exceeds maximum size of ${MAX_SHADER_SIZE} bytes (got ${source.length} bytes)`,
        { line: 1, column: 1, offset: 0 }
      );
    }

    this.source = source;
    this.tokens = [];
    this.start = 0;
    this.current = 0;
    this.line = 1;
    this.column = 1;

    while (!this.isAtEnd()) {
      this.start = this.current;
      this.startLine = this.line;
      this.startColumn = this.column;
      this.scanToken();
    }

    // Add EOF token (points to end of file)
    const eofLoc: SourceLocation = {
      line: this.line,
      column: this.column,
      offset: this.source.length,
    };
    this.tokens.push(new Token(TokenType.EOF, '', eofLoc, eofLoc));

    return this.tokens;
  }

  /**
   * Scan a single token
   */
  private scanToken(): void {
    const char = this.advance();

    switch (char) {
      // Whitespace (skip)
      case ' ':
      case '\t':
      case '\r':
        break;
      case '\n':
        break;

      // Single-character tokens
      case '(': this.addToken(TokenType.PAREN_LEFT); break;
      case ')': this.addToken(TokenType.PAREN_RIGHT); break;
      case '[': this.addToken(TokenType.BRACKET_LEFT); break;
      case ']': this.addToken(TokenType.BRACKET_RIGHT); break;
      case '{': this.addToken(TokenType.BRACE_LEFT); break;
      case '}': this.addToken(TokenType.BRACE_RIGHT); break;
      case ',': this.addToken(TokenType.COMMA); break;
      case ';': this.addToken(TokenType.SEMICOLON); break;
      case ':': this.addToken(TokenType.COLON); break;
      case '.': this.addToken(TokenType.DOT); break;
      case '~': this.addToken(TokenType.TILDE); break;

      // Multi-character operators
      case '+':
        this.addToken(this.match('=') ? TokenType.PLUS_EQUAL : TokenType.PLUS);
        break;
      case '*':
        this.addToken(this.match('=') ? TokenType.STAR_EQUAL : TokenType.STAR);
        break;
      case '%':
        this.addToken(this.match('=') ? TokenType.PERCENT_EQUAL : TokenType.PERCENT);
        break;
      case '^':
        this.addToken(this.match('=') ? TokenType.XOR_EQUAL : TokenType.XOR);
        break;
      case '!':
        this.addToken(this.match('=') ? TokenType.NOT_EQUAL : TokenType.BANG);
        break;
      case '=':
        this.addToken(this.match('=') ? TokenType.EQUAL_EQUAL : TokenType.EQUAL);
        break;

      // Minus or arrow
      case '-':
        if (this.match('>')) {
          this.addToken(TokenType.ARROW);
        } else if (this.match('=')) {
          this.addToken(TokenType.MINUS_EQUAL);
        } else {
          this.addToken(TokenType.MINUS);
        }
        break;

      // Less than, shift left, or less-equal
      case '<':
        if (this.match('<')) {
          this.addToken(this.match('=') ? TokenType.SHIFT_LEFT_EQUAL : TokenType.SHIFT_LEFT);
        } else if (this.match('=')) {
          this.addToken(TokenType.LESS_EQUAL);
        } else {
          this.addToken(TokenType.ANGLE_LEFT);
        }
        break;

      // Greater than, shift right, or greater-equal
      case '>':
        if (this.match('>')) {
          this.addToken(this.match('=') ? TokenType.SHIFT_RIGHT_EQUAL : TokenType.SHIFT_RIGHT);
        } else if (this.match('=')) {
          this.addToken(TokenType.GREATER_EQUAL);
        } else {
          this.addToken(TokenType.ANGLE_RIGHT);
        }
        break;

      // And or logical and
      case '&':
        if (this.match('&')) {
          this.addToken(TokenType.AND_AND);
        } else if (this.match('=')) {
          this.addToken(TokenType.AND_EQUAL);
        } else {
          this.addToken(TokenType.AND);
        }
        break;

      // Or or logical or
      case '|':
        if (this.match('|')) {
          this.addToken(TokenType.OR_OR);
        } else if (this.match('=')) {
          this.addToken(TokenType.OR_EQUAL);
        } else {
          this.addToken(TokenType.OR);
        }
        break;

      // Slash (division, comment, or divide-equal)
      case '/':
        if (this.match('/')) {
          // Line comment
          this.skipLineComment();
        } else if (this.match('*')) {
          // Block comment
          this.skipBlockComment();
        } else if (this.match('=')) {
          this.addToken(TokenType.SLASH_EQUAL);
        } else {
          this.addToken(TokenType.SLASH);
        }
        break;

      // Attribute
      case '@':
        this.scanAttribute();
        break;

      // String literals not supported in WGSL
      case '"':
      case "'":
        throw new TokenizerError(`String literals are not supported in WGSL`, this.getLocation());

      default:
        if (isDigit(char)) {
          this.scanNumber();
        } else if (isAlpha(char)) {
          this.scanIdentifierOrKeyword();
        } else if (isWhitespace(char)) {
          // Skip additional whitespace
        } else {
          throw new TokenizerError(`Unexpected character: '${char}'`, {
            line: this.startLine,
            column: this.startColumn,
            offset: this.start,
          });
        }
        break;
    }
  }

  /**
   * Scan identifier or keyword
   */
  private scanIdentifierOrKeyword(): void {
    while (isAlphaNumeric(this.peek())) {
      this.advance();
    }

    const text = this.source.substring(this.start, this.current);

    // Check if reserved keyword
    if (RESERVED_KEYWORDS.has(text)) {
      this.addToken(TokenType.RESERVED_KEYWORD);
      return;
    }

    // Check if keyword
    const keywordType = KEYWORDS.get(text);
    if (keywordType) {
      this.addToken(keywordType);
    } else {
      this.addToken(TokenType.IDENTIFIER);
    }
  }

  /**
   * Scan attribute (@group, @binding, etc.)
   */
  private scanAttribute(): void {
    while (isAlphaNumeric(this.peek())) {
      this.advance();
    }

    const text = this.source.substring(this.start, this.current);

    // Map attribute string to token type
    const attrMap: Record<string, TokenType> = {
      '@align': TokenType.ATTR_ALIGN,
      '@binding': TokenType.ATTR_BINDING,
      '@builtin': TokenType.ATTR_BUILTIN,
      '@compute': TokenType.ATTR_COMPUTE,
      '@const': TokenType.ATTR_CONST,
      '@fragment': TokenType.ATTR_FRAGMENT,
      '@group': TokenType.ATTR_GROUP,
      '@id': TokenType.ATTR_ID,
      '@interpolate': TokenType.ATTR_INTERPOLATE,
      '@invariant': TokenType.ATTR_INVARIANT,
      '@location': TokenType.ATTR_LOCATION,
      '@size': TokenType.ATTR_SIZE,
      '@vertex': TokenType.ATTR_VERTEX,
      '@workgroup_size': TokenType.ATTR_WORKGROUP_SIZE,
    };

    const tokenType = attrMap[text];
    if (tokenType) {
      this.addToken(tokenType);
    } else {
      throw new TokenizerError(`Unknown attribute: ${text}`, this.getLocation());
    }
  }

  /**
   * Scan number (integer or float)
   */
  private scanNumber(): void {
    // Handle hex literals (0x...)
    if (this.source.charAt(this.start) === '0' && (this.peek() === 'x' || this.peek() === 'X')) {
      this.advance(); // consume 'x'

      const hexStart = this.current;
      while (this.isHexDigit(this.peek())) {
        this.advance();
      }

      // Must have at least one hex digit
      if (this.current === hexStart) {
        throw new TokenizerError('Hex literal must have at least one digit after 0x', this.getLocation());
      }

      // Check for hex float (0x1.8p3f)
      if (this.peek() === '.') {
        this.advance(); // consume '.'
        while (this.isHexDigit(this.peek())) {
          this.advance();
        }

        // Hex float requires exponent
        if (this.peek() !== 'p' && this.peek() !== 'P') {
          throw new TokenizerError('Hex float literal requires exponent (p or P)', this.getLocation());
        }

        this.advance(); // consume 'p'
        if (this.peek() === '+' || this.peek() === '-') {
          this.advance();
        }

        const expStart = this.current;
        while (isDigit(this.peek())) {
          this.advance();
        }

        if (this.current === expStart) {
          throw new TokenizerError('Hex float exponent must have at least one digit', this.getLocation());
        }

        // Optional 'f' suffix
        if (this.peek() === 'f') {
          this.advance();
        }

        this.addToken(TokenType.FLOAT_LITERAL);
        return;
      }

      // Check for hex float exponent without fractional part (0x1p3f)
      if (this.peek() === 'p' || this.peek() === 'P') {
        this.advance(); // consume 'p'
        if (this.peek() === '+' || this.peek() === '-') {
          this.advance();
        }

        const expStart = this.current;
        while (isDigit(this.peek())) {
          this.advance();
        }

        if (this.current === expStart) {
          throw new TokenizerError('Hex float exponent must have at least one digit', this.getLocation());
        }

        // Optional 'f' suffix
        if (this.peek() === 'f') {
          this.advance();
        }

        this.addToken(TokenType.FLOAT_LITERAL);
        return;
      }

      // Hex integer - optional suffix (u, i, f)
      const suffix = this.peek();
      if (suffix === 'u' || suffix === 'i') {
        this.advance();
        this.addToken(TokenType.INT_LITERAL);
      } else if (suffix === 'f') {
        this.advance();
        this.addToken(TokenType.FLOAT_LITERAL);
      } else {
        this.addToken(TokenType.INT_LITERAL);
      }
      return;
    }

    // Decimal number - consume integer part
    while (isDigit(this.peek())) {
      this.advance();
    }

    // Check for decimal point (float)
    if (this.peek() === '.') {
      // Look ahead to distinguish float from member access
      // '1.0' or '1.f' are floats, '1.' by itself needs context
      const nextChar = this.peekNext();

      if (isDigit(nextChar) || nextChar === 'f' || nextChar === 'e' || nextChar === 'E') {
        // This is a float literal
        this.advance(); // consume '.'

        // Consume fractional part (optional if suffix follows)
        while (isDigit(this.peek())) {
          this.advance();
        }

        // Check for exponent
        if (this.peek() === 'e' || this.peek() === 'E') {
          this.advance();
          if (this.peek() === '+' || this.peek() === '-') {
            this.advance();
          }

          const expStart = this.current;
          while (isDigit(this.peek())) {
            this.advance();
          }

          // Exponent must have at least one digit
          if (this.current === expStart) {
            throw new TokenizerError('Float exponent must have at least one digit', this.getLocation());
          }
        }

        // Optional suffix (f)
        if (this.peek() === 'f') {
          this.advance();
        }

        this.addToken(TokenType.FLOAT_LITERAL);
        return;
      }
      // If not followed by digit/f/e, don't consume '.' - let it be tokenized separately
    }

    // Check for exponent without decimal point (makes it a float)
    if (this.peek() === 'e' || this.peek() === 'E') {
      this.advance();
      if (this.peek() === '+' || this.peek() === '-') {
        this.advance();
      }

      const expStart = this.current;
      while (isDigit(this.peek())) {
        this.advance();
      }

      // Exponent must have at least one digit
      if (this.current === expStart) {
        throw new TokenizerError('Float exponent must have at least one digit', this.getLocation());
      }

      if (this.peek() === 'f') {
        this.advance();
      }
      this.addToken(TokenType.FLOAT_LITERAL);
      return;
    }

    // Integer - optional suffix (u, i, f)
    const suffix = this.peek();
    if (suffix === 'u' || suffix === 'i') {
      this.advance();
      this.addToken(TokenType.INT_LITERAL);
    } else if (suffix === 'f') {
      this.advance();
      this.addToken(TokenType.FLOAT_LITERAL);
    } else {
      this.addToken(TokenType.INT_LITERAL);
    }
  }

  /**
   * Skip line comment (// ...)
   */
  private skipLineComment(): void {
    while (this.peek() !== '\n' && !this.isAtEnd()) {
      this.advance();
    }
  }

  /**
   * Skip block comment
   * Handles WGSL block comments which do NOT nest
   */
  private skipBlockComment(): void {
    while (!this.isAtEnd()) {
      if (this.peek() === '*' && this.peekNext() === '/') {
        // End of comment
        this.advance(); // consume '*'
        this.advance(); // consume '/'
        return;
      }
      this.advance();
    }

    throw new TokenizerError('Unterminated block comment', this.getLocation());
  }

  /**
   * Helpers
   */
  private isHexDigit(char: string): boolean {
    return isDigit(char) ||
           (char >= 'a' && char <= 'f') ||
           (char >= 'A' && char <= 'F');
  }

  private match(expected: string): boolean {
    if (this.isAtEnd()) return false;
    if (this.source.charAt(this.current) !== expected) return false;

    // Consume the character - position tracking happens in advance() only
    this.advance();
    return true;
  }

  private advance(): string {
    const char = this.source.charAt(this.current);
    this.current++;

    if (char === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }

    return char;
  }

  private peek(): string {
    if (this.isAtEnd()) return '\0';
    return this.source.charAt(this.current);
  }

  private peekNext(): string {
    if (this.current + 1 >= this.source.length) return '\0';
    return this.source.charAt(this.current + 1);
  }

  private isAtEnd(): boolean {
    return this.current >= this.source.length;
  }

  private addToken(type: TokenType): void {
    const text = this.source.substring(this.start, this.current);
    const startLoc: SourceLocation = {
      line: this.startLine,
      column: this.startColumn,
      offset: this.start,
    };
    const endLoc: SourceLocation = {
      line: this.line,
      column: this.column,
      offset: this.current,
    };
    this.tokens.push(new Token(type, text, startLoc, endLoc));
  }

  private getLocation(): SourceLocation {
    return {
      line: this.line,
      column: this.column,
      offset: this.current,
    };
  }
}
