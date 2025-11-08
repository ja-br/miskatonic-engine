import type {
  ShaderSource,
  ShaderProgram,
  ShaderType,
  UniformType,
} from './types';
import { ShaderLoader, type ShaderFeatures, type LoadedShader } from './ShaderLoader';

/**
 * Shader manager configuration
 */
export interface ShaderManagerConfig {
  maxPrograms?: number; // Maximum cached programs (default: 1000)
  basePath?: string; // Base path for shader files (default: 'src/shaders/')
  enableHotReload?: boolean; // Enable file watching for hot-reload (default: false)
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
 * - Shader file loading with includes
 * - Variant generation with feature defines
 */
export class ShaderManager {
  private gl: WebGL2RenderingContext;
  private programs = new Map<string, ShaderProgram>();
  private shaderCache = new Map<string, WebGLShader>();
  private maxPrograms: number;
  private programAccessOrder: string[] = [];

  // Shader loader for file loading and preprocessing
  private loader: ShaderLoader;

  // Variant cache: cache key -> LoadedShader
  private variantCache = new Map<string, LoadedShader>();

  // Track which programs use which variants (for hot-reload)
  private programToVariant = new Map<string, string>();
  private variantToPrograms = new Map<string, Set<string>>();

  constructor(gl: WebGL2RenderingContext, config: ShaderManagerConfig = {}) {
    this.gl = gl;
    this.maxPrograms = config.maxPrograms ?? 1000;

    // Initialize shader loader
    this.loader = new ShaderLoader({
      basePath: config.basePath,
      watchFiles: config.enableHotReload,
      cacheEnabled: true,
    });

    // Setup hot-reload if enabled
    if (config.enableHotReload) {
      this.setupHotReload();
    }
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
      // Update LRU: move to end (fix memory leak by removing ALL occurrences first)
      this.programAccessOrder = this.programAccessOrder.filter((item) => item !== id);
      this.programAccessOrder.push(id);
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

      // Remove from LRU order (fix memory leak - remove ALL occurrences)
      this.programAccessOrder = this.programAccessOrder.filter((item) => item !== id);

      // Remove from variant tracking
      const variantKey = this.programToVariant.get(id);
      if (variantKey) {
        this.programToVariant.delete(id);
        const programs = this.variantToPrograms.get(variantKey);
        if (programs) {
          programs.delete(id);
          if (programs.size === 0) {
            this.variantToPrograms.delete(variantKey);
          }
        }
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
   * Load shader from files with variant generation
   *
   * @param id - Unique shader ID
   * @param vertexPath - Path to vertex shader file
   * @param fragmentPath - Path to fragment shader file
   * @param features - Feature defines for variant generation
   * @returns Compiled shader program
   */
  async loadShader(
    id: string,
    vertexPath: string,
    fragmentPath: string,
    features: ShaderFeatures = {}
  ): Promise<ShaderProgram> {
    // Generate cache key for this variant
    const cacheKey = ShaderLoader.generateCacheKey(vertexPath, fragmentPath, features);

    // Check if variant is cached
    let loaded = this.variantCache.get(cacheKey);

    if (!loaded) {
      // Load and preprocess shader
      loaded = await this.loader.load(vertexPath, fragmentPath, features);
      this.variantCache.set(cacheKey, loaded);
    }

    // Create program from preprocessed source
    const program = this.createProgram(id, {
      vertex: loaded.vertexSource,
      fragment: loaded.fragmentSource,
    });

    // Track which variant this program uses (for hot-reload)
    this.programToVariant.set(id, cacheKey);
    if (!this.variantToPrograms.has(cacheKey)) {
      this.variantToPrograms.set(cacheKey, new Set());
    }
    this.variantToPrograms.get(cacheKey)!.add(id);

    return program;
  }

  /**
   * Get shader variant (create if doesn't exist)
   *
   * Convenience method for loading shader variants with different features.
   *
   * @param baseName - Base shader name (e.g., 'pbr')
   * @param features - Feature defines
   * @returns Compiled shader program
   */
  async getVariant(baseName: string, features: ShaderFeatures = {}): Promise<ShaderProgram> {
    // Generate variant ID
    const featureString = Object.keys(features)
      .filter((key) => features[key])
      .sort()
      .join('_');
    const variantId = featureString ? `${baseName}_${featureString}` : baseName;

    // Check if already compiled
    const cached = this.getProgram(variantId);
    if (cached) {
      return cached;
    }

    // Load shader variant
    const vertexPath = `vertex/${baseName}.vert.glsl`;
    const fragmentPath = `fragment/${baseName}.frag.glsl`;

    return this.loadShader(variantId, vertexPath, fragmentPath, features);
  }

  /**
   * Precompile shader variant
   *
   * Useful for warming up cache before rendering.
   *
   * @param baseName - Base shader name
   * @param features - Feature defines
   */
  async precompile(baseName: string, features: ShaderFeatures = {}): Promise<void> {
    await this.getVariant(baseName, features);
  }

  /**
   * Setup hot-reload file watching
   */
  private async setupHotReload(): Promise<void> {
    await this.loader.enableHotReload((path: string) => {
      console.log(`[ShaderManager] Shader file changed: ${path}`);

      // Find all variants that depend on this file
      const affectedVariants = new Set<string>();

      for (const [cacheKey, loaded] of this.variantCache.entries()) {
        if (loaded.dependencies.includes(path)) {
          affectedVariants.add(cacheKey);
        }
      }

      // For each affected variant, invalidate and reload programs
      for (const variantKey of affectedVariants) {
        console.log(`[ShaderManager] Invalidating variant: ${variantKey}`);

        // Get all programs using this variant
        const affectedPrograms = this.variantToPrograms.get(variantKey);

        if (affectedPrograms) {
          // Delete affected programs (they'll be recreated on next use)
          for (const programId of affectedPrograms) {
            console.log(`[ShaderManager] Reloading program: ${programId}`);
            this.deleteProgram(programId);
          }
        }

        // Clear the variant cache
        this.variantCache.delete(variantKey);
        this.variantToPrograms.delete(variantKey);
      }

      // Clear the shader source cache to force reload
      this.loader.clearCache();
    });
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
    this.variantCache.clear();
    this.loader.clearCache();
  }
}
