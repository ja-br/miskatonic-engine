/**
 * WebGPU Command Encoder - Epic RENDERING-05 Task 5.3
 * Handles draw command execution
 */

import type { DrawCommand, IndexedGeometry, NonIndexedGeometry, IndirectGeometry } from '../../commands/DrawCommand.js';
import { isIndexedGeometry, isNonIndexedGeometry, isIndirectGeometry, isComputeGeometry } from '../../commands/DrawCommand.js';
import type { WebGPUContext, WebGPUBuffer } from './WebGPUTypes.js';
import { WebGPUErrors } from './WebGPUTypes.js';
import type { RenderStats } from '../../types.js';

export class WebGPUCommandEncoder {
  constructor(
    private ctx: WebGPUContext,
    private getBuffer: (id: string) => (WebGPUBuffer & { type: string }) | undefined,
    private getBindGroup: (id: string) => GPUBindGroup | undefined,
    private getPipeline: (id: string) => { pipeline: GPURenderPipeline | GPUComputePipeline; type: string } | undefined,
    private stats: RenderStats
  ) {}

  /**
   * Execute draw command - extracted from WebGPUBackend.ts lines 584-756
   */
  executeDrawCommand(command: DrawCommand): void {
    const geom = command.geometry;

    // Handle compute dispatches
    if (isComputeGeometry(geom)) {
      this.executeComputeDispatch(command);
      return;
    }

    // Render commands
    if (!this.ctx.currentPass) {
      throw new Error(WebGPUErrors.NO_ACTIVE_RENDER_PASS);
    }

    // Get pipeline
    const pipelineData = this.getPipeline(command.pipeline.id);
    if (!pipelineData) {
      throw new Error(`Pipeline ${command.pipeline.id} not found`);
    }
    if (pipelineData.type !== 'render') {
      throw new Error(`Pipeline ${command.pipeline.id} is not a render pipeline`);
    }

    // Set pipeline
    this.ctx.currentPass.setPipeline(pipelineData.pipeline as GPURenderPipeline);

    // Set bind groups
    for (const [groupIndex, bindGroupHandle] of command.bindGroups) {
      const bindGroup = this.getBindGroup(bindGroupHandle.id);
      if (!bindGroup) {
        throw new Error(`Bind group ${bindGroupHandle.id} not found`);
      }
      this.ctx.currentPass.setBindGroup(groupIndex, bindGroup);
    }

    // Set vertex buffers from geometry
    if (!this.ctx.device) throw new Error(WebGPUErrors.DEVICE_NOT_INITIALIZED);

    // Epic 3.14: Validate vertex buffer slots
    const maxSlot = Math.max(...geom.vertexBuffers.keys());
    if (maxSlot >= this.ctx.device.limits.maxVertexBuffers) {
      throw new Error(
        `Vertex buffer slot ${maxSlot} exceeds device limit (${this.ctx.device.limits.maxVertexBuffers})`
      );
    }

    // Warn if slots aren't sequential (non-fatal but suspicious)
    const slots = Array.from(geom.vertexBuffers.keys()).sort((a, b) => a - b);
    for (let i = 0; i < slots.length - 1; i++) {
      if (slots[i + 1] !== slots[i] + 1) {
        console.warn(`Non-sequential vertex buffer slots detected: ${slots.join(', ')}`);
        break;
      }
    }

    for (const [slot, handle] of geom.vertexBuffers) {
      const bufferData = this.getBuffer(handle.id);
      if (!bufferData) {
        throw new Error(`Vertex buffer ${handle.id} not found`);
      }
      this.ctx.currentPass.setVertexBuffer(slot, bufferData.buffer);
    }

    // Execute appropriate draw call based on geometry type
    if (isIndexedGeometry(geom)) {
      this.executeIndexedDraw(geom);
    } else if (isNonIndexedGeometry(geom)) {
      this.executeNonIndexedDraw(geom);
    } else if (isIndirectGeometry(geom)) {
      this.executeIndirectDraw(geom);
    }
  }

  /**
   * Execute indexed draw
   */
  private executeIndexedDraw(geom: IndexedGeometry): void {
    if (!this.ctx.currentPass) return;

    const indexBufferData = this.getBuffer(geom.indexBuffer.id);
    if (!indexBufferData) {
      throw new Error(`Index buffer ${geom.indexBuffer.id} not found`);
    }

    this.ctx.currentPass.setIndexBuffer(indexBufferData.buffer, geom.indexFormat);

    this.ctx.currentPass.drawIndexed(
      geom.indexCount,
      geom.instanceCount ?? 1,
      geom.firstIndex ?? 0,
      geom.baseVertex ?? 0,
      geom.firstInstance ?? 0
    );

    // Update stats
    this.stats.drawCalls++;
    this.stats.vertices += geom.indexCount * (geom.instanceCount ?? 1);
    this.stats.triangles += Math.floor(geom.indexCount / 3) * (geom.instanceCount ?? 1);
  }

  /**
   * Execute non-indexed draw
   */
  private executeNonIndexedDraw(geom: NonIndexedGeometry): void {
    if (!this.ctx.currentPass) return;

    this.ctx.currentPass.draw(
      geom.vertexCount,
      geom.instanceCount ?? 1,
      geom.firstVertex ?? 0,
      geom.firstInstance ?? 0
    );

    // Update stats
    this.stats.drawCalls++;
    this.stats.vertices += geom.vertexCount * (geom.instanceCount ?? 1);
    this.stats.triangles += Math.floor(geom.vertexCount / 3) * (geom.instanceCount ?? 1);
  }

  /**
   * Execute indirect draw
   */
  private executeIndirectDraw(geom: IndirectGeometry): void {
    if (!this.ctx.currentPass) return;

    const indirectBufferData = this.getBuffer(geom.indirectBuffer.id);
    if (!indirectBufferData) {
      throw new Error(`Indirect buffer ${geom.indirectBuffer.id} not found`);
    }

    if (geom.indexBuffer) {
      // Indexed indirect - Epic 3.14: Validate indexFormat is present
      if (!geom.indexFormat) {
        throw new Error('indexFormat required for indexed indirect draws');
      }

      const indexBufferData = this.getBuffer(geom.indexBuffer.id);
      if (!indexBufferData) {
        throw new Error(`Index buffer ${geom.indexBuffer.id} not found`);
      }
      this.ctx.currentPass.setIndexBuffer(indexBufferData.buffer, geom.indexFormat);
      this.ctx.currentPass.drawIndexedIndirect(indirectBufferData.buffer, geom.indirectOffset);
    } else {
      // Non-indexed indirect
      this.ctx.currentPass.drawIndirect(indirectBufferData.buffer, geom.indirectOffset);
    }

    // Update stats (cannot determine exact counts for indirect draws)
    this.stats.drawCalls++;
  }

  /**
   * Execute compute dispatch
   */
  private executeComputeDispatch(command: DrawCommand): void {
    if (!this.ctx.device || !this.ctx.commandEncoder) return;

    const geom = command.geometry;
    if (!isComputeGeometry(geom)) return;

    const pipelineData = this.getPipeline(command.pipeline.id);
    if (!pipelineData) {
      throw new Error(`Pipeline ${command.pipeline.id} not found`);
    }
    if (pipelineData.type !== 'compute') {
      throw new Error(`Pipeline ${command.pipeline.id} is not a compute pipeline`);
    }

    const computePass = this.ctx.commandEncoder.beginComputePass({
      label: command.label || 'Compute Pass',
    });

    computePass.setPipeline(pipelineData.pipeline as GPUComputePipeline);

    // Set bind groups
    for (const [groupIndex, bindGroupHandle] of command.bindGroups) {
      const bindGroup = this.getBindGroup(bindGroupHandle.id);
      if (!bindGroup) {
        throw new Error(`Bind group ${bindGroupHandle.id} not found`);
      }
      computePass.setBindGroup(groupIndex, bindGroup);
    }

    computePass.dispatchWorkgroups(geom.workgroups[0], geom.workgroups[1], geom.workgroups[2]);
    computePass.end();

    // Update stats
    this.stats.drawCalls++;
  }
}
