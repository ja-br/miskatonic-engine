// Nested structs and arrays
struct Transform {
  position: vec3f,
  rotation: vec4f,
  scale: vec3f,
}

struct Bone {
  transform: Transform,
  parentIndex: i32,
  _padding: vec3f,
}

struct Skeleton {
  bones: array<Bone, 64>,
  boneCount: u32,
}

@group(0) @binding(0) var<uniform> skeleton: Skeleton;
@group(0) @binding(1) var<storage, read> boneMatrices: array<mat4x4f, 64>;

@vertex
fn vs_main(@location(0) position: vec3f) -> @builtin(position) vec4f {
  var finalPos = vec4f(0.0, 0.0, 0.0, 0.0);

  for (var i = 0u; i < skeleton.boneCount; i++) {
    let bone = skeleton.bones[i];
    let boneMatrix = boneMatrices[i];
    finalPos += boneMatrix * vec4f(position, 1.0) * 0.1;
  }

  return finalPos;
}
