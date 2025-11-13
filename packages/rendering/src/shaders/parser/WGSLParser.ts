/**
 * WGSL Parser
 * Epic 3.14 Phase 3 - Task 4
 *
 * Recursive descent parser that builds an AST from tokens.
 * Focuses on parsing the subset of WGSL needed for shader reflection.
 */

import { Token, TokenType } from '../tokenizer/Token';
import { WGSLTokenizer } from '../tokenizer/WGSLTokenizer';
import * as AST from './AST';

export class WGSLParser {
  private tokens: Token[] = [];
  private current = 0;

  /**
   * Parse WGSL source code into an AST
   */
  parse(source: string): AST.ShaderModule {
    // Tokenize first
    const tokenizer = new WGSLTokenizer();
    this.tokens = tokenizer.tokenize(source);
    this.current = 0;

    // Parse top-level declarations
    const declarations: AST.Declaration[] = [];

    while (!this.isAtEnd()) {
      // Skip EOF token
      if (this.peek().type === TokenType.EOF) {
        break;
      }

      const decl = this.parseDeclaration();
      if (decl) {
        declarations.push(decl);
      }
    }

    return {
      kind: 'ShaderModule',
      location: this.tokens[0]?.start || { line: 1, column: 1, offset: 0 },
      declarations,
    };
  }

  /**
   * Parse a top-level declaration
   */
  private parseDeclaration(): AST.Declaration | null {
    // Parse attributes first
    const attributes = this.parseAttributes();

    // Check what kind of declaration this is
    const token = this.peek();

    switch (token.type) {
      case TokenType.KEYWORD_STRUCT:
        return this.parseStructDeclaration();

      case TokenType.KEYWORD_VAR:
      case TokenType.KEYWORD_LET:
      case TokenType.KEYWORD_CONST:
      case TokenType.KEYWORD_OVERRIDE:
        return this.parseVariableDeclaration(attributes);

      case TokenType.KEYWORD_FN:
        return this.parseFunctionDeclaration(attributes);

      case TokenType.KEYWORD_TYPE:
        return this.parseTypeAliasDeclaration();

      default:
        throw new AST.ParseError(
          `Unexpected token in declaration: ${token.type}`,
          token.start
        );
    }
  }

  /**
   * Parse struct declaration
   * struct Name { member: type, ... }
   */
  private parseStructDeclaration(): AST.StructDeclaration {
    const start = this.advance(); // consume 'struct'
    const name = this.consume(TokenType.IDENTIFIER, 'Expected struct name');

    this.consume(TokenType.BRACE_LEFT, 'Expected {');

    const members: AST.StructMember[] = [];

    while (!this.check(TokenType.BRACE_RIGHT) && !this.isAtEnd()) {
      members.push(this.parseStructMember());

      // Optional comma or semicolon
      if (this.check(TokenType.COMMA) || this.check(TokenType.SEMICOLON)) {
        this.advance();
      }
    }

    this.consume(TokenType.BRACE_RIGHT, 'Expected }');

    return {
      kind: 'StructDeclaration',
      location: start.start,
      name: name.lexeme,
      members,
    };
  }

  /**
   * Parse struct member
   * @align(16) position: vec3f
   */
  private parseStructMember(): AST.StructMember {
    const attributes = this.parseAttributes();
    const name = this.consume(TokenType.IDENTIFIER, 'Expected member name');

    this.consume(TokenType.COLON, 'Expected :');

    const type = this.parseType();

    return {
      kind: 'StructMember',
      location: name.start,
      name: name.lexeme,
      type,
      attributes,
    };
  }

  /**
   * Parse variable declaration
   * @group(0) @binding(0) var<uniform> data: vec4f;
   */
  private parseVariableDeclaration(attributes: AST.Attribute[]): AST.VariableDeclaration {
    const start = this.advance(); // consume var/let/const/override

    // Parse storage class and access mode: var<uniform, read>
    let storageClass: AST.VariableDeclaration['storageClass'] = null;
    let accessMode: AST.VariableDeclaration['accessMode'] = null;

    if (this.check(TokenType.ANGLE_LEFT)) {
      this.advance(); // consume <

      const storageToken = this.advance();
      const validStorageClasses = ['uniform', 'storage', 'private', 'workgroup', 'function'];
      if (!validStorageClasses.includes(storageToken.lexeme)) {
        throw new AST.ParseError(
          `Invalid storage class: ${storageToken.lexeme}. Expected one of: ${validStorageClasses.join(', ')}`,
          storageToken.start
        );
      }
      storageClass = storageToken.lexeme as AST.VariableDeclaration['storageClass'];

      // Optional access mode
      if (this.check(TokenType.COMMA)) {
        this.advance();
        const accessToken = this.advance();
        const validAccessModes = ['read', 'write', 'read_write'];
        if (!validAccessModes.includes(accessToken.lexeme)) {
          throw new AST.ParseError(
            `Invalid access mode: ${accessToken.lexeme}. Expected one of: ${validAccessModes.join(', ')}`,
            accessToken.start
          );
        }
        accessMode = accessToken.lexeme as AST.VariableDeclaration['accessMode'];
      }

      this.consume(TokenType.ANGLE_RIGHT, 'Expected >');
    }

    const name = this.consume(TokenType.IDENTIFIER, 'Expected variable name');

    this.consume(TokenType.COLON, 'Expected :');

    const type = this.parseType();

    // Consume semicolon
    this.consume(TokenType.SEMICOLON, 'Expected ;');

    return {
      kind: 'VariableDeclaration',
      location: start.start,
      name: name.lexeme,
      type,
      storageClass,
      accessMode,
      attributes,
    };
  }

  /**
   * Parse function declaration
   * @vertex fn main(@location(0) pos: vec3f) -> @builtin(position) vec4f { ... }
   */
  private parseFunctionDeclaration(attributes: AST.Attribute[]): AST.FunctionDeclaration {
    const start = this.advance(); // consume 'fn'
    const name = this.consume(TokenType.IDENTIFIER, 'Expected function name');

    this.consume(TokenType.PAREN_LEFT, 'Expected (');

    // Parse parameters
    const parameters: AST.FunctionParameter[] = [];

    while (!this.check(TokenType.PAREN_RIGHT) && !this.isAtEnd()) {
      parameters.push(this.parseFunctionParameter());

      if (this.check(TokenType.COMMA)) {
        this.advance();
      } else {
        break;
      }
    }

    this.consume(TokenType.PAREN_RIGHT, 'Expected )');

    // Parse return type
    let returnType: AST.TypeExpression | null = null;

    if (this.check(TokenType.ARROW)) {
      this.advance(); // consume ->

      // Check for return attributes like @builtin(position)
      // For now, we'll skip them as they're on the return type
      this.parseAttributes();

      returnType = this.parseType();
    }

    // Parse function body
    this.consume(TokenType.BRACE_LEFT, 'Expected {');

    const body: AST.Statement[] = [];

    // For reflection purposes, we don't need to parse the full body
    // Just consume tokens until we hit the matching }
    let braceCount = 1;
    while (braceCount > 0 && !this.isAtEnd()) {
      const token = this.advance();
      if (token.type === TokenType.BRACE_LEFT) {
        braceCount++;
      } else if (token.type === TokenType.BRACE_RIGHT) {
        braceCount--;
      }
    }

    return {
      kind: 'FunctionDeclaration',
      location: start.start,
      name: name.lexeme,
      parameters,
      returnType,
      attributes,
      body,
    };
  }

  /**
   * Parse function parameter
   * @location(0) position: vec3f
   */
  private parseFunctionParameter(): AST.FunctionParameter {
    const attributes = this.parseAttributes();
    const name = this.consume(TokenType.IDENTIFIER, 'Expected parameter name');

    this.consume(TokenType.COLON, 'Expected :');

    const type = this.parseType();

    return {
      kind: 'FunctionParameter',
      location: name.start,
      name: name.lexeme,
      type,
      attributes,
    };
  }

  /**
   * Parse type alias
   * type MyType = vec4f;
   */
  private parseTypeAliasDeclaration(): AST.TypeAliasDeclaration {
    const start = this.advance(); // consume 'type'
    const name = this.consume(TokenType.IDENTIFIER, 'Expected type name');

    this.consume(TokenType.EQUAL, 'Expected =');

    const type = this.parseType();

    this.consume(TokenType.SEMICOLON, 'Expected ;');

    return {
      kind: 'TypeAliasDeclaration',
      location: start.start,
      name: name.lexeme,
      type,
    };
  }

  /**
   * Parse type expression
   * vec4f, array<f32, 10>, texture_2d<f32>, etc.
   */
  private parseType(): AST.TypeExpression {
    const token = this.advance();

    // Check for array type
    if (token.type === TokenType.KEYWORD_ARRAY || token.lexeme === 'array') {
      return this.parseArrayType(token);
    }

    // Check for template type (texture_2d<f32>, etc.)
    if (this.check(TokenType.ANGLE_LEFT)) {
      return this.parseTemplateType(token);
    }

    // Simple type
    return {
      kind: 'SimpleType',
      location: token.start,
      name: token.lexeme,
    };
  }

  /**
   * Parse array type
   * array<f32, 10> or array<f32>
   */
  private parseArrayType(arrayToken: Token): AST.ArrayType {
    this.consume(TokenType.ANGLE_LEFT, 'Expected <');

    const elementType = this.parseType();

    let size: number | null = null;

    if (this.check(TokenType.COMMA)) {
      this.advance();
      const sizeToken = this.consume(TokenType.INT_LITERAL, 'Expected array size');
      size = parseInt(sizeToken.lexeme, 10);
    }

    this.consume(TokenType.ANGLE_RIGHT, 'Expected >');

    return {
      kind: 'ArrayType',
      location: arrayToken.start,
      elementType,
      size,
    };
  }

  /**
   * Parse template type
   * texture_2d<f32>, sampler_comparison, etc.
   */
  private parseTemplateType(nameToken: Token): AST.TemplateType {
    this.consume(TokenType.ANGLE_LEFT, 'Expected <');

    const parameters: AST.TypeExpression[] = [];

    while (!this.check(TokenType.ANGLE_RIGHT) && !this.isAtEnd()) {
      parameters.push(this.parseType());

      if (this.check(TokenType.COMMA)) {
        this.advance();
      } else {
        break;
      }
    }

    this.consume(TokenType.ANGLE_RIGHT, 'Expected >');

    return {
      kind: 'TemplateType',
      location: nameToken.start,
      name: nameToken.lexeme,
      parameters,
    };
  }

  /**
   * Parse attributes
   * @group(0) @binding(1) @vertex
   */
  private parseAttributes(): AST.Attribute[] {
    const attributes: AST.Attribute[] = [];

    while (!this.isAtEnd() && (this.peek().type.toString().startsWith('ATTR_') || this.peek().lexeme.startsWith('@'))) {
      const attrToken = this.advance();
      const name = attrToken.lexeme.slice(1); // Remove @ prefix

      const args: AST.AttributeArgument[] = [];

      // Parse arguments if present
      if (this.check(TokenType.PAREN_LEFT)) {
        this.advance();

        while (!this.check(TokenType.PAREN_RIGHT) && !this.isAtEnd()) {
          const argToken = this.advance();

          if (argToken.type === TokenType.INT_LITERAL) {
            args.push(parseInt(argToken.lexeme, 10));
          } else if (argToken.type === TokenType.IDENTIFIER) {
            args.push(argToken.lexeme);
          } else {
            throw new AST.ParseError(
              `Unexpected attribute argument: ${argToken.type}`,
              argToken.start
            );
          }

          if (this.check(TokenType.COMMA)) {
            this.advance();
          } else {
            break;
          }
        }

        this.consume(TokenType.PAREN_RIGHT, 'Expected )');
      }

      attributes.push({
        kind: 'Attribute',
        location: attrToken.start,
        name,
        arguments: args,
      });
    }

    return attributes;
  }

  /**
   * Helper methods
   */
  private peek(): Token {
    return this.tokens[this.current];
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }

  private isAtEnd(): boolean {
    return this.current >= this.tokens.length || this.peek().type === TokenType.EOF;
  }

  private advance(): Token {
    if (!this.isAtEnd()) {
      this.current++;
    }
    return this.previous();
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) {
      return this.advance();
    }

    const token = this.peek();
    throw new AST.ParseError(
      `${message}, got ${token.type}`,
      token.start
    );
  }
}
