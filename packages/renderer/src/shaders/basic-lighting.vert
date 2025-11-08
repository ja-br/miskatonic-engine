attribute vec3 aPosition;
attribute vec3 aNormal;

uniform mat4 uModelViewProjection;
uniform mat4 uModel;
uniform mat3 uNormalMatrix;

varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  vNormal = normalize(uNormalMatrix * aNormal);
  vec4 worldPosition = uModel * vec4(aPosition, 1.0);
  vPosition = worldPosition.xyz;
  gl_Position = uModelViewProjection * vec4(aPosition, 1.0);
}
