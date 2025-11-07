#version 300 es

// Vertex attributes
in vec3 a_position;
in vec3 a_normal;
in vec2 a_texcoord;
in vec4 a_tangent; // xyz = tangent, w = handedness

// Uniforms
uniform mat4 u_modelMatrix;
uniform mat4 u_viewMatrix;
uniform mat4 u_projectionMatrix;
uniform mat3 u_normalMatrix;

// Outputs to fragment shader
out vec3 v_worldPosition;
out vec3 v_normal;
out vec2 v_texcoord;
out mat3 v_TBN; // Tangent-Bitangent-Normal matrix for normal mapping

void main() {
    // Transform position
    vec4 worldPosition = u_modelMatrix * vec4(a_position, 1.0);
    v_worldPosition = worldPosition.xyz;

    gl_Position = u_projectionMatrix * u_viewMatrix * worldPosition;

    // Transform normal
    v_normal = normalize(u_normalMatrix * a_normal);

    // Pass through texture coordinates
    v_texcoord = a_texcoord;

    // Compute TBN matrix for normal mapping
    vec3 T = normalize(u_normalMatrix * a_tangent.xyz);
    vec3 N = v_normal;
    vec3 B = cross(N, T) * a_tangent.w; // Handedness
    v_TBN = mat3(T, B, N);
}
