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

  // Transform normal to world space (use 3x3 rotation part)
  let worldNormal = normalize((instanceTransform * vec4<f32>(in.normal, 0.0)).xyz);

  // Transform to clip space
  out.position = camera.viewProj * worldPos;

  // Compute vertex lighting (PS1/PS2 style - all lighting done here, NOT in fragment shader)
  out.lightColor = computeLambert(worldPos.xyz, worldNormal);

  // Pass instance color to fragment shader
  out.color = in.instanceColor;

  return out;
}

// PS1/PS2 ambient lighting constant (prevents pure black shadows)
const RETRO_AMBIENT_COLOR = vec3<f32>(0.15, 0.15, 0.18);

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  // Apply pre-computed vertex lighting to instance color
  let finalColor = in.color.rgb * in.lightColor;

  // Add small ambient term to prevent pure black (retro games had this)
  let litColor = finalColor + RETRO_AMBIENT_COLOR * in.color.rgb;

  return vec4<f32>(litColor, in.color.a);
}
