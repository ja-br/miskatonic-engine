/**
 * Common math functions and constants
 *
 * Shared across all shaders for consistency.
 */

// Mathematical constants
const float PI = 3.14159265359;
const float TWO_PI = 6.28318530718;
const float HALF_PI = 1.57079632679;
const float EPSILON = 0.0001;

/**
 * Saturate (clamp to [0,1])
 */
float saturate(float x) {
    return clamp(x, 0.0, 1.0);
}

vec2 saturate(vec2 x) {
    return clamp(x, 0.0, 1.0);
}

vec3 saturate(vec3 x) {
    return clamp(x, 0.0, 1.0);
}

vec4 saturate(vec4 x) {
    return clamp(x, 0.0, 1.0);
}

/**
 * Remap value from one range to another
 */
float remap(float value, float fromMin, float fromMax, float toMin, float toMax) {
    return toMin + (value - fromMin) * (toMax - toMin) / (fromMax - fromMin);
}

/**
 * Smoothstep with custom edge values
 */
float smootherstep(float edge0, float edge1, float x) {
    float t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

/**
 * Luminance (perceptual brightness)
 */
float luminance(vec3 color) {
    return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

/**
 * Safe normalize (returns zero vector if length is zero)
 */
vec3 safeNormalize(vec3 v) {
    float len = length(v);
    return len > EPSILON ? v / len : vec3(0.0);
}
