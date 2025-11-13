/**
 * WGSL Tokenizer Tests
 * Epic 3.14 Phase 3 - Task 3
 */

import { describe, it, expect } from 'vitest';
import { WGSLTokenizer, TokenizerError } from '../../src/shaders/tokenizer/WGSLTokenizer';
import { TokenType } from '../../src/shaders/tokenizer/Token';

describe('WGSLTokenizer', () => {
  const tokenizer = new WGSLTokenizer();

  describe('Basic Tokens', () => {
    it('should tokenize single-character tokens', () => {
      const tokens = tokenizer.tokenize('()[]{}.,;:');

      expect(tokens).toHaveLength(11); // 10 tokens + EOF
      expect(tokens[0].type).toBe(TokenType.PAREN_LEFT);
      expect(tokens[1].type).toBe(TokenType.PAREN_RIGHT);
      expect(tokens[2].type).toBe(TokenType.BRACKET_LEFT);
      expect(tokens[3].type).toBe(TokenType.BRACKET_RIGHT);
      expect(tokens[4].type).toBe(TokenType.BRACE_LEFT);
      expect(tokens[5].type).toBe(TokenType.BRACE_RIGHT);
      expect(tokens[6].type).toBe(TokenType.DOT);
      expect(tokens[7].type).toBe(TokenType.COMMA);
      expect(tokens[8].type).toBe(TokenType.SEMICOLON);
      expect(tokens[9].type).toBe(TokenType.COLON);
      expect(tokens[10].type).toBe(TokenType.EOF);
    });

    it('should tokenize operators', () => {
      const tokens = tokenizer.tokenize('+ - * / %');

      expect(tokens).toHaveLength(6); // 5 + EOF
      expect(tokens[0].type).toBe(TokenType.PLUS);
      expect(tokens[1].type).toBe(TokenType.MINUS);
      expect(tokens[2].type).toBe(TokenType.STAR);
      expect(tokens[3].type).toBe(TokenType.SLASH);
      expect(tokens[4].type).toBe(TokenType.PERCENT);
    });

    it('should tokenize multi-character operators', () => {
      const tokens = tokenizer.tokenize('<< >> <= >= == != && ||');

      expect(tokens[0].type).toBe(TokenType.SHIFT_LEFT);
      expect(tokens[1].type).toBe(TokenType.SHIFT_RIGHT);
      expect(tokens[2].type).toBe(TokenType.LESS_EQUAL);
      expect(tokens[3].type).toBe(TokenType.GREATER_EQUAL);
      expect(tokens[4].type).toBe(TokenType.EQUAL_EQUAL);
      expect(tokens[5].type).toBe(TokenType.NOT_EQUAL);
      expect(tokens[6].type).toBe(TokenType.AND_AND);
      expect(tokens[7].type).toBe(TokenType.OR_OR);
    });

    it('should tokenize arrow', () => {
      const tokens = tokenizer.tokenize('->');
      expect(tokens[0].type).toBe(TokenType.ARROW);
    });

    it('should tokenize compound assignment operators', () => {
      const tokens = tokenizer.tokenize('+= -= *= /= %= &= |= ^= <<= >>=');

      expect(tokens[0].type).toBe(TokenType.PLUS_EQUAL);
      expect(tokens[1].type).toBe(TokenType.MINUS_EQUAL);
      expect(tokens[2].type).toBe(TokenType.STAR_EQUAL);
      expect(tokens[3].type).toBe(TokenType.SLASH_EQUAL);
      expect(tokens[4].type).toBe(TokenType.PERCENT_EQUAL);
      expect(tokens[5].type).toBe(TokenType.AND_EQUAL);
      expect(tokens[6].type).toBe(TokenType.OR_EQUAL);
      expect(tokens[7].type).toBe(TokenType.XOR_EQUAL);
      expect(tokens[8].type).toBe(TokenType.SHIFT_LEFT_EQUAL);
      expect(tokens[9].type).toBe(TokenType.SHIFT_RIGHT_EQUAL);
    });
  });

  describe('Keywords', () => {
    it('should tokenize basic keywords', () => {
      const tokens = tokenizer.tokenize('fn let var const if else for while return break continue');

      expect(tokens[0].type).toBe(TokenType.KEYWORD_FN);
      expect(tokens[1].type).toBe(TokenType.KEYWORD_LET);
      expect(tokens[2].type).toBe(TokenType.KEYWORD_VAR);
      expect(tokens[3].type).toBe(TokenType.KEYWORD_CONST);
      expect(tokens[4].type).toBe(TokenType.KEYWORD_IF);
      expect(tokens[5].type).toBe(TokenType.KEYWORD_ELSE);
      expect(tokens[6].type).toBe(TokenType.KEYWORD_FOR);
      expect(tokens[7].type).toBe(TokenType.KEYWORD_WHILE);
      expect(tokens[8].type).toBe(TokenType.KEYWORD_RETURN);
      expect(tokens[9].type).toBe(TokenType.KEYWORD_BREAK);
      expect(tokens[10].type).toBe(TokenType.KEYWORD_CONTINUE);
    });

    it('should tokenize type keywords', () => {
      const tokens = tokenizer.tokenize('f32 i32 u32 bool vec2 vec3 vec4 mat4x4');

      expect(tokens[0].type).toBe(TokenType.KEYWORD_F32);
      expect(tokens[1].type).toBe(TokenType.KEYWORD_I32);
      expect(tokens[2].type).toBe(TokenType.KEYWORD_U32);
      expect(tokens[3].type).toBe(TokenType.KEYWORD_BOOL);
      expect(tokens[4].type).toBe(TokenType.KEYWORD_VEC2);
      expect(tokens[5].type).toBe(TokenType.KEYWORD_VEC3);
      expect(tokens[6].type).toBe(TokenType.KEYWORD_VEC4);
      expect(tokens[7].type).toBe(TokenType.KEYWORD_MAT4X4);
    });

    it('should tokenize type suffix keywords', () => {
      const tokens = tokenizer.tokenize('vec2f vec3f vec4f vec2i vec3i vec4i mat2x2f mat4x4f');

      expect(tokens[0].type).toBe(TokenType.KEYWORD_VEC2F);
      expect(tokens[1].type).toBe(TokenType.KEYWORD_VEC3F);
      expect(tokens[2].type).toBe(TokenType.KEYWORD_VEC4F);
      expect(tokens[3].type).toBe(TokenType.KEYWORD_VEC2I);
      expect(tokens[4].type).toBe(TokenType.KEYWORD_VEC3I);
      expect(tokens[5].type).toBe(TokenType.KEYWORD_VEC4I);
      expect(tokens[6].type).toBe(TokenType.KEYWORD_MAT2X2F);
      expect(tokens[7].type).toBe(TokenType.KEYWORD_MAT4X4F);
    });

    it('should tokenize texture keywords', () => {
      const tokens = tokenizer.tokenize('texture_2d sampler texture_cube texture_storage_2d');

      expect(tokens[0].type).toBe(TokenType.KEYWORD_TEXTURE_2D);
      expect(tokens[1].type).toBe(TokenType.KEYWORD_SAMPLER);
      expect(tokens[2].type).toBe(TokenType.KEYWORD_TEXTURE_CUBE);
      expect(tokens[3].type).toBe(TokenType.KEYWORD_TEXTURE_STORAGE_2D);
    });

    it('should tokenize reserved keywords', () => {
      const tokens = tokenizer.tokenize('void enum typedef');

      expect(tokens[0].type).toBe(TokenType.RESERVED_KEYWORD);
      expect(tokens[1].type).toBe(TokenType.RESERVED_KEYWORD);
      expect(tokens[2].type).toBe(TokenType.RESERVED_KEYWORD);
    });
  });

  describe('Attributes', () => {
    it('should tokenize common attributes', () => {
      const tokens = tokenizer.tokenize('@group @binding @location @builtin');

      expect(tokens[0].type).toBe(TokenType.ATTR_GROUP);
      expect(tokens[1].type).toBe(TokenType.ATTR_BINDING);
      expect(tokens[2].type).toBe(TokenType.ATTR_LOCATION);
      expect(tokens[3].type).toBe(TokenType.ATTR_BUILTIN);
    });

    it('should tokenize entry point attributes', () => {
      const tokens = tokenizer.tokenize('@vertex @fragment @compute @workgroup_size');

      expect(tokens[0].type).toBe(TokenType.ATTR_VERTEX);
      expect(tokens[1].type).toBe(TokenType.ATTR_FRAGMENT);
      expect(tokens[2].type).toBe(TokenType.ATTR_COMPUTE);
      expect(tokens[3].type).toBe(TokenType.ATTR_WORKGROUP_SIZE);
    });

    it('should error on unknown attribute', () => {
      expect(() => {
        tokenizer.tokenize('@unknown');
      }).toThrow(TokenizerError);
    });
  });

  describe('Identifiers', () => {
    it('should tokenize simple identifiers', () => {
      const tokens = tokenizer.tokenize('foo bar_baz MyStruct');

      expect(tokens[0].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[0].lexeme).toBe('foo');
      expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[1].lexeme).toBe('bar_baz');
      expect(tokens[2].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[2].lexeme).toBe('MyStruct');
    });

    it('should allow underscores in identifiers', () => {
      const tokens = tokenizer.tokenize('_foo foo_ _bar_baz_');

      expect(tokens[0].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[2].type).toBe(TokenType.IDENTIFIER);
    });

    it('should distinguish identifiers from keywords', () => {
      const tokens = tokenizer.tokenize('fn fn2 myFn');

      expect(tokens[0].type).toBe(TokenType.KEYWORD_FN);
      expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[2].type).toBe(TokenType.IDENTIFIER);
    });
  });

  describe('Number Literals - Integers', () => {
    it('should tokenize decimal integers', () => {
      const tokens = tokenizer.tokenize('0 42 123456');

      expect(tokens[0].type).toBe(TokenType.INT_LITERAL);
      expect(tokens[0].lexeme).toBe('0');
      expect(tokens[1].type).toBe(TokenType.INT_LITERAL);
      expect(tokens[1].lexeme).toBe('42');
      expect(tokens[2].type).toBe(TokenType.INT_LITERAL);
      expect(tokens[2].lexeme).toBe('123456');
    });

    it('should tokenize integers with suffixes', () => {
      const tokens = tokenizer.tokenize('42u 42i');

      expect(tokens[0].type).toBe(TokenType.INT_LITERAL);
      expect(tokens[0].lexeme).toBe('42u');
      expect(tokens[1].type).toBe(TokenType.INT_LITERAL);
      expect(tokens[1].lexeme).toBe('42i');
    });

    it('should tokenize hex integers', () => {
      const tokens = tokenizer.tokenize('0x0 0xFF 0xDEADBEEF 0x123ABC');

      expect(tokens[0].type).toBe(TokenType.INT_LITERAL);
      expect(tokens[1].type).toBe(TokenType.INT_LITERAL);
      expect(tokens[2].type).toBe(TokenType.INT_LITERAL);
      expect(tokens[3].type).toBe(TokenType.INT_LITERAL);
    });

    it('should tokenize hex integers with suffixes', () => {
      const tokens = tokenizer.tokenize('0xFFu 0xABCi');

      expect(tokens[0].type).toBe(TokenType.INT_LITERAL);
      expect(tokens[1].type).toBe(TokenType.INT_LITERAL);
    });

    it('should error on hex literal without digits', () => {
      expect(() => {
        tokenizer.tokenize('0x');
      }).toThrow(TokenizerError);

      expect(() => {
        tokenizer.tokenize('0xG');
      }).toThrow(TokenizerError);
    });
  });

  describe('Number Literals - Floats', () => {
    it('should tokenize decimal floats', () => {
      const tokens = tokenizer.tokenize('1.0 3.14159 0.5');

      expect(tokens[0].type).toBe(TokenType.FLOAT_LITERAL);
      expect(tokens[1].type).toBe(TokenType.FLOAT_LITERAL);
      expect(tokens[2].type).toBe(TokenType.FLOAT_LITERAL);
    });

    it('should tokenize floats with f suffix', () => {
      const tokens = tokenizer.tokenize('1.0f 42f 1.f');

      expect(tokens[0].type).toBe(TokenType.FLOAT_LITERAL);
      expect(tokens[1].type).toBe(TokenType.FLOAT_LITERAL);
      expect(tokens[2].type).toBe(TokenType.FLOAT_LITERAL);
      expect(tokens[2].lexeme).toBe('1.f');
    });

    it('should tokenize floats with exponents', () => {
      const tokens = tokenizer.tokenize('1e10 1.5e-3 2.0E+5 1e5f');

      expect(tokens[0].type).toBe(TokenType.FLOAT_LITERAL);
      expect(tokens[1].type).toBe(TokenType.FLOAT_LITERAL);
      expect(tokens[2].type).toBe(TokenType.FLOAT_LITERAL);
      expect(tokens[3].type).toBe(TokenType.FLOAT_LITERAL);
    });

    it('should tokenize hex floats', () => {
      const tokens = tokenizer.tokenize('0x1.8p3 0x1p-2f 0xA.Bp10');

      expect(tokens[0].type).toBe(TokenType.FLOAT_LITERAL);
      expect(tokens[1].type).toBe(TokenType.FLOAT_LITERAL);
      expect(tokens[2].type).toBe(TokenType.FLOAT_LITERAL);
    });

    it('should tokenize hex floats without fractional part', () => {
      const tokens = tokenizer.tokenize('0x1p3 0xAp-5f');

      expect(tokens[0].type).toBe(TokenType.FLOAT_LITERAL);
      expect(tokens[1].type).toBe(TokenType.FLOAT_LITERAL);
    });

    it('should error on malformed float exponents', () => {
      expect(() => {
        tokenizer.tokenize('1e');
      }).toThrow(TokenizerError);

      expect(() => {
        tokenizer.tokenize('1.5e+');
      }).toThrow(TokenizerError);
    });

    it('should error on hex float without exponent', () => {
      expect(() => {
        tokenizer.tokenize('0x1.8');
      }).toThrow(TokenizerError);
    });

    it('should error on hex float with malformed exponent', () => {
      expect(() => {
        tokenizer.tokenize('0x1.8p');
      }).toThrow(TokenizerError);

      expect(() => {
        tokenizer.tokenize('0x1p+');
      }).toThrow(TokenizerError);
    });
  });

  describe('Comments', () => {
    it('should skip line comments', () => {
      const tokens = tokenizer.tokenize('let x = 42; // This is a comment');

      expect(tokens).toHaveLength(6); // let, x, =, 42, ;, EOF
      expect(tokens[5].type).toBe(TokenType.EOF);
    });

    it('should skip block comments', () => {
      const tokens = tokenizer.tokenize('let /* comment */ x = 42;');

      expect(tokens).toHaveLength(6); // let, x, =, 42, ;, EOF
      expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
    });

    it('should skip multi-line block comments', () => {
      const source = `let x = /*
        multi-line
        comment
      */ 42;`;

      const tokens = tokenizer.tokenize(source);
      expect(tokens).toHaveLength(6);
    });

    it('should error on unterminated block comment', () => {
      expect(() => {
        tokenizer.tokenize('let x = /* unterminated');
      }).toThrow(TokenizerError);
    });

    it('should NOT nest block comments', () => {
      // Per WGSL spec, block comments don't nest
      // /* outer /* inner */ still_inside_outer */
      // The first */ closes the comment, leaving "still_inside_outer */" as code
      const tokens = tokenizer.tokenize('/* a /* b */ c */');

      // Should have tokens for "c" and "*/" which will cause parse errors
      expect(tokens.length).toBeGreaterThan(2);
    });
  });

  describe('Source Location Tracking', () => {
    it('should track line and column', () => {
      const source = 'let x\n= 42;';
      const tokens = tokenizer.tokenize(source);

      expect(tokens[0].start.line).toBe(1);
      expect(tokens[0].start.column).toBe(1);

      expect(tokens[2].start.line).toBe(2);
      expect(tokens[2].start.column).toBe(1);
    });

    it('should track multi-character token locations', () => {
      const tokens = tokenizer.tokenize('x << 2');

      expect(tokens[1].type).toBe(TokenType.SHIFT_LEFT);
      expect(tokens[1].start.column).toBe(3);
      expect(tokens[1].end.column).toBe(5);
    });

    it('should provide accurate error locations', () => {
      try {
        tokenizer.tokenize('let x = $invalid;');
      } catch (error) {
        expect(error).toBeInstanceOf(TokenizerError);
        expect((error as TokenizerError).location.column).toBe(9);
      }
    });
  });

  describe('Security and Edge Cases', () => {
    it('should reject shaders larger than 1MB', () => {
      const largeShader = 'let x = 0; '.repeat(100_000); // ~1.1MB

      expect(() => {
        tokenizer.tokenize(largeShader);
      }).toThrow(TokenizerError);
      expect(() => {
        tokenizer.tokenize(largeShader);
      }).toThrow(/exceeds maximum size/);
    });

    it('should handle empty input', () => {
      const tokens = tokenizer.tokenize('');

      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe(TokenType.EOF);
    });

    it('should handle whitespace-only input', () => {
      const tokens = tokenizer.tokenize('   \t\n  ');

      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe(TokenType.EOF);
    });

    it('should reject string literals', () => {
      expect(() => {
        tokenizer.tokenize('"string"');
      }).toThrow(TokenizerError);

      expect(() => {
        tokenizer.tokenize("'string'");
      }).toThrow(TokenizerError);
    });

    it('should error on unexpected characters', () => {
      expect(() => {
        tokenizer.tokenize('let x = $;');
      }).toThrow(TokenizerError);

      expect(() => {
        tokenizer.tokenize('let x = `;');
      }).toThrow(TokenizerError);
    });
  });

  describe('Real-World Shader Fragments', () => {
    it('should tokenize bind group declaration', () => {
      const tokens = tokenizer.tokenize('@group(0) @binding(0) var<uniform> data: vec4f;');

      expect(tokens[0].type).toBe(TokenType.ATTR_GROUP);
      expect(tokens[1].type).toBe(TokenType.PAREN_LEFT);
      expect(tokens[2].type).toBe(TokenType.INT_LITERAL);
      expect(tokens[3].type).toBe(TokenType.PAREN_RIGHT);
      expect(tokens[4].type).toBe(TokenType.ATTR_BINDING);
    });

    it('should tokenize vertex shader entry point', () => {
      const source = '@vertex fn vs_main() -> @builtin(position) vec4f { return vec4f(0.0); }';
      const tokens = tokenizer.tokenize(source);

      expect(tokens[0].type).toBe(TokenType.ATTR_VERTEX);
      expect(tokens[1].type).toBe(TokenType.KEYWORD_FN);
      expect(tokens[2].type).toBe(TokenType.IDENTIFIER);
    });

    it('should tokenize struct definition', () => {
      const source = `struct VertexInput {
        @location(0) position: vec3f,
        @location(1) normal: vec3f,
      }`;

      const tokens = tokenizer.tokenize(source);
      expect(tokens[0].type).toBe(TokenType.KEYWORD_STRUCT);
      expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[2].type).toBe(TokenType.BRACE_LEFT);
    });
  });
});
