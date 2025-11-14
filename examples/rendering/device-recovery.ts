/**
 * Device Recovery Example
 *
 * Demonstrates:
 * - Automatic GPU device loss recovery
 * - Recovery progress monitoring
 * - Resource recreation after device loss
 * - UI feedback during recovery
 * - Manual device loss simulation
 * - Best practices for recovery-aware applications
 */

import { WebGPUBackend } from '@miskatonic/rendering';
import type { RecoveryProgress } from '@miskatonic/rendering';

const RECOVERY_SHADER = `
@vertex
fn vs_main(@location(0) position: vec3f) -> @builtin(position) vec4f, @location(0) vec3f {
  return vec4f(position, 1.0), position;
}

@fragment
fn fs_main(@location(0) position: vec3f) -> @location(0) vec4f {
  // Rainbow color based on position
  let color = vec3f(
    (position.x + 1.0) * 0.5,
    (position.y + 1.0) * 0.5,
    0.5
  );
  return vec4f(color, 1.0);
}
`;

function createStarGeometry(points: number): Float32Array {
  const vertices: number[] = [];
  const angleStep = (Math.PI * 2) / points;

  for (let i = 0; i < points; i++) {
    const angle = i * angleStep;
    const outerX = Math.cos(angle) * 0.8;
    const outerY = Math.sin(angle) * 0.8;

    const innerAngle = angle + angleStep / 2;
    const innerX = Math.cos(innerAngle) * 0.4;
    const innerY = Math.sin(innerAngle) * 0.4;

    // Center
    vertices.push(0, 0, 0);
    // Outer point
    vertices.push(outerX, outerY, 0);
    // Inner point
    vertices.push(innerX, innerY, 0);
  }

  return new Float32Array(vertices);
}

function createUI() {
  const ui = document.createElement('div');
  ui.style.cssText = `
    position: absolute;
    top: 10px;
    left: 10px;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 15px;
    font-family: monospace;
    border-radius: 5px;
    z-index: 1000;
  `;

  ui.innerHTML = `
    <h3 style="margin: 0 0 10px 0;">Device Recovery Demo</h3>
    <div id="status" style="margin-bottom: 10px;">Status: <span id="status-text" style="color: #0f0;">Ready</span></div>
    <div id="stats" style="margin-bottom: 10px;"></div>
    <button id="trigger-loss" style="
      padding: 8px 16px;
      background: #f44336;
      color: white;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-weight: bold;
    ">Simulate Device Loss</button>
    <div id="log" style="
      margin-top: 10px;
      max-height: 200px;
      overflow-y: auto;
      font-size: 11px;
    "></div>
  `;

  document.body.appendChild(ui);
  return ui;
}

function log(message: string, color: string = '#fff') {
  const logEl = document.getElementById('log');
  if (logEl) {
    const entry = document.createElement('div');
    entry.style.color = color;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logEl.appendChild(entry);
    logEl.scrollTop = logEl.scrollHeight;
  }
  console.log(message);
}

function updateStatus(text: string, color: string) {
  const statusEl = document.getElementById('status-text');
  if (statusEl) {
    statusEl.textContent = text;
    statusEl.style.color = color;
  }
}

async function main() {
  const canvas = document.querySelector('canvas');
  if (!canvas) throw new Error('Canvas not found');

  // Create UI
  const ui = createUI();

  const backend = new WebGPUBackend();
  await backend.initialize({ canvas, powerPreference: 'high-performance' });

  log('✅ WebGPU initialized', '#0f0');

  // Create multiple resources to demonstrate recovery
  const star5 = createStarGeometry(5);
  const star8 = createStarGeometry(8);

  const buffer1 = backend.createBuffer('star-5', 'vertex', star5, 'static_draw');
  const buffer2 = backend.createBuffer('star-8', 'vertex', star8, 'static_draw');
  const shader = backend.createShader('recovery-shader', { vertex: RECOVERY_SHADER });

  log(`Created ${backend.recoverySystem?.getStats().registered} resources`, '#0ff');

  // Set up recovery monitoring
  if (backend.recoverySystem) {
    backend.recoverySystem.onRecovery((progress: RecoveryProgress) => {
      switch (progress.phase) {
        case 'detecting':
          log('⚠️ Device loss detected!', '#ff9800');
          updateStatus('Device Lost', '#ff9800');
          break;

        case 'reinitializing':
          log('🔄 Reinitializing GPU device...', '#ff9800');
          updateStatus('Reinitializing...', '#ff9800');
          break;

        case 'recreating':
          log(`🔧 Recreating resources: ${progress.resourcesRecreated}/${progress.totalResources}`, '#ff9800');
          updateStatus(`Recovering (${progress.resourcesRecreated}/${progress.totalResources})`, '#ff9800');
          break;

        case 'complete':
          log(`✅ Recovery complete! Recreated ${progress.resourcesRecreated} resources`, '#0f0');
          updateStatus('Recovered', '#0f0');
          setTimeout(() => {
            updateStatus('Ready', '#0f0');
          }, 2000);
          break;

        case 'failed':
          log(`❌ Recovery failed: ${progress.error?.message}`, '#f44');
          updateStatus('Recovery Failed', '#f44');
          break;
      }
    });
  }

  // Set up manual device loss trigger
  const triggerButton = document.getElementById('trigger-loss');
  if (triggerButton) {
    triggerButton.addEventListener('click', () => {
      log('🔴 Manually triggering device loss...', '#f44');
      // Destroy the device to simulate loss
      if (backend.device) {
        backend.device.destroy();
      }
    });
  }

  let frameCount = 0;
  let lastFpsUpdate = performance.now();
  let fps = 0;
  let currentBuffer = buffer1;
  let currentVertexCount = star5.length / 3;

  function render() {
    // Switch between buffers every 2 seconds
    if (Math.floor(frameCount / 120) % 2 === 0) {
      currentBuffer = buffer1;
      currentVertexCount = star5.length / 3;
    } else {
      currentBuffer = buffer2;
      currentVertexCount = star8.length / 3;
    }

    backend.beginFrame();

    backend.executeDrawCommand({
      type: 'non-indexed',
      vertexCount: currentVertexCount,
      instanceCount: 1,
      firstVertex: 0,
      firstInstance: 0,
      shader,
      buffers: [{ buffer: currentBuffer, offset: 0 }],
      vertexLayout: {
        arrayStride: 12,
        stepMode: 'vertex',
        attributes: [
          { format: 'float32x3', offset: 0, shaderLocation: 0 }
        ]
      },
      topology: 'triangle-list',
      bindGroups: []
    });

    const stats = backend.endFrame();

    // Update FPS
    frameCount++;
    const now = performance.now();
    if (now - lastFpsUpdate >= 1000) {
      fps = frameCount;
      frameCount = 0;
      lastFpsUpdate = now;

      // Update stats display
      const statsEl = document.getElementById('stats');
      if (statsEl) {
        statsEl.innerHTML = `
          FPS: ${fps}<br>
          Frame Time: ${stats.cpuTimeMs.toFixed(2)}ms<br>
          Draw Calls: ${stats.drawCalls}<br>
          Registered Resources: ${backend.recoverySystem?.getStats().registered || 0}
        `;
      }
    }

    requestAnimationFrame(render);
  }

  log('🎬 Starting render loop', '#0ff');
  render();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
