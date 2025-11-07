import type {
  ShaderSource,
  ShaderProgram,
  ShaderType,
  UniformType,
} from './types';

/**
 * Shader manager configuration
 */
export interface ShaderManagerConfig {
  maxPrograms?: number; // Maximum cached programs (default: 1000)
}

/**
 * Shader manager for compilation, linking, and caching
 *
 * Features:
 * - Automatic shader compilation and linking
 * - Program caching by ID with LRU eviction
 * - Attribute and uniform introspection
 * - Error reporting with line numbers
 * - Hot-reload support
 */
export class ShaderManager {
  private gl: WebGL2RenderingContext;
  private programs = new Map<string, ShaderProgram>();
  private shaderCache = new Map<string, WebGLShader>();
  private maxPrograms: number;
  private programAccessOrder: string[] = [];

  constructor(gl: WebGL2RenderingContext, config: ShaderManagerConfig = {}) {
    this.gl = gl;
    this.maxPrograms = config.maxPrograms ?? 1000;
  }

  /**
   * Create or retrieve cached shader program
   */
  createProgram(id: string, source: ShaderSource): ShaderProgram {
    // Return cached program if exists
    const cached = this.programs.get(id);
    if (cached) {
      return cached;
    }

    // Compile shaders
    const vertexShader = this.compileShader(source.vertex, 'vertex');
    const fragmentShader = this.compileShader(source.fragment, 'fragment');

    // Link program
    const program = this.linkProgram(vertexShader, fragmentShader);

    // Introspect attributes and uniforms
    const attributes = this.introspectAttributes(program);
    const uniforms = this.introspectUniforms(program);

    // Create shader program object
    const shaderProgram: ShaderProgram = {
      id,
      program,
      attributes,
      uniforms,
    };

    // Evict LRU program if at capacity
    if (this.programs.size >= this.maxPrograms) {
      const lruId = this.programAccessOrder.shift();
      if (lruId) {
        const lruProgram = this.programs.get(lruId);
        if (lruProgram) {
          this.gl.deleteProgram(lruProgram.program);
          this.programs.delete(lruId);
        }
      }
    }

    // Cache program
    this.programs.set(id, shaderProgram);
    this.programAccessOrder.push(id);

    // Detach and clean up shader objects (no longer needed after linking)
    this.gl.detachShader(program, vertexShader);
    this.gl.detachShader(program, fragmentShader);
    this.gl.deleteShader(vertexShader);
    this.gl.deleteShader(fragmentShader);

    return shaderProgram;
  }

  /**
   * Get cached shader program and update LRU
   */
  getProgram(id: string): ShaderProgram | null {
    const program = this.programs.get(id);
    if (program) {
      // Update LRU: move to end
      const index = this.programAccessOrder.indexOf(id);
      if (index !== -1) {
        this.programAccessOrder.splice(index, 1);
        this.programAccessOrder.push(id);
      }
    }
    return program ?? null;
  }

  /**
   * Check if program exists
   */
  hasProgram(id: string): boolean {
    return this.programs.has(id);
  }

  /**
   * Delete shader program and remove from cache
   */
  deleteProgram(id: string): void {
    const program = this.programs.get(id);
    if (program) {
      this.gl.deleteProgram(program.program);
      this.programs.delete(id);
      // Remove from LRU order
      const index = this.programAccessOrder.indexOf(id);
      if (index !== -1) {
        this.programAccessOrder.splice(index, 1);
      }
    }
  }

  /**
   * Reload shader program (for hot-reload)
   */
  reloadProgram(id: string, source: ShaderSource): ShaderProgram {
    this.deleteProgram(id);
    return this.createProgram(id, source);
  }

  /**
   * Get all program IDs
   */
  getProgramIds(): string[] {
    return Array.from(this.programs.keys());
  }

  /**
   * Compile shader from source
   */
  private compileShader(source: string, type: ShaderType): WebGLShader {
    const shaderType = type === 'vertex' ? this.gl.VERTEX_SHADER : this.gl.FRAGMENT_SHADER;
    const shader = this.gl.createShader(shaderType);

    if (!shader) {
      throw new Error(`Failed to create ${type} shader`);
    }

    // Add source and compile
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    // Check compilation status
    const success = this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS);
    if (!success) {
      const log = this.gl.getShaderInfoLog(shader);
      this.gl.deleteShader(shader);
      throw new Error(this.formatShaderError(type, source, log ?? 'Unknown error'));
    }

    return shader;
  }

  /**
   * Link vertex and fragment shaders into program
   */
  private linkProgram(vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram {
    const program = this.gl.createProgram();

    if (!program) {
      throw new Error('Failed to create shader program');
    }

    // Attach shaders and link
    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    // Check link status
    const success = this.gl.getProgramParameter(program, this.gl.LINK_STATUS);
    if (!success) {
      const log = this.gl.getProgramInfoLog(program);
      this.gl.deleteProgram(program);
      throw new Error(`Shader program link failed: ${log ?? 'Unknown error'}`);
    }

    return program;
  }

  /**
   * Introspect vertex attributes from program
   */
  private introspectAttributes(program: WebGLProgram): Map<string, number> {
    const attributes = new Map<string, number>();
    const count = this.gl.getProgramParameter(program, this.gl.ACTIVE_ATTRIBUTES);

    for (let i = 0; i < count; i++) {
      const info = this.gl.getActiveAttrib(program, i);
      if (info) {
        const location = this.gl.getAttribLocation(program, info.name);
        attributes.set(info.name, location);
      }
    }

    return attributes;
  }

  /**
   * Introspect uniforms from program
   */
  private introspectUniforms(program: WebGLProgram): Map<string, WebGLUniformLocation> {
    const uniforms = new Map<string, WebGLUniformLocation>();
    const count = this.gl.getProgramParameter(program, this.gl.ACTIVE_UNIFORMS);

    for (let i = 0; i < count; i++) {
      const info = this.gl.getActiveUniform(program, i);
      if (info) {
        const location = this.gl.getUniformLocation(program, info.name);
        if (location) {
          uniforms.set(info.name, location);
        }
      }
    }

    return uniforms;
  }

  /**
   * Format shader compilation error with line numbers
   */
  private formatShaderError(type: ShaderType, source: string, error: string): string {
    const lines = source.split('\n');
    const errorLines: string[] = [`${type.toUpperCase()} SHADER COMPILATION ERROR:`];

    // Parse error message for line numbers
    const lineRegex = /ERROR: \d+:(\d+):/g;
    const matches = Array.from(error.matchAll(lineRegex));

    if (matches.length > 0) {
      // Show context around error lines
      for (const match of matches) {
        const lineNum = parseInt(match[1], 10);
        const start = Math.max(0, lineNum - 3);
        const end = Math.min(lines.length, lineNum + 2);

        errorLines.push('\nContext:');
        for (let i = start; i < end; i++) {
          const prefix = i === lineNum - 1 ? '>>> ' : '    ';
          errorLines.push(`${prefix}${i + 1}: ${lines[i]}`);
        }
      }
    }

    errorLines.push('\nOriginal error:');
    errorLines.push(error);

    return errorLines.join('\n');
  }

  /**
   * Set uniform value on program
   */
  setUniform(
    program: ShaderProgram,
    name: string,
    type: UniformType,
    value: number | number[] | Float32Array
  ): void {
    const location = program.uniforms.get(name);
    if (!location) {
      console.warn(`Uniform '${name}' not found in program '${program.id}'`);
      return;
    }

    switch (type) {
      case 'int':
        this.gl.uniform1i(location, value as number);
        break;

      case 'float':
        this.gl.uniform1f(location, value as number);
        break;

      case 'vec2':
        if (Array.isArray(value)) {
          this.gl.uniform2fv(location, value);
        } else {
          this.gl.uniform2fv(location, value as Float32Array);
        }
        break;

      case 'vec3':
        if (Array.isArray(value)) {
          this.gl.uniform3fv(location, value);
        } else {
          this.gl.uniform3fv(location, value as Float32Array);
        }
        break;

      case 'vec4':
        if (Array.isArray(value)) {
          this.gl.uniform4fv(location, value);
        } else {
          this.gl.uniform4fv(location, value as Float32Array);
        }
        break;

      case 'mat3':
        if (Array.isArray(value)) {
          this.gl.uniformMatrix3fv(location, false, value);
        } else {
          this.gl.uniformMatrix3fv(location, false, value as Float32Array);
        }
        break;

      case 'mat4':
        if (Array.isArray(value)) {
          this.gl.uniformMatrix4fv(location, false, value);
        } else {
          this.gl.uniformMatrix4fv(location, false, value as Float32Array);
        }
        break;

      case 'sampler2d':
        this.gl.uniform1i(location, value as number);
        break;

      default:
        console.warn(`Unknown uniform type: ${type}`);
    }
  }

  /**
   * Bind vertex attribute to buffer
   */
  bindAttribute(
    program: ShaderProgram,
    name: string,
    size: number,
    type: number,
    normalized: boolean,
    stride: number,
    offset: number
  ): void {
    const location = program.attributes.get(name);
    if (location === undefined) {
      console.warn(`Attribute '${name}' not found in program '${program.id}'`);
      return;
    }

    this.gl.enableVertexAttribArray(location);
    this.gl.vertexAttribPointer(location, size, type, normalized, stride, offset);
  }

  /**
   * Validate shader program
   */
  validateProgram(program: ShaderProgram): boolean {
    this.gl.validateProgram(program.program);
    const valid = this.gl.getProgramParameter(program.program, this.gl.VALIDATE_STATUS);

    if (!valid) {
      const log = this.gl.getProgramInfoLog(program.program);
      console.error(`Program validation failed for '${program.id}': ${log}`);
      return false;
    }

    return true;
  }

  /**
   * Clean up all shader programs
   */
  dispose(): void {
    for (const program of this.programs.values()) {
      this.gl.deleteProgram(program.program);
    }
    this.programs.clear();
    this.shaderCache.clear();
  }
}
