// Epic 3.13: Instanced vertex shader with per-instance transform and color
attribute vec3 aPosition;
attribute vec3 aNormal;

// Epic 3.13: Instance transform (mat4 = 4 vec4 attributes at locations 2-5)
attribute vec4 aInstanceTransform0;
attribute vec4 aInstanceTransform1;
attribute vec4 aInstanceTransform2;
attribute vec4 aInstanceTransform3;

// Epic 3.13: Instance color (vec4 at location 6)
attribute vec4 aInstanceColor;

uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;
uniform vec3 uLightDir;

varying vec3 vNormal;
varying vec3 vPosition;
varying vec4 vColor;

void main() {
  // Reconstruct model matrix from instance attributes
  mat4 uModel = mat4(
    aInstanceTransform0,
    aInstanceTransform1,
    aInstanceTransform2,
    aInstanceTransform3
  );

  // Calculate normal matrix as inverse transpose of model matrix
  // This is required for correct lighting with non-uniform scaling
  mat3 uNormalMatrix = transpose(inverse(mat3(uModel)));

  vNormal = normalize(uNormalMatrix * aNormal);
  vec4 worldPosition = uModel * vec4(aPosition, 1.0);
  vPosition = worldPosition.xyz;
  vColor = aInstanceColor;  // Pass per-instance color to fragment shader
  gl_Position = uProjectionMatrix * uViewMatrix * worldPosition;
}
