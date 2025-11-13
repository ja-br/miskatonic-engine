/**
 * WGSL Token Types and Token Class
 * Epic 3.14 Phase 3 - Task 3
 */

/**
 * All WGSL token types
 */
export enum TokenType {
  // Literals
  IDENTIFIER = 'IDENTIFIER',
  INT_LITERAL = 'INT_LITERAL',
  FLOAT_LITERAL = 'FLOAT_LITERAL',

  // Keywords (alphabetical order, WGSL 1.0 spec)
  KEYWORD_ARRAY = 'array',
  KEYWORD_ATOMIC = 'atomic',
  KEYWORD_BOOL = 'bool',
  KEYWORD_BREAK = 'break',
  KEYWORD_CASE = 'case',
  KEYWORD_CONST = 'const',
  KEYWORD_CONTINUE = 'continue',
  KEYWORD_DEFAULT = 'default',
  KEYWORD_DISCARD = 'discard',
  KEYWORD_ELSE = 'else',
  KEYWORD_ENABLE = 'enable',
  KEYWORD_F16 = 'f16',
  KEYWORD_F32 = 'f32',
  KEYWORD_FALSE = 'false',
  KEYWORD_FN = 'fn',
  KEYWORD_FOR = 'for',
  KEYWORD_I32 = 'i32',
  KEYWORD_IF = 'if',
  KEYWORD_LET = 'let',
  KEYWORD_LOOP = 'loop',
  KEYWORD_MAT2X2 = 'mat2x2',
  KEYWORD_MAT2X3 = 'mat2x3',
  KEYWORD_MAT2X4 = 'mat2x4',
  KEYWORD_MAT3X2 = 'mat3x2',
  KEYWORD_MAT3X3 = 'mat3x3',
  KEYWORD_MAT3X4 = 'mat3x4',
  KEYWORD_MAT4X2 = 'mat4x2',
  KEYWORD_MAT4X3 = 'mat4x3',
  KEYWORD_MAT4X4 = 'mat4x4',
  KEYWORD_OVERRIDE = 'override',
  KEYWORD_PTR = 'ptr',
  KEYWORD_RETURN = 'return',
  KEYWORD_SAMPLER = 'sampler',
  KEYWORD_SAMPLER_COMPARISON = 'sampler_comparison',
  KEYWORD_STRUCT = 'struct',
  KEYWORD_SWITCH = 'switch',
  KEYWORD_TEXTURE_1D = 'texture_1d',
  KEYWORD_TEXTURE_2D = 'texture_2d',
  KEYWORD_TEXTURE_2D_ARRAY = 'texture_2d_array',
  KEYWORD_TEXTURE_3D = 'texture_3d',
  KEYWORD_TEXTURE_CUBE = 'texture_cube',
  KEYWORD_TEXTURE_CUBE_ARRAY = 'texture_cube_array',
  KEYWORD_TEXTURE_MULTISAMPLED_2D = 'texture_multisampled_2d',
  KEYWORD_TEXTURE_STORAGE_1D = 'texture_storage_1d',
  KEYWORD_TEXTURE_STORAGE_2D = 'texture_storage_2d',
  KEYWORD_TEXTURE_STORAGE_2D_ARRAY = 'texture_storage_2d_array',
  KEYWORD_TEXTURE_STORAGE_3D = 'texture_storage_3d',
  KEYWORD_TEXTURE_DEPTH_2D = 'texture_depth_2d',
  KEYWORD_TEXTURE_DEPTH_2D_ARRAY = 'texture_depth_2d_array',
  KEYWORD_TEXTURE_DEPTH_CUBE = 'texture_depth_cube',
  KEYWORD_TEXTURE_DEPTH_CUBE_ARRAY = 'texture_depth_cube_array',
  KEYWORD_TEXTURE_DEPTH_MULTISAMPLED_2D = 'texture_depth_multisampled_2d',
  KEYWORD_TRUE = 'true',
  KEYWORD_TYPE = 'type',
  KEYWORD_U32 = 'u32',
  KEYWORD_VAR = 'var',
  KEYWORD_VEC2 = 'vec2',
  KEYWORD_VEC3 = 'vec3',
  KEYWORD_VEC4 = 'vec4',
  KEYWORD_WHILE = 'while',

  // Type aliases (f suffix)
  KEYWORD_VEC2F = 'vec2f',
  KEYWORD_VEC3F = 'vec3f',
  KEYWORD_VEC4F = 'vec4f',
  KEYWORD_VEC2I = 'vec2i',
  KEYWORD_VEC3I = 'vec3i',
  KEYWORD_VEC4I = 'vec4i',
  KEYWORD_VEC2U = 'vec2u',
  KEYWORD_VEC3U = 'vec3u',
  KEYWORD_VEC4U = 'vec4u',
  KEYWORD_MAT2X2F = 'mat2x2f',
  KEYWORD_MAT2X3F = 'mat2x3f',
  KEYWORD_MAT2X4F = 'mat2x4f',
  KEYWORD_MAT3X2F = 'mat3x2f',
  KEYWORD_MAT3X3F = 'mat3x3f',
  KEYWORD_MAT3X4F = 'mat3x4f',
  KEYWORD_MAT4X2F = 'mat4x2f',
  KEYWORD_MAT4X3F = 'mat4x3f',
  KEYWORD_MAT4X4F = 'mat4x4f',

  // Reserved keywords (for future use)
  RESERVED_KEYWORD = 'RESERVED_KEYWORD',

  // Attributes
  ATTR_ALIGN = '@align',
  ATTR_BINDING = '@binding',
  ATTR_BUILTIN = '@builtin',
  ATTR_COMPUTE = '@compute',
  ATTR_CONST = '@const',
  ATTR_FRAGMENT = '@fragment',
  ATTR_GROUP = '@group',
  ATTR_ID = '@id',
  ATTR_INTERPOLATE = '@interpolate',
  ATTR_INVARIANT = '@invariant',
  ATTR_LOCATION = '@location',
  ATTR_SIZE = '@size',
  ATTR_VERTEX = '@vertex',
  ATTR_WORKGROUP_SIZE = '@workgroup_size',

  // Operators and punctuation
  PAREN_LEFT = '(',
  PAREN_RIGHT = ')',
  BRACKET_LEFT = '[',
  BRACKET_RIGHT = ']',
  BRACE_LEFT = '{',
  BRACE_RIGHT = '}',
  ANGLE_LEFT = '<',
  ANGLE_RIGHT = '>',
  COMMA = ',',
  SEMICOLON = ';',
  COLON = ':',
  DOT = '.',
  ARROW = '->',

  // Assignment operators
  EQUAL = '=',
  PLUS_EQUAL = '+=',
  MINUS_EQUAL = '-=',
  STAR_EQUAL = '*=',
  SLASH_EQUAL = '/=',
  PERCENT_EQUAL = '%=',
  AND_EQUAL = '&=',
  OR_EQUAL = '|=',
  XOR_EQUAL = '^=',
  SHIFT_LEFT_EQUAL = '<<=',
  SHIFT_RIGHT_EQUAL = '>>=',

  // Comparison operators
  EQUAL_EQUAL = '==',
  NOT_EQUAL = '!=',
  LESS_EQUAL = '<=',
  GREATER_EQUAL = '>=',

  // Logical operators
  AND_AND = '&&',
  OR_OR = '||',
  BANG = '!',

  // Arithmetic operators
  PLUS = '+',
  MINUS = '-',
  STAR = '*',
  SLASH = '/',
  PERCENT = '%',

  // Bitwise operators
  AND = '&',
  OR = '|',
  XOR = '^',
  TILDE = '~',
  SHIFT_LEFT = '<<',
  SHIFT_RIGHT = '>>',

  // Special
  EOF = 'EOF',
  ERROR = 'ERROR',
}

/**
 * Source location information
 */
export interface SourceLocation {
  line: number;
  column: number;
  offset: number;
}

/**
 * Token with location information
 */
export class Token {
  constructor(
    public type: TokenType,
    public lexeme: string,
    public start: SourceLocation,
    public end: SourceLocation
  ) {}

  /**
   * Check if token is a keyword
   */
  isKeyword(): boolean {
    return this.type.startsWith('KEYWORD_') || this.type === TokenType.RESERVED_KEYWORD;
  }

  /**
   * Check if token is an attribute
   */
  isAttribute(): boolean {
    return this.type.startsWith('ATTR_');
  }

  /**
   * Check if token is a literal
   */
  isLiteral(): boolean {
    return this.type === TokenType.INT_LITERAL ||
           this.type === TokenType.FLOAT_LITERAL ||
           this.type === TokenType.KEYWORD_TRUE ||
           this.type === TokenType.KEYWORD_FALSE;
  }

  /**
   * Check if token is an operator
   */
  isOperator(): boolean {
    return this.type === TokenType.PLUS ||
           this.type === TokenType.MINUS ||
           this.type === TokenType.STAR ||
           this.type === TokenType.SLASH ||
           this.type === TokenType.PERCENT ||
           this.type === TokenType.AND ||
           this.type === TokenType.OR ||
           this.type === TokenType.XOR ||
           this.type === TokenType.TILDE ||
           this.type === TokenType.SHIFT_LEFT ||
           this.type === TokenType.SHIFT_RIGHT ||
           this.type === TokenType.EQUAL_EQUAL ||
           this.type === TokenType.NOT_EQUAL ||
           this.type === TokenType.ANGLE_LEFT ||
           this.type === TokenType.ANGLE_RIGHT ||
           this.type === TokenType.LESS_EQUAL ||
           this.type === TokenType.GREATER_EQUAL ||
           this.type === TokenType.AND_AND ||
           this.type === TokenType.OR_OR ||
           this.type === TokenType.BANG;
  }

  /**
   * Get human-readable string representation
   */
  toString(): string {
    return `Token(${this.type}, "${this.lexeme}", ${this.start.line}:${this.start.column})`;
  }
}

/**
 * WGSL reserved keywords (reserved for future use)
 * Per WGSL 1.0 spec section 3.6
 */
export const RESERVED_KEYWORDS = new Set([
  'asm', 'bf16', 'do', 'enum', 'f64', 'handle', 'i8', 'i16', 'i64',
  'mat', 'premerge', 'regardless', 'typedef', 'u8', 'u16', 'u64',
  'unless', 'using', 'vec', 'void',
  // Additional reserved keywords
  'private', 'workgroup', 'uniform', 'storage', 'function',
  'read', 'write', 'read_write',
]);

/**
 * WGSL keywords map
 */
export const KEYWORDS = new Map<string, TokenType>([
  ['array', TokenType.KEYWORD_ARRAY],
  ['atomic', TokenType.KEYWORD_ATOMIC],
  ['bool', TokenType.KEYWORD_BOOL],
  ['break', TokenType.KEYWORD_BREAK],
  ['case', TokenType.KEYWORD_CASE],
  ['const', TokenType.KEYWORD_CONST],
  ['continue', TokenType.KEYWORD_CONTINUE],
  ['default', TokenType.KEYWORD_DEFAULT],
  ['discard', TokenType.KEYWORD_DISCARD],
  ['else', TokenType.KEYWORD_ELSE],
  ['enable', TokenType.KEYWORD_ENABLE],
  ['f16', TokenType.KEYWORD_F16],
  ['f32', TokenType.KEYWORD_F32],
  ['false', TokenType.KEYWORD_FALSE],
  ['fn', TokenType.KEYWORD_FN],
  ['for', TokenType.KEYWORD_FOR],
  ['i32', TokenType.KEYWORD_I32],
  ['if', TokenType.KEYWORD_IF],
  ['let', TokenType.KEYWORD_LET],
  ['loop', TokenType.KEYWORD_LOOP],
  ['mat2x2', TokenType.KEYWORD_MAT2X2],
  ['mat2x3', TokenType.KEYWORD_MAT2X3],
  ['mat2x4', TokenType.KEYWORD_MAT2X4],
  ['mat3x2', TokenType.KEYWORD_MAT3X2],
  ['mat3x3', TokenType.KEYWORD_MAT3X3],
  ['mat3x4', TokenType.KEYWORD_MAT3X4],
  ['mat4x2', TokenType.KEYWORD_MAT4X2],
  ['mat4x3', TokenType.KEYWORD_MAT4X3],
  ['mat4x4', TokenType.KEYWORD_MAT4X4],
  ['override', TokenType.KEYWORD_OVERRIDE],
  ['ptr', TokenType.KEYWORD_PTR],
  ['return', TokenType.KEYWORD_RETURN],
  ['sampler', TokenType.KEYWORD_SAMPLER],
  ['sampler_comparison', TokenType.KEYWORD_SAMPLER_COMPARISON],
  ['struct', TokenType.KEYWORD_STRUCT],
  ['switch', TokenType.KEYWORD_SWITCH],
  ['texture_1d', TokenType.KEYWORD_TEXTURE_1D],
  ['texture_2d', TokenType.KEYWORD_TEXTURE_2D],
  ['texture_2d_array', TokenType.KEYWORD_TEXTURE_2D_ARRAY],
  ['texture_3d', TokenType.KEYWORD_TEXTURE_3D],
  ['texture_cube', TokenType.KEYWORD_TEXTURE_CUBE],
  ['texture_cube_array', TokenType.KEYWORD_TEXTURE_CUBE_ARRAY],
  ['texture_multisampled_2d', TokenType.KEYWORD_TEXTURE_MULTISAMPLED_2D],
  ['texture_storage_1d', TokenType.KEYWORD_TEXTURE_STORAGE_1D],
  ['texture_storage_2d', TokenType.KEYWORD_TEXTURE_STORAGE_2D],
  ['texture_storage_2d_array', TokenType.KEYWORD_TEXTURE_STORAGE_2D_ARRAY],
  ['texture_storage_3d', TokenType.KEYWORD_TEXTURE_STORAGE_3D],
  ['texture_depth_2d', TokenType.KEYWORD_TEXTURE_DEPTH_2D],
  ['texture_depth_2d_array', TokenType.KEYWORD_TEXTURE_DEPTH_2D_ARRAY],
  ['texture_depth_cube', TokenType.KEYWORD_TEXTURE_DEPTH_CUBE],
  ['texture_depth_cube_array', TokenType.KEYWORD_TEXTURE_DEPTH_CUBE_ARRAY],
  ['texture_depth_multisampled_2d', TokenType.KEYWORD_TEXTURE_DEPTH_MULTISAMPLED_2D],
  ['true', TokenType.KEYWORD_TRUE],
  ['type', TokenType.KEYWORD_TYPE],
  ['u32', TokenType.KEYWORD_U32],
  ['var', TokenType.KEYWORD_VAR],
  ['vec2', TokenType.KEYWORD_VEC2],
  ['vec3', TokenType.KEYWORD_VEC3],
  ['vec4', TokenType.KEYWORD_VEC4],
  ['while', TokenType.KEYWORD_WHILE],
  // Type aliases
  ['vec2f', TokenType.KEYWORD_VEC2F],
  ['vec3f', TokenType.KEYWORD_VEC3F],
  ['vec4f', TokenType.KEYWORD_VEC4F],
  ['vec2i', TokenType.KEYWORD_VEC2I],
  ['vec3i', TokenType.KEYWORD_VEC3I],
  ['vec4i', TokenType.KEYWORD_VEC4I],
  ['vec2u', TokenType.KEYWORD_VEC2U],
  ['vec3u', TokenType.KEYWORD_VEC3U],
  ['vec4u', TokenType.KEYWORD_VEC4U],
  ['mat2x2f', TokenType.KEYWORD_MAT2X2F],
  ['mat2x3f', TokenType.KEYWORD_MAT2X3F],
  ['mat2x4f', TokenType.KEYWORD_MAT2X4F],
  ['mat3x2f', TokenType.KEYWORD_MAT3X2F],
  ['mat3x3f', TokenType.KEYWORD_MAT3X3F],
  ['mat3x4f', TokenType.KEYWORD_MAT3X4F],
  ['mat4x2f', TokenType.KEYWORD_MAT4X2F],
  ['mat4x3f', TokenType.KEYWORD_MAT4X3F],
  ['mat4x4f', TokenType.KEYWORD_MAT4X4F],
]);
