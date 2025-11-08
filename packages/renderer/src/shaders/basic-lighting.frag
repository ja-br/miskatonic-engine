precision mediump float;

varying vec3 vNormal;
varying vec3 vPosition;

uniform vec3 uLightDir;
uniform vec3 uCameraPos;
uniform vec3 uBaseColor;

void main() {
  // Normalize interpolated normal
  vec3 N = normalize(vNormal);
  vec3 L = normalize(uLightDir);
  vec3 V = normalize(uCameraPos - vPosition);
  vec3 H = normalize(L + V);

  // Simple Blinn-Phong lighting
  float diffuse = max(dot(N, L), 0.0);
  float specular = pow(max(dot(N, H), 0.0), 32.0);
  float ambient = 0.2;

  vec3 color = uBaseColor * (ambient + diffuse) + vec3(1.0) * specular * 0.3;
  gl_FragColor = vec4(color, 1.0);
}
