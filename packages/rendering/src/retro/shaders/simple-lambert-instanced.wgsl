// Retro Lambert shader - VERTEX lighting with GPU instancing
// All lighting calculations done per-vertex (PS1/PS2 style)
// Supports instanced rendering with per-instance transform + color

struct Camera {
  viewProj: mat4x4<f32>,
  position: vec3<f32>,
  _padding: f32,
}

struct Light {
  position: vec3<f32>,
  type_: u32,           // 0 = directional, 1 = point
  color: vec3<f32>,
  intensity: f32,
  direction: vec3<f32>,
  range: f32,
}

@group(0) @binding(0) var<uniform> camera: Camera;
@group(1) @binding(0) var<storage, read> lights: array<Light>;

struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
  // Instance data
  @location(2) instanceTransform0: vec4<f32>,
  @location(3) instanceTransform1: vec4<f32>,
  @location(4) instanceTransform2: vec4<f32>,
  @location(5) instanceTransform3: vec4<f32>,
  @location(6) instanceColor: vec4<f32>,
}

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) lightColor: vec3<f32>,  // Pre-computed lighting (vertex-based)
  @location(1) color: vec4<f32>,       // Instance color
}

// Helper: Extract 3x3 rotation/scale from 4x4 matrix
fn mat4to3(m: mat4x4<f32>) -> mat3x3<f32> {
  return mat3x3<f32>(
    m[0].xyz,
    m[1].xyz,
    m[2].xyz
  );
}

// Helper: Compute inverse transpose for normal transformation
// Required for correct normal transformation with non-uniform scales
// Uses cofactor method since WGSL doesn't provide mat3x3 inverse
fn inverseTranspose3x3(m: mat3x3<f32>) -> mat3x3<f32> {
  // Compute determinant
  let det = determinant(m);
  if (abs(det) < 0.0001) {
    // Fallback to identity if matrix is singular
    return mat3x3<f32>(
      vec3<f32>(1.0, 0.0, 0.0),
      vec3<f32>(0.0, 1.0, 0.0),
      vec3<f32>(0.0, 0.0, 1.0)
    );
  }

  // Compute cofactor matrix (which is transpose of adjugate)
  // For inverse transpose, we can compute cofactor directly without full inverse
  let invDet = 1.0 / det;

  // Cofactor matrix elements
  let c00 = (m[1][1] * m[2][2] - m[1][2] * m[2][1]) * invDet;
  let c01 = (m[1][2] * m[2][0] - m[1][0] * m[2][2]) * invDet;
  let c02 = (m[1][0] * m[2][1] - m[1][1] * m[2][0]) * invDet;

  let c10 = (m[0][2] * m[2][1] - m[0][1] * m[2][2]) * invDet;
  let c11 = (m[0][0] * m[2][2] - m[0][2] * m[2][0]) * invDet;
  let c12 = (m[0][1] * m[2][0] - m[0][0] * m[2][1]) * invDet;

  let c20 = (m[0][1] * m[1][2] - m[0][2] * m[1][1]) * invDet;
  let c21 = (m[0][2] * m[1][0] - m[0][0] * m[1][2]) * invDet;
  let c22 = (m[0][0] * m[1][1] - m[0][1] * m[1][0]) * invDet;

  // Cofactor matrix is already the transpose of inverse
  return mat3x3<f32>(
    vec3<f32>(c00, c01, c02),
    vec3<f32>(c10, c11, c12),
    vec3<f32>(c20, c21, c22)
  );
}

// Simple Lambert diffuse lighting (computed per-vertex)
fn computeLambert(worldPos: vec3<f32>, normal: vec3<f32>) -> vec3<f32> {
  var lightAccum = vec3<f32>(0.0, 0.0, 0.0);

  let numLights = arrayLength(&lights);
  for (var i = 0u; i < numLights; i = i + 1u) {
    let light = lights[i];
    var lightDir: vec3<f32>;
    var attenuation = 1.0;

    if (light.type_ == 0u) {
      // Directional light
      lightDir = normalize(-light.direction);
    } else {
      // Point light
      let toLight = light.position - worldPos;
      let distance = length(toLight);
      lightDir = normalize(toLight);

      // Simple distance attenuation
      attenuation = max(0.0, 1.0 - (distance / light.range));
      attenuation = attenuation * attenuation;
    }

    // Simple Lambert: N dot L
    let NdotL = max(0.0, dot(normal, lightDir));
    lightAccum = lightAccum + light.color * light.intensity * NdotL * attenuation;
  }

  return lightAccum;
}

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
  var out: VertexOutput;

  // Reconstruct instance transform matrix
  let instanceTransform = mat4x4<f32>(
    in.instanceTransform0,
    in.instanceTransform1,
    in.instanceTransform2,
    in.instanceTransform3
  );

  // Transform position to world space
  let worldPos = instanceTransform * vec4<f32>(in.position, 1.0);

  // Transform normal to world space using inverse transpose
  // This is mathematically correct for non-uniform scales
  let normalMatrix = inverseTranspose3x3(mat4to3(instanceTransform));
  let worldNormal = normalize(normalMatrix * in.normal);

  // Transform to clip space
  out.position = camera.viewProj * worldPos;

  // Compute vertex lighting (PS1/PS2 style - all lighting done here, NOT in fragment shader)
  out.lightColor = computeLambert(worldPos.xyz, worldNormal);

  // Pass instance color to fragment shader
  out.color = in.instanceColor;

  return out;
}

// PS1/PS2 ambient lighting constant (prevents pure black shadows)
const RETRO_AMBIENT_COLOR = vec3<f32>(0.3, 0.3, 0.35);

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  // Physically-based lighting equation:
  // 1. Start with diffuse lighting (allow > 1.0 for bright highlights)
  let diffuse = in.lightColor;

  // 2. Add uniform ambient (NOT multiplied by surface color - ambient is constant)
  let totalLight = diffuse + RETRO_AMBIENT_COLOR;

  // 3. Multiply by surface albedo
  let finalColor = in.color.rgb * totalLight;

  // 4. Clamp only at the end for HDR->LDR conversion
  return vec4<f32>(min(finalColor, vec3<f32>(1.0)), in.color.a);
}
