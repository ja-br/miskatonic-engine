// Basic Lighting Shader - WGSL (WebGPU Shading Language)
// Blinn-Phong lighting model

// Vertex shader inputs
struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
}

// Vertex shader outputs / Fragment shader inputs
struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) worldPosition: vec3<f32>,
  @location(1) normal: vec3<f32>,
}

// Uniforms - bind group 0
struct Uniforms {
  modelViewProjection: mat4x4<f32>,
  model: mat4x4<f32>,
  normalMatrix: mat3x3<f32>,
  lightDir: vec3<f32>,
  cameraPos: vec3<f32>,
  baseColor: vec3<f32>,
}

@group(0) @binding(0)
var<uniform> uniforms: Uniforms;

// Vertex shader
@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;

  // Transform normal
  output.normal = normalize(uniforms.normalMatrix * input.normal);

  // Transform position to world space
  let worldPosition = uniforms.model * vec4<f32>(input.position, 1.0);
  output.worldPosition = worldPosition.xyz;

  // Transform to clip space
  // Epic 3.13 FIX: modelViewProjection is now viewProj, apply model separately
  output.position = uniforms.modelViewProjection * worldPosition;

  return output;
}

// Fragment shader
@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  // Normalize interpolated normal
  let N = normalize(input.normal);
  let L = normalize(uniforms.lightDir);
  let V = normalize(uniforms.cameraPos - input.worldPosition);
  let H = normalize(L + V);

  // Blinn-Phong lighting
  let diffuse = max(dot(N, L), 0.0);
  let specular = pow(max(dot(N, H), 0.0), 32.0);
  let ambient = 0.2;

  let color = uniforms.baseColor * (ambient + diffuse) + vec3<f32>(1.0) * specular * 0.3;

  return vec4<f32>(color, 1.0);
}
