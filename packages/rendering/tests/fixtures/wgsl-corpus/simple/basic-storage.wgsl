// Basic storage buffer test
@group(0) @binding(0) var<storage> data: array<f32>;

@compute @workgroup_size(64)
fn cs_main(@builtin(global_invocation_id) id: vec3u) {
  let value = data[id.x];
}
