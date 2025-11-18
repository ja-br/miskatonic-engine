// Retro cube map specular shader - simple reflections (not SSR)
// Vertex lighting + cube map lookup for specular highlights

struct Camera {
  viewProj: mat4x4<f32>,
  position: vec3<f32>,
  _padding: f32,
}

struct Material {
  albedo: vec4<f32>,
  specularIntensity: f32,
  _padding: vec3<f32>,
}

@group(0) @binding(0) var<uniform> camera: Camera;
@group(1) @binding(0) var baseTexture: texture_2d<f32>;
@group(1) @binding(1) var baseSampler: sampler;
@group(1) @binding(2) var<uniform> material: Material;
@group(2) @binding(0) var envCubemap: texture_cube<f32>;
@group(2) @binding(1) var envSampler: sampler;

struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) uv: vec2<f32>,
  @location(3) color: vec4<f32>,   // Vertex-painted lighting
}

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) worldNormal: vec3<f32>,
  @location(2) worldPos: vec3<f32>,
  @location(3) vertexColor: vec4<f32>,
}

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  out.position = camera.viewProj * vec4<f32>(in.position, 1.0);
  out.uv = in.uv;
  out.worldNormal = in.normal;  // Assume already in world space
  out.worldPos = in.position;
  out.vertexColor = in.color;
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  // Base texture
  let texColor = textureSample(baseTexture, baseSampler, in.uv);

  // Apply vertex lighting
  let diffuse = texColor.rgb * material.albedo.rgb * in.vertexColor.rgb;

  // Cube map specular reflection (simple, not physically based)
  let viewDir = normalize(camera.position - in.worldPos);
  let reflectDir = reflect(-viewDir, normalize(in.worldNormal));
  let specular = textureSample(envCubemap, envSampler, reflectDir).rgb;

  // Combine diffuse + specular
  let finalColor = diffuse + specular * material.specularIntensity;

  return vec4<f32>(finalColor, texColor.a * material.albedo.a);
}
