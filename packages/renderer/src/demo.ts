/**
 * 3D Demo Scene initialization
 */

import {
  Renderer,
  RenderBackend,
  Camera,
  OrbitControls,
  createCube,
  createSphere,
  type RendererConfig,
} from '../../rendering/src';
import {
  PhysicsWorld,
  RapierPhysicsEngine,
  RigidBodyType,
  CollisionShapeType,
  type RigidBodyHandle,
} from '../../physics/src';

export class Demo {
  private canvas: HTMLCanvasElement;
  private renderer: Renderer | null = null;
  private camera: Camera | null = null;
  private controls: OrbitControls | null = null;
  private animationId: number | null = null;
  private startTime: number = 0;
  private frameCount: number = 0;
  private lastFpsUpdate: number = 0;
  private resizeHandler: (() => void) | null = null;

  // Rendering resources
  private shaderProgramId: string = 'basic-lighting';
  private cubeVertexBufferId: string = 'cube-positions';
  private cubeNormalBufferId: string = 'cube-normals';
  private cubeIndexBufferId: string = 'cube-indices';
  private cubeIndexCount: number = 0;
  private sphereVertexBufferId: string = 'sphere-positions';
  private sphereNormalBufferId: string = 'sphere-normals';
  private sphereIndexBufferId: string = 'sphere-indices';
  private sphereIndexCount: number = 0;

  // Physics
  private physicsWorld: PhysicsWorld | null = null;
  private diceBodies: Array<{ handle: RigidBodyHandle; sides: number }> = [];
  private groundBody: RigidBodyHandle | null = null;
  private lastTime: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  async initialize(): Promise<boolean> {
    try {
      console.log('Initializing 3D renderer...');

      // Setup WebGL context loss handling
      this.setupContextLossHandling();

      // Resize canvas to fill window
      this.resizeCanvas();
      this.resizeHandler = () => this.resizeCanvas();
      window.addEventListener('resize', this.resizeHandler);

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

      // Initialize physics world
      await this.initializePhysics();

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
    try {
      shaderManager.createProgram(this.shaderProgramId, {
        vertex: vertexShaderSource,
        fragment: fragmentShaderSource,
      });

      // Verify shader program was created successfully
      const program = shaderManager.getProgram(this.shaderProgramId);
      if (!program) {
        throw new Error('Shader program creation failed - program not found after creation');
      }

      console.log('Shaders compiled and linked successfully');
    } catch (error) {
      console.error('Shader compilation failed:', error);
      throw new Error(`Failed to create shader program: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private createGeometry(): void {
    if (!this.renderer) return;

    const bufferManager = this.renderer.getBufferManager();

    // Create cube geometry
    const cubeData = createCube(1.0);
    bufferManager.createBuffer(
      this.cubeVertexBufferId,
      'vertex',
      cubeData.positions,
      'static_draw'
    );
    bufferManager.createBuffer(
      this.cubeNormalBufferId,
      'vertex',
      cubeData.normals,
      'static_draw'
    );
    bufferManager.createBuffer(
      this.cubeIndexBufferId,
      'index',
      cubeData.indices,
      'static_draw'
    );
    this.cubeIndexCount = cubeData.indices.length;

    // Create sphere geometry
    const sphereData = createSphere(0.5, 16, 12);
    bufferManager.createBuffer(
      this.sphereVertexBufferId,
      'vertex',
      sphereData.positions,
      'static_draw'
    );
    bufferManager.createBuffer(
      this.sphereNormalBufferId,
      'vertex',
      sphereData.normals,
      'static_draw'
    );
    bufferManager.createBuffer(
      this.sphereIndexBufferId,
      'index',
      sphereData.indices,
      'static_draw'
    );
    this.sphereIndexCount = sphereData.indices.length;
  }

  private async initializePhysics(): Promise<void> {
    console.log('Initializing physics...');

    // Create physics world with Rapier engine
    const engine = new RapierPhysicsEngine();
    this.physicsWorld = await PhysicsWorld.create(engine, {
      gravity: { x: 0, y: -9.81, z: 0 },
      timestep: 1 / 60,
    });

    // Create ground plane (static)
    this.groundBody = this.physicsWorld.createRigidBody({
      type: RigidBodyType.STATIC,
      position: { x: 0, y: -2, z: 0 },
      collisionShape: {
        type: CollisionShapeType.BOX,
        halfExtents: { x: 10, y: 0.5, z: 10 },
      },
      friction: 0.5,
      restitution: 0.3,
    });

    // Create gaming dice set
    const dice = [
      // D4 (tetrahedron - use small sphere as approximation)
      { sides: 4, position: { x: -4, y: 10, z: 0 }, shape: CollisionShapeType.SPHERE, radius: 0.4 },
      // D6 (cube)
      { sides: 6, position: { x: -2, y: 12, z: 0 }, shape: CollisionShapeType.BOX, halfExtents: { x: 0.5, y: 0.5, z: 0.5 } },
      // D8 (octahedron - use sphere)
      { sides: 8, position: { x: 0, y: 14, z: 0 }, shape: CollisionShapeType.SPHERE, radius: 0.5 },
      // D10 (pentagonal trapezohedron - use cylinder)
      { sides: 10, position: { x: 2, y: 16, z: 0 }, shape: CollisionShapeType.CYLINDER, radius: 0.45, height: 1.0 },
      // D12 (dodecahedron - use sphere)
      { sides: 12, position: { x: 4, y: 18, z: 0 }, shape: CollisionShapeType.SPHERE, radius: 0.55 },
      // D20 (icosahedron - use sphere)
      { sides: 20, position: { x: 0, y: 20, z: 0 }, shape: CollisionShapeType.SPHERE, radius: 0.6 },
    ];

    for (const die of dice) {
      let collisionShape: any;

      if (die.shape === CollisionShapeType.BOX) {
        collisionShape = {
          type: CollisionShapeType.BOX,
          halfExtents: die.halfExtents,
        };
      } else if (die.shape === CollisionShapeType.SPHERE) {
        collisionShape = {
          type: CollisionShapeType.SPHERE,
          radius: die.radius,
        };
      } else if (die.shape === CollisionShapeType.CYLINDER) {
        collisionShape = {
          type: CollisionShapeType.CYLINDER,
          radius: die.radius,
          height: die.height,
        };
      }

      const handle = this.physicsWorld.createRigidBody({
        type: RigidBodyType.DYNAMIC,
        position: die.position,
        collisionShape,
        mass: 0.02, // Lighter like real dice
        friction: 0.4,
        restitution: 0.5,
      });

      this.diceBodies.push({ handle, sides: die.sides });
    }

    // Add collision callback to log collisions
    this.physicsWorld.onCollision((event) => {
      console.log('Collision detected:', event);
    });

    console.log('Physics initialized successfully');
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

  private setupContextLossHandling(): void {
    // Handle WebGL context loss
    this.canvas.addEventListener('webglcontextlost', (event) => {
      console.warn('WebGL context lost. Preventing default to allow restoration.');
      event.preventDefault();
      this.stop(); // Stop render loop
    }, false);

    // Handle WebGL context restoration
    this.canvas.addEventListener('webglcontextrestored', async () => {
      console.log('WebGL context restored. Re-initializing renderer...');
      try {
        // Re-initialize the renderer
        const config: RendererConfig = {
          backend: RenderBackend.WEBGL2,
          canvas: this.canvas,
          width: this.canvas.width,
          height: this.canvas.height,
          antialias: true,
          alpha: false,
        };
        this.renderer = new Renderer(config);

        // Recreate shaders and geometry
        this.createShaders();
        this.createGeometry();

        // Restart render loop
        this.start();
        console.log('Renderer successfully restored after context loss');
      } catch (error) {
        console.error('Failed to restore renderer after context loss:', error);
      }
    }, false);
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
    const deltaTime = this.lastTime ? (now - this.lastTime) / 1000 : 0;
    this.lastTime = now;

    // Step physics simulation
    let alpha = 0; // Interpolation factor
    if (this.physicsWorld && deltaTime > 0) {
      alpha = this.physicsWorld.step(deltaTime);
    }

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

    // Get view-projection matrix
    const viewProjMatrix = this.camera.getViewProjectionMatrix();

    // Get uniform locations
    const mvpLoc = gl.getUniformLocation(program.program, 'uModelViewProjection');
    const modelLoc = gl.getUniformLocation(program.program, 'uModel');
    const normalMatLoc = gl.getUniformLocation(program.program, 'uNormalMatrix');
    const lightDirLoc = gl.getUniformLocation(program.program, 'uLightDir');
    const cameraPosLoc = gl.getUniformLocation(program.program, 'uCameraPos');
    const baseColorLoc = gl.getUniformLocation(program.program, 'uBaseColor');

    // Set common uniforms
    gl.uniform3f(lightDirLoc, 0.5, 1.0, 0.5);
    const camPos = this.camera.getPosition();
    gl.uniform3f(cameraPosLoc, camPos[0], camPos[1], camPos[2]);

    // Get attribute locations
    const posLoc = gl.getAttribLocation(program.program, 'aPosition');
    const normLoc = gl.getAttribLocation(program.program, 'aNormal');

    let drawCalls = 0;

    // Helper function to get die color based on number of sides
    const getDieColor = (sides: number): [number, number, number] => {
      switch (sides) {
        case 4: return [1.0, 0.3, 0.3];   // Red - D4
        case 6: return [0.3, 0.8, 0.3];   // Green - D6
        case 8: return [0.3, 0.5, 1.0];   // Blue - D8
        case 10: return [0.9, 0.7, 0.2];  // Yellow - D10
        case 12: return [0.8, 0.3, 0.9];  // Purple - D12
        case 20: return [1.0, 0.5, 0.0];  // Orange - D20
        default: return [0.7, 0.7, 0.7];  // Gray
      }
    };

    // Get buffers
    const cubeVertexBuffer = bufferManager.getBuffer(this.cubeVertexBufferId);
    const cubeNormalBuffer = bufferManager.getBuffer(this.cubeNormalBufferId);
    const cubeIndexBuffer = bufferManager.getBuffer(this.cubeIndexBufferId);
    const sphereVertexBuffer = bufferManager.getBuffer(this.sphereVertexBufferId);
    const sphereNormalBuffer = bufferManager.getBuffer(this.sphereNormalBufferId);
    const sphereIndexBuffer = bufferManager.getBuffer(this.sphereIndexBufferId);

    // Draw all dice
    if (this.physicsWorld && this.diceBodies.length > 0) {
      for (const die of this.diceBodies) {
        const position = this.physicsWorld.getPosition(die.handle);
        const rotation = this.physicsWorld.getRotation(die.handle);
        const modelMatrix = this.createModelMatrix(position, rotation);
        const mvpMatrix = this.multiplyMatrices(viewProjMatrix, modelMatrix);

        // Use cube mesh for D6, sphere for everything else
        const useCube = die.sides === 6;

        if (useCube && cubeVertexBuffer && cubeNormalBuffer && cubeIndexBuffer) {
          gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexBuffer.buffer);
          gl.enableVertexAttribArray(posLoc);
          gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);

          gl.bindBuffer(gl.ARRAY_BUFFER, cubeNormalBuffer.buffer);
          gl.enableVertexAttribArray(normLoc);
          gl.vertexAttribPointer(normLoc, 3, gl.FLOAT, false, 0, 0);

          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeIndexBuffer.buffer);
        } else if (!useCube && sphereVertexBuffer && sphereNormalBuffer && sphereIndexBuffer) {
          gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexBuffer.buffer);
          gl.enableVertexAttribArray(posLoc);
          gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);

          gl.bindBuffer(gl.ARRAY_BUFFER, sphereNormalBuffer.buffer);
          gl.enableVertexAttribArray(normLoc);
          gl.vertexAttribPointer(normLoc, 3, gl.FLOAT, false, 0, 0);

          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphereIndexBuffer.buffer);
        } else {
          continue;
        }

        gl.uniformMatrix4fv(mvpLoc, false, mvpMatrix);
        gl.uniformMatrix4fv(modelLoc, false, modelMatrix);
        gl.uniformMatrix3fv(normalMatLoc, false, new Float32Array([
          1, 0, 0,
          0, 1, 0,
          0, 0, 1,
        ]));

        const [r, g, b] = getDieColor(die.sides);
        gl.uniform3f(baseColorLoc, r, g, b);

        const indexCount = useCube ? this.cubeIndexCount : this.sphereIndexCount;
        gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0);
        drawCalls++;
      }
    }

    // Update FPS counter
    this.frameCount++;
    if (now - this.lastFpsUpdate >= 1000) {
      const fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsUpdate));
      const triangles = (this.indexCount / 3) * drawCalls;
      this.updateStats(fps, drawCalls, triangles);
      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }

    this.animationId = requestAnimationFrame(this.renderLoop);
  };

  private createModelMatrix(position: { x: number; y: number; z: number }, rotation: { x: number; y: number; z: number; w: number }): Float32Array {
    // Convert quaternion to rotation matrix
    const x = rotation.x, y = rotation.y, z = rotation.z, w = rotation.w;
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2;
    const yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;

    return new Float32Array([
      1 - (yy + zz), xy + wz,       xz - wy,       0,
      xy - wz,       1 - (xx + zz), yz + wx,       0,
      xz + wy,       yz - wx,       1 - (xx + yy), 0,
      position.x,    position.y,    position.z,    1,
    ]);
  }

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

    // Remove resize event listener to prevent memory leak
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }

    // Dispose orbit controls
    if (this.controls) {
      this.controls.dispose();
      this.controls = null;
    }

    // Dispose physics world
    if (this.physicsWorld) {
      this.physicsWorld.dispose();
      this.physicsWorld = null;
    }

    // Dispose renderer
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }

    this.camera = null;
    this.diceBodies = [];
    this.groundBody = null;
  }
}
