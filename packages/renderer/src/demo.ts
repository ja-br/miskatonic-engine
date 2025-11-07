/**
 * 3D Demo Scene initialization
 */

import {
  Renderer,
  RenderBackend,
  Camera,
  OrbitControls,
  createCube,
  type RendererConfig,
} from '../../rendering/src';

export class Demo {
  private canvas: HTMLCanvasElement;
  private renderer: Renderer | null = null;
  private camera: Camera | null = null;
  private controls: OrbitControls | null = null;
  private animationId: number | null = null;
  private startTime: number = 0;
  private frameCount: number = 0;
  private lastFpsUpdate: number = 0;

  // Rendering resources
  private shaderProgramId: string = 'basic-lighting';
  private vertexBufferId: string = 'cube-positions';
  private normalBufferId: string = 'cube-normals';
  private indexBufferId: string = 'cube-indices';
  private indexCount: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  async initialize(): Promise<boolean> {
    try {
      console.log('Initializing 3D renderer...');

      // Resize canvas to fill window
      this.resizeCanvas();
      window.addEventListener('resize', () => this.resizeCanvas());

      // Create renderer config
      const config: RendererConfig = {
        backend: RenderBackend.WEBGL2,
        canvas: this.canvas,
        width: this.canvas.width,
        height: this.canvas.height,
        antialias: true,
        alpha: false,
      };

      // Initialize renderer (constructor does all initialization)
      this.renderer = new Renderer(config);

      // Create camera
      const aspect = this.canvas.width / this.canvas.height;
      this.camera = new Camera(45, aspect, 0.1, 100);
      this.camera.setPosition(3, 3, 5);
      this.camera.setTarget(0, 0, 0);

      // Setup orbit controls
      this.controls = new OrbitControls(this.camera, this.canvas);

      // Create shader program
      this.createShaders();

      // Create cube geometry
      this.createGeometry();

      console.log('Renderer initialized successfully');
      console.log('Backend:', RenderBackend.WEBGL2);
      console.log('Canvas size:', this.canvas.width, 'x', this.canvas.height);

      return true;
    } catch (error) {
      console.error('Failed to initialize renderer:', error);
      return false;
    }
  }

  private createShaders(): void {
    if (!this.renderer) return;

    const vertexShaderSource = `
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
    `;

    const fragmentShaderSource = `
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
    `;

    const shaderManager = this.renderer.getShaderManager();
    shaderManager.createProgram(this.shaderProgramId, {
      vertex: vertexShaderSource,
      fragment: fragmentShaderSource,
    });
  }

  private createGeometry(): void {
    if (!this.renderer) return;

    const cubeData = createCube(1.0);
    const bufferManager = this.renderer.getBufferManager();

    // Create vertex buffer
    bufferManager.createBuffer(
      this.vertexBufferId,
      'vertex',
      cubeData.positions,
      'static_draw'
    );

    // Create normal buffer
    bufferManager.createBuffer(
      this.normalBufferId,
      'vertex',
      cubeData.normals,
      'static_draw'
    );

    // Create index buffer
    bufferManager.createBuffer(
      this.indexBufferId,
      'index',
      cubeData.indices,
      'static_draw'
    );

    this.indexCount = cubeData.indices.length;
  }

  start(): void {
    if (!this.renderer) {
      console.error('Renderer not initialized');
      return;
    }

    console.log('Starting render loop...');
    this.startTime = performance.now();
    this.lastFpsUpdate = this.startTime;
    this.renderLoop();
  }

  stop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  private resizeCanvas(): void {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.canvas.style.width = `${window.innerWidth}px`;
    this.canvas.style.height = `${window.innerHeight}px`;
  }

  private renderLoop = (): void => {
    if (!this.renderer || !this.camera) return;

    const now = performance.now();
    const deltaTime = (now - this.startTime) / 1000;

    const gl = this.renderer.getContext().gl;
    const shaderManager = this.renderer.getShaderManager();
    const bufferManager = this.renderer.getBufferManager();

    // Clear
    gl.clearColor(0.1, 0.1, 0.2, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);

    // Get shader program
    const program = shaderManager.getProgram(this.shaderProgramId);
    if (!program) return;

    // Use shader
    gl.useProgram(program.program);

    // Create model matrix (identity for now)
    const modelMatrix = new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);

    // Get view-projection matrix
    const viewProjMatrix = this.camera.getViewProjectionMatrix();

    // Compute MVP matrix (projection * view * model)
    const mvpMatrix = this.multiplyMatrices(viewProjMatrix, modelMatrix);

    // Set uniforms
    const mvpLoc = gl.getUniformLocation(program.program, 'uModelViewProjection');
    const modelLoc = gl.getUniformLocation(program.program, 'uModel');
    const normalMatLoc = gl.getUniformLocation(program.program, 'uNormalMatrix');
    const lightDirLoc = gl.getUniformLocation(program.program, 'uLightDir');
    const cameraPosLoc = gl.getUniformLocation(program.program, 'uCameraPos');
    const baseColorLoc = gl.getUniformLocation(program.program, 'uBaseColor');

    gl.uniformMatrix4fv(mvpLoc, false, mvpMatrix);
    gl.uniformMatrix4fv(modelLoc, false, modelMatrix);
    gl.uniformMatrix3fv(normalMatLoc, false, new Float32Array([
      1, 0, 0,
      0, 1, 0,
      0, 0, 1,
    ]));
    gl.uniform3f(lightDirLoc, 0.5, 1.0, 0.5);
    const camPos = this.camera.getPosition();
    gl.uniform3f(cameraPosLoc, camPos[0], camPos[1], camPos[2]);
    gl.uniform3f(baseColorLoc, 0.3, 0.6, 0.9);

    // Bind vertex attributes
    const posLoc = gl.getAttribLocation(program.program, 'aPosition');
    const normLoc = gl.getAttribLocation(program.program, 'aNormal');

    const vertexBuffer = bufferManager.getBuffer(this.vertexBufferId);
    if (vertexBuffer) {
      gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer.buffer);
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);
    }

    const normalBuffer = bufferManager.getBuffer(this.normalBufferId);
    if (normalBuffer) {
      gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer.buffer);
      gl.enableVertexAttribArray(normLoc);
      gl.vertexAttribPointer(normLoc, 3, gl.FLOAT, false, 0, 0);
    }

    // Bind index buffer and draw
    const indexBuffer = bufferManager.getBuffer(this.indexBufferId);
    if (indexBuffer) {
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer.buffer);
      gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
    }

    // Update FPS counter
    this.frameCount++;
    if (now - this.lastFpsUpdate >= 1000) {
      const fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsUpdate));
      this.updateStats(fps, 1, this.indexCount / 3);
      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }

    this.animationId = requestAnimationFrame(this.renderLoop);
  };

  private multiplyMatrices(a: Float32Array, b: Float32Array): Float32Array {
    const out = new Float32Array(16);
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

    let b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
    out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = b[4]; b1 = b[5]; b2 = b[6]; b3 = b[7];
    out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = b[8]; b1 = b[9]; b2 = b[10]; b3 = b[11];
    out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
    out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    return out;
  }

  private updateStats(fps: number, drawCalls: number, triangles: number): void {
    const fpsEl = document.getElementById('fps');
    const drawCallsEl = document.getElementById('draw-calls');
    const trianglesEl = document.getElementById('triangles');

    if (fpsEl) fpsEl.textContent = fps.toString();
    if (drawCallsEl) drawCallsEl.textContent = drawCalls.toString();
    if (trianglesEl) trianglesEl.textContent = triangles.toString();
  }

  dispose(): void {
    this.stop();
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }
  }
}
