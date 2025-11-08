#version 300 es
precision highp float;

// Include common functions
#include "common/math.glsl"
#include "common/lighting.glsl"

// Inputs from vertex shader
in vec3 v_worldPosition;
in vec3 v_normal;
in vec2 v_texcoord;
in mat3 v_TBN;

// Material properties
uniform vec4 u_baseColor;
uniform float u_metallic;
uniform float u_roughness;
uniform vec3 u_emissive;
uniform float u_emissiveIntensity;
uniform float u_ao;
uniform float u_normalScale;
uniform float u_opacity;

// Texture maps
uniform sampler2D u_baseColorMap;
uniform sampler2D u_metallicRoughnessMap;
uniform sampler2D u_normalMap;
uniform sampler2D u_emissiveMap;
uniform sampler2D u_aoMap;

// Texture flags (using int instead of bool for compatibility)
uniform int u_hasBaseColorMap;
uniform int u_hasMetallicRoughnessMap;
uniform int u_hasNormalMap;
uniform int u_hasEmissiveMap;
uniform int u_hasAOMap;

// Lighting
uniform vec3 u_cameraPosition;
uniform vec3 u_lightDirection; // Directional light
uniform vec3 u_lightColor;
uniform float u_lightIntensity;
uniform vec3 u_ambientLight;

// Output
out vec4 fragColor;

/**
 * Sample normal from normal map
 */
vec3 getNormalFromMap() {
    if (u_hasNormalMap == 0) {
        return normalize(v_normal);
    }

    // Sample and decode from [0,1] to [-1,1]
    vec3 tangentNormal = texture(u_normalMap, v_texcoord).xyz * 2.0 - 1.0;
    // Scale XY components (intensity) while preserving Z
    tangentNormal = normalize(vec3(tangentNormal.xy * u_normalScale, tangentNormal.z));
    // Transform to world space
    return v_TBN * tangentNormal; // Return un-normalized, will be normalized once in main
}

void main() {
    // Sample textures
    vec4 baseColor = u_baseColor;
    if (u_hasBaseColorMap != 0) {
        baseColor *= texture(u_baseColorMap, v_texcoord);
    }

    float metallic = u_metallic;
    float roughness = u_roughness;
    if (u_hasMetallicRoughnessMap != 0) {
        vec3 mr = texture(u_metallicRoughnessMap, v_texcoord).rgb;
        metallic *= mr.b; // Metallic in blue channel
        roughness *= mr.g; // Roughness in green channel
    }

    vec3 emissive = u_emissive * u_emissiveIntensity;
    if (u_hasEmissiveMap != 0) {
        emissive *= texture(u_emissiveMap, v_texcoord).rgb;
    }

    float ao = u_ao;
    if (u_hasAOMap != 0) {
        ao *= texture(u_aoMap, v_texcoord).r;
    }

    // Get normal (normalize once here)
    vec3 N = normalize(getNormalFromMap());

    // Calculate view direction
    vec3 V = normalize(u_cameraPosition - v_worldPosition);

    // Calculate light direction (directional light)
    vec3 L = normalize(-u_lightDirection);

    // Calculate direct lighting using common function
    vec3 radiance = u_lightColor * u_lightIntensity;
    vec3 Lo = calculateDirectLighting(N, V, L, baseColor.rgb, metallic, roughness, radiance);

    // Ambient lighting (simplified)
    vec3 ambient = u_ambientLight * baseColor.rgb * ao;

    // Final color
    vec3 color = ambient + Lo + emissive;

    // Tone mapping (simple Reinhard)
    color = color / (color + vec3(1.0));

    // Gamma correction
    color = pow(color, vec3(1.0 / 2.2));

    fragColor = vec4(color, baseColor.a * u_opacity);
}
