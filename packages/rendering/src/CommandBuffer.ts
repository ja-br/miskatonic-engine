import type {
  RenderCommand,
  RenderCommandType,
  DrawCommand,
  ClearCommand,
  SetStateCommand,
  SetUniformCommand,
  BindTextureCommand,
  RenderStats,
  PrimitiveMode,
  VertexLayout,
  ShaderProgram,
} from './types';
import { RenderContext } from './RenderContext';
import { ShaderManager } from './ShaderManager';
import { BufferManager } from './BufferManager';
import { TextureManager } from './TextureManager';

/**
 * Command buffer for recording and executing render commands
 *
 * Features:
 * - Command batching and sorting
 * - State change minimization
 * - Draw call reduction via instancing
 * - Render statistics tracking
 * - Multi-pass rendering support
 */
export class CommandBuffer {
  private context: RenderContext;
  private shaderManager: ShaderManager;
  private bufferManager: BufferManager;
  private textureManager: TextureManager;

  private commands: RenderCommand[] = [];
  private stats: RenderStats = this.createEmptyStats();
  private frameStartTime = 0;

  constructor(
    context: RenderContext,
    shaderManager: ShaderManager,
    bufferManager: BufferManager,
    textureManager: TextureManager
  ) {
    this.context = context;
    this.shaderManager = shaderManager;
    this.bufferManager = bufferManager;
    this.textureManager = textureManager;
  }

  /**
   * Begin new frame
   */
  beginFrame(): void {
    this.frameStartTime = performance.now();
    this.commands = [];
    this.resetStats();
  }

  /**
   * End frame and return statistics
   */
  endFrame(): RenderStats {
    this.stats.frameTime = performance.now() - this.frameStartTime;
    return { ...this.stats };
  }

  /**
   * Add clear command
   */
  clear(color?: [number, number, number, number], depth?: number, stencil?: number): void {
    this.commands.push({
      type: 'clear' as RenderCommandType.CLEAR,
      color,
      depth,
      stencil,
    });
  }

  /**
   * Add draw command
   */
  draw(command: Omit<DrawCommand, 'type'>): void {
    this.commands.push({
      type: 'draw' as RenderCommandType.DRAW,
      ...command,
    });
  }

  /**
   * Execute all recorded commands
   */
  execute(): void {
    if (this.commands.length === 0) {
      return;
    }

    // Sort commands for optimal rendering
    this.sortCommands();

    // Execute commands in order
    let currentShader: string | null = null;

    for (const command of this.commands) {
      switch (command.type) {
        case 'clear':
          this.executeClear(command);
          break;

        case 'draw':
          // Switch shader if needed
          if (command.shader !== currentShader) {
            this.executeSetShader(command.shader);
            currentShader = command.shader;
          }

          this.executeDraw(command);
          break;

        case 'set_state':
          this.executeSetState(command);
          break;

        case 'set_shader':
          this.executeSetShader(command.shaderId);
          currentShader = command.shaderId;
          break;

        case 'set_uniform':
          this.executeSetUniform(command);
          break;

        case 'bind_texture':
          this.executeBindTexture(command);
          break;
      }
    }
  }

  /**
   * Get current render statistics
   */
  getStats(): Readonly<RenderStats> {
    return this.stats;
  }

  /**
   * Clear all commands
   */
  clearCommands(): void {
    this.commands = [];
  }

  /**
   * Get command count
   */
  getCommandCount(): number {
    return this.commands.length;
  }

  /**
   * Sort commands for optimal rendering
   * - Clear commands first
   * - Group by shader to minimize switches
   * - Sort by state changes
   */
  private sortCommands(): void {
    this.commands.sort((a, b) => {
      // Clear commands always first
      if (a.type === 'clear') return -1;
      if (b.type === 'clear') return 1;

      // Group draw commands by shader
      if (a.type === 'draw' && b.type === 'draw') {
        return a.shader.localeCompare(b.shader);
      }

      // Keep other commands in order
      return 0;
    });
  }

  /**
   * Execute clear command
   */
  private executeClear(command: ClearCommand): void {
    this.context.clear(command.color, command.depth, command.stencil);
  }

  /**
   * Execute draw command
   */
  private executeDraw(command: DrawCommand): void {
    const gl = this.context.getGL();

    // Apply render state if specified
    if (command.state) {
      this.context.setState(command.state);
      this.stats.stateChanges++;
    }

    // Get shader program
    const program = this.shaderManager.getProgram(command.shader);
    if (!program) {
      console.warn(`Shader not found: ${command.shader}`);
      return;
    }

    // Use program
    this.context.useProgram(program.program);

    // Bind vertex buffer
    const vertexBuffer = this.bufferManager.getBuffer(command.vertexBufferId);
    if (!vertexBuffer) {
      console.warn(`Vertex buffer not found: ${command.vertexBufferId}`);
      return;
    }
    this.context.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer.buffer);

    // Setup vertex attributes
    this.setupVertexAttributes(gl, program, command.vertexLayout);

    // Bind index buffer if present
    let hasIndexBuffer = false;
    let indexType: number = gl.UNSIGNED_SHORT;
    if (command.indexBufferId) {
      const indexBufferDesc = this.bufferManager.getBuffer(command.indexBufferId);
      if (indexBufferDesc) {
        this.context.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBufferDesc.buffer);
        hasIndexBuffer = true;
        indexType = this.mapIndexType(command.indexType ?? 'uint16');
      }
    }

    // Set uniforms
    if (command.uniforms) {
      for (const [name, uniform] of command.uniforms) {
        this.shaderManager.setUniform(program, name, uniform.type, uniform.value);
      }
    }

    // Bind textures
    if (command.textures) {
      for (const [unit, textureId] of command.textures) {
        const textureDesc = this.textureManager.getTexture(textureId);
        if (textureDesc) {
          this.context.bindTexture(textureDesc.texture, unit);
          this.stats.textureBinds++;
        }
      }
    }

    // Draw
    const mode = this.mapPrimitiveMode(command.mode);
    if (hasIndexBuffer) {
      if (command.instanceCount && command.instanceCount > 1) {
        gl.drawElementsInstanced(mode, command.vertexCount, indexType, 0, command.instanceCount);
      } else {
        gl.drawElements(mode, command.vertexCount, indexType, 0);
      }
    } else {
      if (command.instanceCount && command.instanceCount > 1) {
        gl.drawArraysInstanced(mode, 0, command.vertexCount, command.instanceCount);
      } else {
        gl.drawArrays(mode, 0, command.vertexCount);
      }
    }

    // Update stats
    this.stats.drawCalls++;
    this.stats.vertices += command.vertexCount * (command.instanceCount ?? 1);

    if (mode === gl.TRIANGLES) {
      this.stats.triangles += Math.floor(command.vertexCount / 3) * (command.instanceCount ?? 1);
    }
  }

  /**
   * Execute set state command
   */
  private executeSetState(command: SetStateCommand): void {
    this.context.setState(command.state);
    this.stats.stateChanges++;
  }

  /**
   * Execute set shader command
   */
  private executeSetShader(shaderId: string): void {
    const program = this.shaderManager.getProgram(shaderId);
    if (program) {
      this.context.useProgram(program.program);
      this.stats.shaderSwitches++;
    }
  }

  /**
   * Execute set uniform command
   */
  private executeSetUniform(_command: SetUniformCommand): void {
    // Need current program context - this is typically used with an active shader
    // In practice, uniforms are usually set as part of draw commands
    console.warn('Direct uniform commands should be part of draw commands');
  }

  /**
   * Execute bind texture command
   */
  private executeBindTexture(command: BindTextureCommand): void {
    this.context.bindTexture(command.texture, command.unit);
    this.stats.textureBinds++;
  }

  /**
   * Setup vertex attributes from layout
   */
  private setupVertexAttributes(gl: WebGL2RenderingContext, program: ShaderProgram, layout: VertexLayout): void {
    for (const attr of layout.attributes) {
      const location = program.attributes.get(attr.name);
      if (location === undefined) {
        continue; // Attribute not used in shader
      }

      gl.enableVertexAttribArray(location);

      const glType = this.mapAttributeType(attr.type);
      const stride = attr.stride ?? 0;
      const offset = attr.offset ?? 0;
      const normalized = attr.normalized ?? false;

      gl.vertexAttribPointer(location, attr.size, glType, normalized, stride, offset);
    }
  }

  /**
   * Map attribute type to WebGL constant
   */
  private mapAttributeType(type: 'float' | 'int' | 'byte' | 'short'): number {
    const gl = this.context.getGL();
    switch (type) {
      case 'float':
        return gl.FLOAT;
      case 'int':
        return gl.INT;
      case 'byte':
        return gl.BYTE;
      case 'short':
        return gl.SHORT;
      default:
        return gl.FLOAT;
    }
  }

  /**
   * Map index type to WebGL constant
   */
  private mapIndexType(type: 'uint8' | 'uint16' | 'uint32'): number {
    const gl = this.context.getGL();
    switch (type) {
      case 'uint8':
        return gl.UNSIGNED_BYTE;
      case 'uint16':
        return gl.UNSIGNED_SHORT;
      case 'uint32':
        return gl.UNSIGNED_INT;
      default:
        return gl.UNSIGNED_SHORT;
    }
  }

  /**
   * Map primitive mode to WebGL constant
   */
  private mapPrimitiveMode(mode: PrimitiveMode): number {
    const gl = this.context.getGL();
    switch (mode) {
      case 0: // POINTS
        return gl.POINTS;
      case 1: // LINES
        return gl.LINES;
      case 3: // LINE_STRIP
        return gl.LINE_STRIP;
      case 4: // TRIANGLES
        return gl.TRIANGLES;
      case 5: // TRIANGLE_STRIP
        return gl.TRIANGLE_STRIP;
      default:
        return gl.TRIANGLES;
    }
  }

  /**
   * Reset statistics
   */
  private resetStats(): void {
    this.stats = this.createEmptyStats();
  }

  /**
   * Create empty statistics object
   */
  private createEmptyStats(): RenderStats {
    return {
      drawCalls: 0,
      triangles: 0,
      vertices: 0,
      batches: 0,
      shaderSwitches: 0,
      textureBinds: 0,
      stateChanges: 0,
      frameTime: 0,
    };
  }
}
