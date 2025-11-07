#version 300 es
precision highp float;

// Constants
const float PI = 3.14159265359;
const float EPSILON = 0.0001; // Balance between precision and preventing div-by-zero

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
 * Fresnel-Schlick approximation
 * F0: Base reflectivity at normal incidence
 * cosTheta: Angle between view and halfway vector
 */
vec3 fresnelSchlick(float cosTheta, vec3 F0) {
    return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

/**
 * GGX/Trowbridge-Reitz normal distribution function
 * Describes distribution of microfacets
 */
float distributionGGX(vec3 N, vec3 H, float roughness) {
    float a = roughness * roughness;
    float a2 = a * a;
    float NdotH = max(dot(N, H), 0.0);
    float NdotH2 = NdotH * NdotH;

    float num = a2;
    float denom = (NdotH2 * (a2 - 1.0) + 1.0);
    denom = PI * denom * denom;

    return num / max(denom, EPSILON);
}

/**
 * Smith's Schlick-GGX geometry function
 * Describes self-shadowing of microfacets
 */
float geometrySchlickGGX(float NdotV, float roughness) {
    float r = (roughness + 1.0);
    float k = (r * r) / 8.0;

    float num = NdotV;
    float denom = NdotV * (1.0 - k) + k;

    return num / max(denom, EPSILON);
}

/**
 * Smith's geometry function with height-correlated masking-shadowing
 */
float geometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
    float NdotV = max(dot(N, V), 0.0);
    float NdotL = max(dot(N, L), 0.0);
    float ggx2 = geometrySchlickGGX(NdotV, roughness);
    float ggx1 = geometrySchlickGGX(NdotL, roughness);

    return ggx1 * ggx2;
}

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

    // Calculate halfway vector
    vec3 H = normalize(V + L);

    // Calculate reflectance at normal incidence
    // Dielectrics have F0 of 0.04, metals use albedo as F0
    vec3 F0 = vec3(0.04);
    F0 = mix(F0, baseColor.rgb, metallic);

    // Cook-Torrance BRDF
    float NDF = distributionGGX(N, H, roughness);
    float G = geometrySmith(N, V, L, roughness);
    vec3 F = fresnelSchlick(max(dot(H, V), 0.0), F0);

    vec3 numerator = NDF * G * F;
    float denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0);
    vec3 specular = numerator / max(denominator, EPSILON);

    // Energy conservation: kS + kD = 1.0
    vec3 kS = F; // Specular contribution
    vec3 kD = vec3(1.0) - kS; // Diffuse contribution
    kD *= 1.0 - metallic; // Metals don't have diffuse

    // Lambertian diffuse
    vec3 diffuse = kD * baseColor.rgb / PI;

    // Calculate radiance
    float NdotL = max(dot(N, L), 0.0);
    vec3 radiance = u_lightColor * u_lightIntensity;

    // Outgoing radiance (Lo)
    vec3 Lo = (diffuse + specular) * radiance * NdotL;

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
