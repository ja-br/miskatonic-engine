/**
 * Core rendering types for Miskatonic Engine
 *
 * WebGPU rendering engine
 */

/**
 * Rendering backend type
 */
export enum RenderBackend {
  WEBGPU = 'webgpu',
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
export type ShaderType = 'vertex' | 'fragment';

/**
 * Texture formats
 */
export type TextureFormat = 'rgb' | 'rgba' | 'depth' | 'depth_stencil';

/**
 * Texture filtering modes
 */
export type TextureFilter =
  | 'nearest'
  | 'linear'
  | 'nearest_mipmap_nearest'
  | 'linear_mipmap_nearest'
  | 'nearest_mipmap_linear'
  | 'linear_mipmap_linear';

/**
 * Texture wrapping modes
 */
export type TextureWrap = 'repeat' | 'clamp_to_edge' | 'mirrored_repeat';

/**
 * Blend modes
 */
export type BlendMode = 'none' | 'alpha' | 'additive' | 'multiply';

/**
 * Depth test modes
 */
export type DepthTest = 'never' | 'less' | 'equal' | 'lequal' | 'greater' | 'notequal' | 'gequal' | 'always';

/**
 * Cull modes
 */
export type CullMode = 'none' | 'front' | 'back' | 'front_and_back';

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
export type BufferUsage = 'static_draw' | 'dynamic_draw' | 'stream_draw';

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
  blendMode: 'none',
  depthTest: 'less',
  depthWrite: true,
  cullMode: 'back',
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
  BIND_FRAMEBUFFER = 'bind_framebuffer',
}

/**
 * Vertex layout descriptor
 */
export interface VertexLayout {
  attributes: Array<{
    name: string;
    size: number; // 1-4 components
    type: 'float' | 'int' | 'byte' | 'short';
    normalized?: boolean;
    stride?: number;
    offset?: number;
  }>;
}

/**
 * Index buffer type
 */
export type IndexType = 'uint8' | 'uint16' | 'uint32';


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
 * Bind framebuffer command
 */
export interface BindFramebufferCommand {
  type: RenderCommandType.BIND_FRAMEBUFFER;
  framebufferId: string | null; // null = default framebuffer (screen)
}

/**
 * Union of all render commands
 * Note: DrawCommand removed - use unified DrawCommand from commands/DrawCommand.ts instead
 */
export type RenderCommand =
  | ClearCommand
  | SetStateCommand
  | SetShaderCommand
  | SetUniformCommand
  | BindTextureCommand
  | BindFramebufferCommand;

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
