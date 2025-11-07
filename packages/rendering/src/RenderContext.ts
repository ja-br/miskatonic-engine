import type {
  RendererConfig,
  RenderState,
  BlendMode,
  DepthTest,
  CullMode,
} from './types';
import { DEFAULT_RENDER_STATE } from './types';

/**
 * WebGL2 rendering context with state management
 *
 * Features:
 * - Lazy state updates (only apply changes)
 * - State caching to minimize WebGL calls
 * - Extension detection and management
 * - Context loss handling
 */
export class RenderContext {
  private gl: WebGL2RenderingContext;
  private canvas: HTMLCanvasElement;
  private currentState: RenderState;
  private extensions = new Map<string, unknown>();
  private contextLost = false;

  // State tracking for caching
  private currentProgram: WebGLProgram | null = null;
  private boundTextures = new Map<number, WebGLTexture | null>();
  private boundBuffers = {
    ARRAY_BUFFER: null as WebGLBuffer | null,
    ELEMENT_ARRAY_BUFFER: null as WebGLBuffer | null,
  };

  // Event handlers for cleanup
  private contextLostHandler: ((e: Event) => void) | null = null;
  private contextRestoredHandler: (() => void) | null = null;

  constructor(config: RendererConfig) {
    this.canvas = config.canvas;

    // Try to get WebGL2 context
    const contextAttributes: WebGLContextAttributes = {
      alpha: config.alpha ?? false,
      antialias: config.antialias ?? true,
      depth: config.depth ?? true,
      stencil: config.stencil ?? false,
      powerPreference: config.powerPreference ?? 'high-performance',
      failIfMajorPerformanceCaveat: config.failIfMajorPerformanceCaveat ?? false,
      preserveDrawingBuffer: false,
    };

    const gl = this.canvas.getContext('webgl2', contextAttributes);
    if (!gl) {
      throw new Error('WebGL2 not supported');
    }

    this.gl = gl;
    this.currentState = { ...DEFAULT_RENDER_STATE };

    // Set up context loss handling
    this.setupContextLossHandling();

    // Load common extensions
    this.loadExtensions();

    // Initialize default state
    this.initializeDefaultState();
  }

  /**
   * Get the WebGL2 context
   */
  getGL(): WebGL2RenderingContext {
    if (this.contextLost) {
      throw new Error('WebGL context is lost');
    }
    return this.gl;
  }

  /**
   * Get canvas element
   */
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  /**
   * Check if context is lost
   */
  isContextLost(): boolean {
    return this.contextLost;
  }

  /**
   * Get current render state
   */
  getState(): Readonly<RenderState> {
    return this.currentState;
  }

  /**
   * Set render state (only applies changes)
   */
  setState(state: Partial<RenderState>): void {
    if (state.blendMode !== undefined && state.blendMode !== this.currentState.blendMode) {
      this.applyBlendMode(state.blendMode);
      this.currentState.blendMode = state.blendMode;
    }

    if (state.depthTest !== undefined && state.depthTest !== this.currentState.depthTest) {
      this.applyDepthTest(state.depthTest);
      this.currentState.depthTest = state.depthTest;
    }

    if (state.depthWrite !== undefined && state.depthWrite !== this.currentState.depthWrite) {
      this.gl.depthMask(state.depthWrite);
      this.currentState.depthWrite = state.depthWrite;
    }

    if (state.cullMode !== undefined && state.cullMode !== this.currentState.cullMode) {
      this.applyCullMode(state.cullMode);
      this.currentState.cullMode = state.cullMode;
    }

    if (state.viewport !== undefined) {
      const vp = state.viewport;
      this.gl.viewport(vp.x, vp.y, vp.width, vp.height);
      this.currentState.viewport = vp;
    }

    if (state.scissor !== undefined) {
      const sc = state.scissor;
      if (sc) {
        this.gl.enable(this.gl.SCISSOR_TEST);
        this.gl.scissor(sc.x, sc.y, sc.width, sc.height);
      } else {
        this.gl.disable(this.gl.SCISSOR_TEST);
      }
      this.currentState.scissor = sc;
    }
  }

  /**
   * Reset to default state
   */
  resetState(): void {
    this.setState(DEFAULT_RENDER_STATE);
  }

  /**
   * Use shader program (cached)
   */
  useProgram(program: WebGLProgram | null): void {
    if (program !== this.currentProgram) {
      this.gl.useProgram(program);
      this.currentProgram = program;
    }
  }

  /**
   * Bind texture to unit (cached)
   */
  bindTexture(texture: WebGLTexture | null, unit: number): void {
    const current = this.boundTextures.get(unit);
    if (texture !== current) {
      this.gl.activeTexture(this.gl.TEXTURE0 + unit);
      this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
      this.boundTextures.set(unit, texture);
    }
  }

  /**
   * Bind buffer (cached)
   */
  bindBuffer(target: number, buffer: WebGLBuffer | null): void {
    const targetName = target === this.gl.ARRAY_BUFFER ? 'ARRAY_BUFFER' : 'ELEMENT_ARRAY_BUFFER';
    if (buffer !== this.boundBuffers[targetName]) {
      this.gl.bindBuffer(target, buffer);
      this.boundBuffers[targetName] = buffer;
    }
  }

  /**
   * Clear the framebuffer
   */
  clear(color?: [number, number, number, number], depth?: number, stencil?: number): void {
    let mask = 0;

    if (color !== undefined) {
      this.gl.clearColor(color[0], color[1], color[2], color[3]);
      mask |= this.gl.COLOR_BUFFER_BIT;
    }

    if (depth !== undefined) {
      this.gl.clearDepth(depth);
      mask |= this.gl.DEPTH_BUFFER_BIT;
    }

    if (stencil !== undefined) {
      this.gl.clearStencil(stencil);
      mask |= this.gl.STENCIL_BUFFER_BIT;
    }

    if (mask !== 0) {
      this.gl.clear(mask);
    }
  }

  /**
   * Resize the canvas and viewport
   */
  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
    this.gl.viewport(0, 0, width, height);
    this.currentState.viewport = { x: 0, y: 0, width, height };
  }

  /**
   * Get extension (cached)
   */
  getExtension<T = unknown>(name: string): T | null {
    if (this.extensions.has(name)) {
      return this.extensions.get(name) as T;
    }

    const ext = this.gl.getExtension(name);
    this.extensions.set(name, ext);
    return ext as T;
  }

  /**
   * Apply blend mode
   */
  private applyBlendMode(mode: BlendMode): void {
    switch (mode) {
      case 'none':
        this.gl.disable(this.gl.BLEND);
        break;

      case 'alpha':
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
        break;

      case 'additive':
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE);
        break;

      case 'multiply':
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.DST_COLOR, this.gl.ZERO);
        break;
    }
  }

  /**
   * Apply depth test mode
   */
  private applyDepthTest(mode: DepthTest): void {
    if (mode === 'always') {
      this.gl.disable(this.gl.DEPTH_TEST);
      return;
    }

    this.gl.enable(this.gl.DEPTH_TEST);

    const funcMap: Record<DepthTest, number> = {
      never: this.gl.NEVER,
      less: this.gl.LESS,
      equal: this.gl.EQUAL,
      lequal: this.gl.LEQUAL,
      greater: this.gl.GREATER,
      notequal: this.gl.NOTEQUAL,
      gequal: this.gl.GEQUAL,
      always: this.gl.ALWAYS,
    };

    this.gl.depthFunc(funcMap[mode]);
  }

  /**
   * Apply cull mode
   */
  private applyCullMode(mode: CullMode): void {
    if (mode === 'none') {
      this.gl.disable(this.gl.CULL_FACE);
      return;
    }

    this.gl.enable(this.gl.CULL_FACE);

    const modeMap: Record<Exclude<CullMode, 'none'>, number> = {
      front: this.gl.FRONT,
      back: this.gl.BACK,
      front_and_back: this.gl.FRONT_AND_BACK,
    };

    this.gl.cullFace(modeMap[mode]);
  }

  /**
   * Set up context loss handling
   */
  private setupContextLossHandling(): void {
    this.contextLostHandler = (event) => {
      event.preventDefault();
      this.contextLost = true;
      console.error('WebGL context lost');
    };

    this.contextRestoredHandler = () => {
      this.contextLost = false;
      console.log('WebGL context restored');
      this.initializeDefaultState();
    };

    this.canvas.addEventListener('webglcontextlost', this.contextLostHandler);
    this.canvas.addEventListener('webglcontextrestored', this.contextRestoredHandler);
  }

  /**
   * Load common WebGL2 extensions
   */
  private loadExtensions(): void {
    // Try to load useful extensions
    const extensionsToLoad = [
      'EXT_color_buffer_float',
      'OES_texture_float_linear',
      'EXT_texture_filter_anisotropic',
    ];

    for (const name of extensionsToLoad) {
      try {
        this.getExtension(name);
      } catch (error) {
        console.warn(`Extension ${name} not available`);
      }
    }
  }

  /**
   * Initialize default WebGL state
   */
  private initializeDefaultState(): void {
    // Enable depth test by default
    this.gl.enable(this.gl.DEPTH_TEST);
    this.gl.depthFunc(this.gl.LESS);

    // Enable back-face culling by default
    this.gl.enable(this.gl.CULL_FACE);
    this.gl.cullFace(this.gl.BACK);

    // Set default clear color
    this.gl.clearColor(0, 0, 0, 1);

    // Set default viewport
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.currentState.viewport = {
      x: 0,
      y: 0,
      width: this.canvas.width,
      height: this.canvas.height,
    };
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    // Remove event listeners to prevent memory leaks
    if (this.contextLostHandler) {
      this.canvas.removeEventListener('webglcontextlost', this.contextLostHandler);
      this.contextLostHandler = null;
    }
    if (this.contextRestoredHandler) {
      this.canvas.removeEventListener('webglcontextrestored', this.contextRestoredHandler);
      this.contextRestoredHandler = null;
    }

    // Clear cached state
    this.boundTextures.clear();
    this.extensions.clear();
    this.currentProgram = null;
    this.boundBuffers.ARRAY_BUFFER = null;
    this.boundBuffers.ELEMENT_ARRAY_BUFFER = null;
  }
}
