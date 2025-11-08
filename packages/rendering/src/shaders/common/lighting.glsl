/**
 * Common lighting functions
 *
 * PBR (Physically-Based Rendering) lighting calculations.
 */

#include "common/math.glsl"

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
 * Calculate PBR direct lighting contribution
 *
 * @param N - Surface normal
 * @param V - View direction (to camera)
 * @param L - Light direction (to light)
 * @param albedo - Surface albedo color
 * @param metallic - Metallic factor [0,1]
 * @param roughness - Roughness factor [0,1]
 * @param radiance - Incoming light radiance
 * @returns Outgoing light radiance
 */
vec3 calculateDirectLighting(
    vec3 N,
    vec3 V,
    vec3 L,
    vec3 albedo,
    float metallic,
    float roughness,
    vec3 radiance
) {
    // Calculate halfway vector
    vec3 H = normalize(V + L);

    // Calculate reflectance at normal incidence
    vec3 F0 = vec3(0.04);
    F0 = mix(F0, albedo, metallic);

    // Cook-Torrance BRDF
    float NDF = distributionGGX(N, H, roughness);
    float G = geometrySmith(N, V, L, roughness);
    vec3 F = fresnelSchlick(max(dot(H, V), 0.0), F0);

    vec3 numerator = NDF * G * F;
    float denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0);
    vec3 specular = numerator / max(denominator, EPSILON);

    // Energy conservation
    vec3 kS = F; // Specular contribution
    vec3 kD = vec3(1.0) - kS; // Diffuse contribution
    kD *= 1.0 - metallic; // Metals don't have diffuse

    // Lambertian diffuse
    vec3 diffuse = kD * albedo / PI;

    // Calculate final radiance
    float NdotL = max(dot(N, L), 0.0);
    return (diffuse + specular) * radiance * NdotL;
}
