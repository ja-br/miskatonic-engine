// Epic 3.13: Instanced Basic Lighting Shader - WGSL (WebGPU Shading Language)
// Blinn-Phong lighting model with per-instance transforms

// Vertex shader inputs
struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
  // Epic 3.13: Instance transform (mat4 = 4 vec4s)
  @location(2) instanceTransform0: vec4<f32>,
  @location(3) instanceTransform1: vec4<f32>,
  @location(4) instanceTransform2: vec4<f32>,
  @location(5) instanceTransform3: vec4<f32>,
  // Epic 3.13: Instance color (vec4)
  @location(6) instanceColor: vec4<f32>,
}

// Vertex shader outputs / Fragment shader inputs
struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) worldPosition: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) instanceColor: vec4<f32>,
}

// Uniforms - bind group 0
// For instanced rendering: uModelViewProjection actually contains viewProjection (no per-object model)
struct Uniforms {
  modelViewProjection: mat4x4<f32>,  // Actually viewProjection for instanced shader
  model: mat4x4<f32>,                // UNUSED in instanced shader
  normalMatrix: mat3x3<f32>,         // UNUSED in instanced shader
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

  // Reconstruct model matrix from instance attributes
  let model = mat4x4<f32>(
    input.instanceTransform0,
    input.instanceTransform1,
    input.instanceTransform2,
    input.instanceTransform3
  );

  // Transform normal using normal matrix from instance transform
  // NOTE: For correct lighting, the normal matrix should be the inverse transpose
  // of the model matrix. WGSL doesn't have built-in inverse(), so we expect the
  // CPU to pre-compute inverse-transpose and pass it as part of the instance data.
  // For now, we use the upper-left 3x3 which ONLY works for uniform scaling.
  // TODO: Add normalMatrix to instance data (3 additional vec4s per instance)
  let normalMatrix = mat3x3<f32>(
    model[0].xyz,
    model[1].xyz,
    model[2].xyz
  );

  // Transform normal
  output.normal = normalize(normalMatrix * input.normal);

  // Transform position to world space
  let worldPosition = model * vec4<f32>(input.position, 1.0);
  output.worldPosition = worldPosition.xyz;

  // Transform to clip space
  // uniforms.modelViewProjection is actually viewProj matrix (no per-object model)
  // We multiply by instance model here
  output.position = uniforms.modelViewProjection * worldPosition;

  // Pass per-instance color to fragment shader
  output.instanceColor = input.instanceColor;

  return output;
}

// Fragment shader (same as non-instanced version)
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

  // Use per-instance color instead of uniform baseColor
  let baseColor = input.instanceColor.rgb;
  let color = baseColor * (ambient + diffuse) + vec3<f32>(1.0) * specular * 0.3;

  return vec4<f32>(color, input.instanceColor.a);
}
