// Retro Lambert shader - VERTEX lighting only (PS1/PS2 style)
// NO DISCARD variant - lets blend equation handle transparency for soft edges

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

struct Material {
  albedo: vec4<f32>,
  _padding: vec4<f32>,
}

@group(0) @binding(0) var<uniform> camera: Camera;
@group(1) @binding(0) var baseTexture: texture_2d<f32>;
@group(1) @binding(1) var baseSampler: sampler;
@group(1) @binding(2) var<uniform> material: Material;
@group(2) @binding(0) var<storage, read> lights: array<Light>;

struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) uv: vec2<f32>,
  @location(3) color: vec4<f32>,   // Vertex-painted ambient
}

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) lightColor: vec3<f32>,  // Pre-computed in vertex shader
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

  // Transform position
  out.position = camera.viewProj * vec4<f32>(in.position, 1.0);
  out.uv = in.uv;

  // Compute vertex lighting (PS1/PS2 style)
  let diffuseLight = computeLambert(in.position, in.normal);

  // Combine with vertex-painted ambient color
  out.lightColor = diffuseLight + in.color.rgb;

  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  // Sample texture
  let texColor = textureSample(baseTexture, baseSampler, in.uv);

  // NO discard - blend equation handles transparency
  // This allows soft edges to fade properly instead of showing black fringes

  // Apply pre-computed vertex lighting
  let finalColor = texColor.rgb * material.albedo.rgb * in.lightColor;

  return vec4<f32>(finalColor, texColor.a * material.albedo.a);
}
