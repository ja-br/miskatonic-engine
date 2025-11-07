/**
 * Core rendering types for Miskatonic Engine
 *
 * Designed for WebGL2 with future WebGPU support
 */

/**
 * Rendering backend type
 */
export enum RenderBackend {
  WEBGL2 = 'webgl2',
  WEBGPU = 'webgpu', // Future support
}

/**
 * Primitive rendering modes
 */
export enum PrimitiveMode {
  POINTS = 0, // WebGL POINTS
  LINES = 1, // WebGL LINES
  LINE_STRIP = 3, // WebGL LINE_STRIP
  TRIANGLES = 4, // WebGL TRIANGLES
  TRIANGLE_STRIP = 5, // WebGL TRIANGLE_STRIP
}

/**
 * Shader types
 */
export enum ShaderType {
  VERTEX = 'vertex',
  FRAGMENT = 'fragment',
}

/**
 * Texture formats
 */
export enum TextureFormat {
  RGB = 'rgb',
  RGBA = 'rgba',
  DEPTH = 'depth',
  DEPTH_STENCIL = 'depth_stencil',
}

/**
 * Texture filtering modes
 */
export enum TextureFilter {
  NEAREST = 'nearest',
  LINEAR = 'linear',
  NEAREST_MIPMAP_NEAREST = 'nearest_mipmap_nearest',
  LINEAR_MIPMAP_NEAREST = 'linear_mipmap_nearest',
  NEAREST_MIPMAP_LINEAR = 'nearest_mipmap_linear',
  LINEAR_MIPMAP_LINEAR = 'linear_mipmap_linear',
}

/**
 * Texture wrapping modes
 */
export enum TextureWrap {
  REPEAT = 'repeat',
  CLAMP_TO_EDGE = 'clamp_to_edge',
  MIRRORED_REPEAT = 'mirrored_repeat',
}

/**
 * Blend modes
 */
export enum BlendMode {
  NONE = 'none',
  ALPHA = 'alpha',
  ADDITIVE = 'additive',
  MULTIPLY = 'multiply',
}

/**
 * Depth test modes
 */
export enum DepthTest {
  NEVER = 'never',
  LESS = 'less',
  EQUAL = 'equal',
  LEQUAL = 'lequal',
  GREATER = 'greater',
  NOTEQUAL = 'notequal',
  GEQUAL = 'gequal',
  ALWAYS = 'always',
}

/**
 * Cull modes
 */
export enum CullMode {
  NONE = 'none',
  FRONT = 'front',
  BACK = 'back',
  FRONT_AND_BACK = 'front_and_back',
}

/**
 * Vertex attribute data types
 */
export enum AttributeType {
  FLOAT = 'float',
  VEC2 = 'vec2',
  VEC3 = 'vec3',
  VEC4 = 'vec4',
  MAT3 = 'mat3',
  MAT4 = 'mat4',
}

/**
 * Uniform data types
 */
export enum UniformType {
  INT = 'int',
  FLOAT = 'float',
  VEC2 = 'vec2',
  VEC3 = 'vec3',
  VEC4 = 'vec4',
  MAT3 = 'mat3',
  MAT4 = 'mat4',
  SAMPLER2D = 'sampler2d',
}

/**
 * Buffer usage hint
 */
export enum BufferUsage {
  STATIC_DRAW = 'static_draw',
  DYNAMIC_DRAW = 'dynamic_draw',
  STREAM_DRAW = 'stream_draw',
}

/**
 * Vertex attribute descriptor
 */
export interface VertexAttribute {
  name: string;
  type: AttributeType;
  location: number;
  normalized?: boolean;
  offset?: number;
  stride?: number;
}

/**
 * Uniform descriptor
 */
export interface Uniform {
  name: string;
  type: UniformType;
  value: number | number[] | Float32Array;
}

/**
 * Shader source code
 */
export interface ShaderSource {
  vertex: string;
  fragment: string;
}

/**
 * Compiled shader program
 */
export interface ShaderProgram {
  id: string;
  program: WebGLProgram;
  attributes: Map<string, number>; // name -> location
  uniforms: Map<string, WebGLUniformLocation>; // name -> location
}

/**
 * Render state
 */
export interface RenderState {
  blendMode: BlendMode;
  depthTest: DepthTest;
  depthWrite: boolean;
  cullMode: CullMode;
  viewport?: { x: number; y: number; width: number; height: number };
  scissor?: { x: number; y: number; width: number; height: number };
}

/**
 * Default render state
 */
export const DEFAULT_RENDER_STATE: RenderState = {
  blendMode: BlendMode.NONE,
  depthTest: DepthTest.LESS,
  depthWrite: true,
  cullMode: CullMode.BACK,
};

/**
 * Render command types
 */
export enum RenderCommandType {
  DRAW = 'draw',
  CLEAR = 'clear',
  SET_STATE = 'set_state',
  SET_SHADER = 'set_shader',
  SET_UNIFORM = 'set_uniform',
  BIND_TEXTURE = 'bind_texture',
}

/**
 * Draw command
 */
export interface DrawCommand {
  type: RenderCommandType.DRAW;
  shader: string; // Shader program ID
  mode: PrimitiveMode;
  vertexBuffer: WebGLBuffer;
  indexBuffer?: WebGLBuffer;
  vertexCount: number;
  instanceCount?: number;
  uniforms?: Map<string, Uniform>;
  textures?: Map<number, WebGLTexture>; // texture unit -> texture
  state?: Partial<RenderState>;
}

/**
 * Clear command
 */
export interface ClearCommand {
  type: RenderCommandType.CLEAR;
  color?: [number, number, number, number];
  depth?: number;
  stencil?: number;
}

/**
 * Set state command
 */
export interface SetStateCommand {
  type: RenderCommandType.SET_STATE;
  state: Partial<RenderState>;
}

/**
 * Set shader command
 */
export interface SetShaderCommand {
  type: RenderCommandType.SET_SHADER;
  shaderId: string;
}

/**
 * Set uniform command
 */
export interface SetUniformCommand {
  type: RenderCommandType.SET_UNIFORM;
  uniform: Uniform;
}

/**
 * Bind texture command
 */
export interface BindTextureCommand {
  type: RenderCommandType.BIND_TEXTURE;
  texture: WebGLTexture;
  unit: number;
}

/**
 * Union of all render commands
 */
export type RenderCommand =
  | DrawCommand
  | ClearCommand
  | SetStateCommand
  | SetShaderCommand
  | SetUniformCommand
  | BindTextureCommand;

/**
 * Rendering statistics
 */
export interface RenderStats {
  drawCalls: number;
  triangles: number;
  vertices: number;
  batches: number;
  shaderSwitches: number;
  textureBinds: number;
  stateChanges: number;
  frameTime: number; // milliseconds
}

/**
 * Renderer configuration
 */
export interface RendererConfig {
  canvas: HTMLCanvasElement;
  backend?: RenderBackend;
  antialias?: boolean;
  alpha?: boolean;
  depth?: boolean;
  stencil?: boolean;
  powerPreference?: 'default' | 'high-performance' | 'low-power';
  failIfMajorPerformanceCaveat?: boolean;
}
