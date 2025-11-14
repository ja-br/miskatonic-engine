/**
 * Textured Cube Example
 *
 * Demonstrates:
 * - 3D cube geometry with texture coordinates
 * - Texture creation and binding
 * - Uniform buffers (transform matrices)
 * - Index buffers for efficient rendering
 * - Basic camera and perspective projection
 */

import { WebGPUBackend } from '@miskatonic/rendering';

// WGSL Shader with textures and transforms
const CUBE_SHADER = `
struct Uniforms {
  mvpMatrix: mat4x4f,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var textureSampler: sampler;
@group(0) @binding(2) var textureData: texture_2d<f32>;

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) texCoord: vec2f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) texCoord: vec2f,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = uniforms.mvpMatrix * vec4f(input.position, 1.0);
  output.texCoord = input.texCoord;
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  return textureSample(textureData, textureSampler, input.texCoord);
}
`;

// Helper: Create a simple 8x8 checkerboard texture
function createCheckerboardTexture(): ImageData {
  const size = 8;
  const data = new Uint8ClampedArray(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const index = (y * size + x) * 4;
      const isWhite = (x + y) % 2 === 0;
      const value = isWhite ? 255 : 64;

      data[index + 0] = value; // R
      data[index + 1] = value; // G
      data[index + 2] = value; // B
      data[index + 3] = 255;   // A
    }
  }

  return new ImageData(data, size, size);
}

// Helper: Create perspective projection matrix
function createPerspectiveMatrix(fov: number, aspect: number, near: number, far: number): Float32Array {
  const f = 1.0 / Math.tan(fov / 2);
  const nf = 1 / (near - far);

  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0
  ]);
}

// Helper: Create view matrix (look-at)
function createViewMatrix(eye: [number, number, number]): Float32Array {
  // Simple view matrix - translate camera back
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    -eye[0], -eye[1], -eye[2], 1
  ]);
}

// Helper: Create rotation matrix
function createRotationMatrix(angleX: number, angleY: number): Float32Array {
  const cosX = Math.cos(angleX);
  const sinX = Math.sin(angleX);
  const cosY = Math.cos(angleY);
  const sinY = Math.sin(angleY);

  return new Float32Array([
    cosY, sinX * sinY, -cosX * sinY, 0,
    0, cosX, sinX, 0,
    sinY, -sinX * cosY, cosX * cosY, 0,
    0, 0, 0, 1
  ]);
}

// Helper: Multiply 4x4 matrices
function multiplyMatrices(a: Float32Array, b: Float32Array): Float32Array {
  const result = new Float32Array(16);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      result[i * 4 + j] =
        a[i * 4 + 0] * b[0 * 4 + j] +
        a[i * 4 + 1] * b[1 * 4 + j] +
        a[i * 4 + 2] * b[2 * 4 + j] +
        a[i * 4 + 3] * b[3 * 4 + j];
    }
  }
  return result;
}

async function main() {
  const canvas = document.querySelector('canvas');
  if (!canvas) throw new Error('Canvas not found');

  const backend = new WebGPUBackend();
  await backend.initialize({ canvas, powerPreference: 'high-performance' });

  // Cube vertices (position + texCoord)
  // 8 vertices, each with xyz position and uv texture coordinates
  const vertices = new Float32Array([
    // Front face
    -1, -1,  1,  0, 0,
     1, -1,  1,  1, 0,
     1,  1,  1,  1, 1,
    -1,  1,  1,  0, 1,
    // Back face
    -1, -1, -1,  1, 0,
    -1,  1, -1,  1, 1,
     1,  1, -1,  0, 1,
     1, -1, -1,  0, 0,
    // Top face
    -1,  1, -1,  0, 1,
    -1,  1,  1,  0, 0,
     1,  1,  1,  1, 0,
     1,  1, -1,  1, 1,
    // Bottom face
    -1, -1, -1,  0, 0,
     1, -1, -1,  1, 0,
     1, -1,  1,  1, 1,
    -1, -1,  1,  0, 1,
    // Right face
     1, -1, -1,  0, 0,
     1,  1, -1,  1, 0,
     1,  1,  1,  1, 1,
     1, -1,  1,  0, 1,
    // Left face
    -1, -1, -1,  1, 0,
    -1, -1,  1,  0, 0,
    -1,  1,  1,  0, 1,
    -1,  1, -1,  1, 1,
  ]);

  // Cube indices (2 triangles per face, 6 faces)
  const indices = new Uint16Array([
    0,  1,  2,   0,  2,  3,  // Front
    4,  5,  6,   4,  6,  7,  // Back
    8,  9, 10,   8, 10, 11,  // Top
   12, 13, 14,  12, 14, 15,  // Bottom
   16, 17, 18,  16, 18, 19,  // Right
   20, 21, 22,  20, 22, 23   // Left
  ]);

  // Create resources
  const vertexBuffer = backend.createBuffer('cube-vertices', 'vertex', vertices, 'static_draw');
  const indexBuffer = backend.createBuffer('cube-indices', 'index', indices, 'static_draw');
  const shader = backend.createShader('cube-shader', { vertex: CUBE_SHADER });

  // Create texture
  const textureData = createCheckerboardTexture();
  const texture = backend.createTexture('checkerboard', 8, 8, textureData, {
    format: 'rgba8unorm',
    minFilter: 'linear',
    magFilter: 'linear',
    generateMipmaps: true
  });

  // Create uniform buffer for MVP matrix
  const uniformBuffer = backend.createBuffer(
    'cube-uniforms',
    'uniform',
    new Float32Array(16), // 4x4 matrix
    'dynamic_draw'
  );

  // Camera setup
  const aspect = canvas.width / canvas.height;
  const projection = createPerspectiveMatrix(Math.PI / 4, aspect, 0.1, 100.0);
  const view = createViewMatrix([0, 0, 5]);

  let rotation = 0;

  function render() {
    rotation += 0.01;

    // Calculate MVP matrix
    const model = createRotationMatrix(rotation * 0.7, rotation);
    const mv = multiplyMatrices(view, model);
    const mvp = multiplyMatrices(projection, mv);

    // Update uniforms
    backend.updateBuffer(uniformBuffer, mvp);

    backend.beginFrame();

    backend.executeDrawCommand({
      type: 'indexed',
      indexCount: 36, // 12 triangles * 3 vertices
      instanceCount: 1,
      firstIndex: 0,
      baseVertex: 0,
      firstInstance: 0,
      shader,
      indexBuffer,
      indexFormat: 'uint16',
      buffers: [{ buffer: vertexBuffer, offset: 0 }],
      vertexLayout: {
        arrayStride: 20, // 5 floats * 4 bytes (xyz + uv)
        stepMode: 'vertex',
        attributes: [
          { format: 'float32x3', offset: 0, shaderLocation: 0 },  // position
          { format: 'float32x2', offset: 12, shaderLocation: 1 }  // texCoord
        ]
      },
      topology: 'triangle-list',
      bindGroups: [] // TODO: Bind uniform buffer and texture when bind group support is added
    });

    backend.endFrame();
    requestAnimationFrame(render);
  }

  console.log('✅ Textured cube ready (Note: Texture binding requires bind group support)');
  render();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
