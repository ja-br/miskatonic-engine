// Complex compute shader for particle simulation
struct Particle {
  position: vec3f,
  velocity: vec3f,
  acceleration: vec3f,
  lifetime: f32,
}

struct SimulationParams {
  deltaTime: f32,
  gravity: vec3f,
  damping: f32,
}

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> params: SimulationParams;

@compute @workgroup_size(256)
fn cs_main(@builtin(global_invocation_id) id: vec3u) {
  let index = id.x;
  if (index >= arrayLength(&particles)) {
    return;
  }

  var particle = particles[index];

  // Update physics
  particle.acceleration = params.gravity;
  particle.velocity += particle.acceleration * params.deltaTime;
  particle.velocity *= params.damping;
  particle.position += particle.velocity * params.deltaTime;
  particle.lifetime -= params.deltaTime;

  // Boundary check
  if (particle.position.y < 0.0) {
    particle.position.y = 0.0;
    particle.velocity.y = -particle.velocity.y * 0.8;
  }

  particles[index] = particle;
}
