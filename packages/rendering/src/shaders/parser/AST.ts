/**
 * WGSL Abstract Syntax Tree Node Types
 * Epic 3.14 Phase 3 - Task 4
 *
 * Represents the structure of parsed WGSL shader code.
 * Focus on the subset needed for reflection and bind group layout extraction.
 */

import { SourceLocation } from '../tokenizer/Token';

/**
 * Base AST node
 */
export interface ASTNode {
  kind: string;
  location: SourceLocation;
}

/**
 * Top-level shader module
 */
export interface ShaderModule extends ASTNode {
  kind: 'ShaderModule';
  declarations: Declaration[];
}

/**
 * Top-level declarations
 */
export type Declaration =
  | StructDeclaration
  | VariableDeclaration
  | FunctionDeclaration
  | TypeAliasDeclaration;

/**
 * Struct declaration
 * struct MyStruct { field: type, ... }
 */
export interface StructDeclaration extends ASTNode {
  kind: 'StructDeclaration';
  name: string;
  members: StructMember[];
}

export interface StructMember extends ASTNode {
  kind: 'StructMember';
  name: string;
  type: TypeExpression;
  attributes: Attribute[];
}

/**
 * Variable declaration (uniform, storage, etc.)
 * @group(0) @binding(0) var<uniform> myUniform: MyType;
 */
export interface VariableDeclaration extends ASTNode {
  kind: 'VariableDeclaration';
  name: string;
  type: TypeExpression;
  storageClass: 'uniform' | 'storage' | 'private' | 'workgroup' | 'function' | null;
  accessMode: 'read' | 'write' | 'read_write' | null;
  attributes: Attribute[];
}

/**
 * Function declaration
 * @vertex fn main() -> @builtin(position) vec4f { ... }
 */
export interface FunctionDeclaration extends ASTNode {
  kind: 'FunctionDeclaration';
  name: string;
  parameters: FunctionParameter[];
  returnType: TypeExpression | null;
  attributes: Attribute[];
  body: Statement[];
}

export interface FunctionParameter extends ASTNode {
  kind: 'FunctionParameter';
  name: string;
  type: TypeExpression;
  attributes: Attribute[];
}

/**
 * Type alias
 * type MyType = vec4f;
 */
export interface TypeAliasDeclaration extends ASTNode {
  kind: 'TypeAliasDeclaration';
  name: string;
  type: TypeExpression;
}

/**
 * Type expressions
 */
export type TypeExpression =
  | SimpleType
  | ArrayType
  | TemplateType;

export interface SimpleType extends ASTNode {
  kind: 'SimpleType';
  name: string;
}

export interface ArrayType extends ASTNode {
  kind: 'ArrayType';
  elementType: TypeExpression;
  size: number | null; // null for runtime-sized arrays
}

export interface TemplateType extends ASTNode {
  kind: 'TemplateType';
  name: string; // e.g., 'texture_2d', 'sampler'
  parameters: TypeExpression[];
}

/**
 * Attributes (@group, @binding, @vertex, etc.)
 */
export interface Attribute extends ASTNode {
  kind: 'Attribute';
  name: string;
  arguments: AttributeArgument[];
}

export type AttributeArgument = number | string;

/**
 * Statements (simplified - we don't need full statement parsing for reflection)
 */
export type Statement =
  | VariableStatement
  | ReturnStatement
  | AssignmentStatement
  | IfStatement
  | ForStatement
  | WhileStatement
  | BlockStatement
  | ExpressionStatement;

export interface VariableStatement extends ASTNode {
  kind: 'VariableStatement';
  isConst: boolean;
  name: string;
  type: TypeExpression | null;
  initializer: Expression | null;
}

export interface ReturnStatement extends ASTNode {
  kind: 'ReturnStatement';
  expression: Expression | null;
}

export interface AssignmentStatement extends ASTNode {
  kind: 'AssignmentStatement';
  target: Expression;
  operator: '=' | '+=' | '-=' | '*=' | '/=' | '%=' | '&=' | '|=' | '^=' | '<<=' | '>>=';
  value: Expression;
}

export interface IfStatement extends ASTNode {
  kind: 'IfStatement';
  condition: Expression;
  thenBranch: Statement[];
  elseBranch: Statement[] | null;
}

export interface ForStatement extends ASTNode {
  kind: 'ForStatement';
  initializer: VariableStatement | null;
  condition: Expression | null;
  update: Statement | null;
  body: Statement[];
}

export interface WhileStatement extends ASTNode {
  kind: 'WhileStatement';
  condition: Expression;
  body: Statement[];
}

export interface BlockStatement extends ASTNode {
  kind: 'BlockStatement';
  statements: Statement[];
}

export interface ExpressionStatement extends ASTNode {
  kind: 'ExpressionStatement';
  expression: Expression;
}

/**
 * Expressions (simplified)
 */
export type Expression =
  | Identifier
  | Literal
  | BinaryExpression
  | UnaryExpression
  | CallExpression
  | MemberExpression
  | IndexExpression;

export interface Identifier extends ASTNode {
  kind: 'Identifier';
  name: string;
}

export interface Literal extends ASTNode {
  kind: 'Literal';
  value: number | boolean;
  raw: string;
}

export interface BinaryExpression extends ASTNode {
  kind: 'BinaryExpression';
  operator: string;
  left: Expression;
  right: Expression;
}

export interface UnaryExpression extends ASTNode {
  kind: 'UnaryExpression';
  operator: string;
  operand: Expression;
}

export interface CallExpression extends ASTNode {
  kind: 'CallExpression';
  callee: Expression;
  arguments: Expression[];
}

export interface MemberExpression extends ASTNode {
  kind: 'MemberExpression';
  object: Expression;
  property: string;
}

export interface IndexExpression extends ASTNode {
  kind: 'IndexExpression';
  object: Expression;
  index: Expression;
}

/**
 * Parser error
 */
export class ParseError extends Error {
  constructor(
    message: string,
    public location: SourceLocation
  ) {
    super(`${message} at line ${location.line}, column ${location.column}`);
    this.name = 'ParseError';
  }
}
