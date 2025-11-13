// Complex control flow
@group(0) @binding(0) var<uniform> mode: u32;
@group(0) @binding(1) var<storage, read> data: array<f32>;

@compute @workgroup_size(64)
fn cs_main(@builtin(global_invocation_id) id: vec3u) {
  let index = id.x;

  // Switch-like control flow
  if (mode == 0u) {
    // Mode 0: Simple pass-through
    return;
  } else if (mode == 1u) {
    // Mode 1: Loop processing
    for (var i = 0u; i < 10u; i++) {
      let value = data[index * 10u + i];
      if (value < 0.0) {
        break;
      }
      if (value > 1.0) {
        continue;
      }
    }
  } else if (mode == 2u) {
    // Mode 2: Nested loops
    for (var i = 0u; i < 10u; i++) {
      for (var j = 0u; j < 10u; j++) {
        let value = data[index * 100u + i * 10u + j];
        if (value == 0.0) {
          return;
        }
      }
    }
  } else {
    // Default: Do nothing
    return;
  }
}
