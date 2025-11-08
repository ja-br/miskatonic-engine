/**
 * Common transform functions
 *
 * Shared transformations for vertex and fragment shaders.
 */

/**
 * Compute TBN (Tangent-Bitangent-Normal) matrix for normal mapping
 *
 * @param normal - Surface normal (normalized)
 * @param tangent - Surface tangent (xyz = direction, w = handedness)
 * @param normalMatrix - Normal transformation matrix (transpose(inverse(modelMatrix)))
 * @returns TBN matrix for transforming tangent-space to world-space
 */
mat3 computeTBN(vec3 normal, vec4 tangent, mat3 normalMatrix) {
    vec3 T = normalize(normalMatrix * tangent.xyz);
    vec3 N = normalize(normalMatrix * normal);
    vec3 B = cross(T, N) * tangent.w; // Right-handed, apply handedness
    return mat3(T, B, N);
}

/**
 * Transform position from local to world space
 */
vec3 transformPosition(vec3 position, mat4 modelMatrix) {
    return (modelMatrix * vec4(position, 1.0)).xyz;
}

/**
 * Transform direction from local to world space (no translation)
 */
vec3 transformDirection(vec3 direction, mat3 normalMatrix) {
    return normalize(normalMatrix * direction);
}

/**
 * Compute normal matrix from model matrix
 * normalMatrix = transpose(inverse(mat3(modelMatrix)))
 *
 * NOTE: This is expensive. Prefer passing pre-computed normal matrix as uniform.
 */
mat3 computeNormalMatrix(mat4 modelMatrix) {
    return transpose(inverse(mat3(modelMatrix)));
}
