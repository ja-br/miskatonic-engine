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
  private diceBodies: Array<{ handle: RigidBodyHandle; sides: number; spawnPos: { x: number; y: number; z: number }; angularVel: { x: number; y: number; z: number } }> = [];
  private groundBody: RigidBodyHandle | null = null;
  private lastTime: number = 0;
  private diceSets: number = 1; // Number of dice sets to roll (1 set = 6 dice)

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

      // Create camera - positioned higher and farther to see larger play area
      const aspect = this.canvas.width / this.canvas.height;
      this.camera = new Camera(45, aspect, 0.1, 300); // Far plane at 300 for large viewing distance
      this.camera.setPosition(0, 25, 35);
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

    // Create ground plane (static) - larger table surface sized for up to 1200 dice
    const tableSize = 40; // 80x80 total area
    this.groundBody = this.physicsWorld.createRigidBody({
      type: RigidBodyType.STATIC,
      position: { x: 0, y: -1, z: 0 },
      collisionShape: {
        type: CollisionShapeType.BOX,
        halfExtents: { x: tableSize, y: 0.2, z: tableSize },
      },
      friction: 0.6,
      restitution: 0.2,
    });

    // Create invisible walls to contain the dice
    const wallHeight = 10;
    const wallThickness = 0.5;

    // Back wall
    this.physicsWorld.createRigidBody({
      type: RigidBodyType.STATIC,
      position: { x: 0, y: wallHeight / 2, z: -tableSize },
      collisionShape: {
        type: CollisionShapeType.BOX,
        halfExtents: { x: tableSize, y: wallHeight / 2, z: wallThickness },
      },
      friction: 0.3,
      restitution: 0.4,
    });

    // Front wall
    this.physicsWorld.createRigidBody({
      type: RigidBodyType.STATIC,
      position: { x: 0, y: wallHeight / 2, z: tableSize },
      collisionShape: {
        type: CollisionShapeType.BOX,
        halfExtents: { x: tableSize, y: wallHeight / 2, z: wallThickness },
      },
      friction: 0.3,
      restitution: 0.4,
    });

    // Left wall
    this.physicsWorld.createRigidBody({
      type: RigidBodyType.STATIC,
      position: { x: -tableSize, y: wallHeight / 2, z: 0 },
      collisionShape: {
        type: CollisionShapeType.BOX,
        halfExtents: { x: wallThickness, y: wallHeight / 2, z: tableSize },
      },
      friction: 0.3,
      restitution: 0.4,
    });

    // Right wall
    this.physicsWorld.createRigidBody({
      type: RigidBodyType.STATIC,
      position: { x: tableSize, y: wallHeight / 2, z: 0 },
      collisionShape: {
        type: CollisionShapeType.BOX,
        halfExtents: { x: wallThickness, y: wallHeight / 2, z: tableSize },
      },
      friction: 0.3,
      restitution: 0.4,
    });

    // Create gaming dice set with varied starting positions
    const dice = [
      // D4 (tetrahedron - use small sphere as approximation)
      { sides: 4, position: { x: -3, y: 15, z: -1 }, shape: CollisionShapeType.SPHERE, radius: 0.4, angularVel: { x: 2, y: 3, z: 1 } },
      // D6 (cube)
      { sides: 6, position: { x: -1.5, y: 18, z: 1 }, shape: CollisionShapeType.BOX, halfExtents: { x: 0.5, y: 0.5, z: 0.5 }, angularVel: { x: -1, y: 2, z: -2 } },
      // D8 (octahedron - use sphere)
      { sides: 8, position: { x: 1, y: 20, z: -0.5 }, shape: CollisionShapeType.SPHERE, radius: 0.5, angularVel: { x: 1, y: -2, z: 3 } },
      // D10 (pentagonal trapezohedron - use cylinder)
      { sides: 10, position: { x: 3, y: 22, z: 0.5 }, shape: CollisionShapeType.CYLINDER, radius: 0.45, height: 1.0, angularVel: { x: -3, y: 1, z: -1 } },
      // D12 (dodecahedron - use sphere)
      { sides: 12, position: { x: -2, y: 24, z: 1.5 }, shape: CollisionShapeType.SPHERE, radius: 0.55, angularVel: { x: 2, y: -1, z: 2 } },
      // D20 (icosahedron - use sphere)
      { sides: 20, position: { x: 0.5, y: 26, z: -1.5 }, shape: CollisionShapeType.SPHERE, radius: 0.6, angularVel: { x: -2, y: 3, z: -2 } },
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
        angularVelocity: die.angularVel,
      });

      this.diceBodies.push({
        handle,
        sides: die.sides,
        spawnPos: die.position,
        angularVel: die.angularVel,
      });
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

    // Clear with dark background
    gl.clearColor(0.05, 0.05, 0.08, 1.0);
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
        // Calculate normal matrix (inverse transpose of model matrix upper-left 3x3)
        // For now using identity since we don't have non-uniform scaling
        gl.uniformMatrix3fv(normalMatLoc, false, new Float32Array([
          1, 0, 0,
          0, 1, 0,
          0, 0, 1,
        ]));

        // Add depth-based darkening and respawn pulse
        const depth = Math.max(0, Math.min(1, (position.y + 1) / 10));
        const [r, g, b] = getDieColor(die.sides);
        let brightness = 0.7 + depth * 0.3; // Brighter when higher up

        // Add pulsing effect when near respawn time
        const respawnProgress = this.respawnTimer / this.respawnDelay;
        if (respawnProgress > 0.7) {
          const pulse = Math.sin((respawnProgress - 0.7) * Math.PI * 10) * 0.2 + 1.0;
          brightness *= pulse;
        }

        gl.uniform3f(baseColorLoc, r * brightness, g * brightness, b * brightness);

        const indexCount = useCube ? this.cubeIndexCount : this.sphereIndexCount;
        gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0);
        drawCalls++;
      }
    }

    // Update FPS counter
    this.frameCount++;
    if (now - this.lastFpsUpdate >= 1000) {
      const fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsUpdate));
      // Calculate total triangles (approximate average between cube and sphere)
      const avgTrianglesPerDie = ((this.cubeIndexCount / 3) + (this.sphereIndexCount / 3)) / 2;
      const triangles = Math.round(avgTrianglesPerDie * drawCalls);
      this.updateStats(fps, drawCalls, triangles);
      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }

    this.animationId = requestAnimationFrame(this.renderLoop);
  };

  private respawnDice(): void {
    if (!this.physicsWorld) return;

    // Respawn all current dice
    for (const die of this.diceBodies) {
      // Reset position to spawn point with random offset (spread across larger area)
      const randomOffset = {
        x: (Math.random() - 0.5) * 20.0,
        y: Math.random() * 5.0,
        z: (Math.random() - 0.5) * 20.0,
      };

      this.physicsWorld.setPosition(die.handle, {
        x: die.spawnPos.x + randomOffset.x,
        y: die.spawnPos.y + randomOffset.y,
        z: die.spawnPos.z + randomOffset.z,
      });

      // Random rotation
      const randomRot = Math.random() * Math.PI * 2;
      const axis = Math.random() < 0.33 ? { x: 1, y: 0, z: 0 } : Math.random() < 0.5 ? { x: 0, y: 1, z: 0 } : { x: 0, y: 0, z: 1 };
      const halfAngle = randomRot / 2;
      const s = Math.sin(halfAngle);
      this.physicsWorld.setRotation(die.handle, {
        x: axis.x * s,
        y: axis.y * s,
        z: axis.z * s,
        w: Math.cos(halfAngle),
      });

      // Set linear velocity to zero
      this.physicsWorld.setLinearVelocity(die.handle, { x: 0, y: 0, z: 0 });

      // Set new random angular velocity
      const newAngularVel = {
        x: die.angularVel.x * (0.5 + Math.random()),
        y: die.angularVel.y * (0.5 + Math.random()),
        z: die.angularVel.z * (0.5 + Math.random()),
      };
      this.physicsWorld.setAngularVelocity(die.handle, newAngularVel);

      // Wake up the body
      this.physicsWorld.wakeUp(die.handle);
    }
  }

  private addMoreDice(count: number): void {
    if (!this.physicsWorld) return;

    // Dice template
    const diceTemplates = [
      { sides: 4, shape: CollisionShapeType.SPHERE, radius: 0.4 },
      { sides: 6, shape: CollisionShapeType.BOX, halfExtents: { x: 0.5, y: 0.5, z: 0.5 } },
      { sides: 8, shape: CollisionShapeType.SPHERE, radius: 0.5 },
      { sides: 10, shape: CollisionShapeType.CYLINDER, radius: 0.45, height: 1.0 },
      { sides: 12, shape: CollisionShapeType.SPHERE, radius: 0.55 },
      { sides: 20, shape: CollisionShapeType.SPHERE, radius: 0.6 },
    ];

    for (let i = 0; i < count; i++) {
      const template = diceTemplates[Math.floor(Math.random() * diceTemplates.length)];

      let collisionShape: any;
      if (template.shape === CollisionShapeType.BOX) {
        collisionShape = { type: CollisionShapeType.BOX, halfExtents: template.halfExtents };
      } else if (template.shape === CollisionShapeType.SPHERE) {
        collisionShape = { type: CollisionShapeType.SPHERE, radius: template.radius };
      } else if (template.shape === CollisionShapeType.CYLINDER) {
        collisionShape = { type: CollisionShapeType.CYLINDER, radius: template.radius, height: template.height };
      }

      const spawnPos = {
        x: (Math.random() - 0.5) * 70, // Spread across larger 80x80 area
        y: 15 + Math.random() * 10,
        z: (Math.random() - 0.5) * 70,
      };

      const angularVel = {
        x: (Math.random() - 0.5) * 6,
        y: (Math.random() - 0.5) * 6,
        z: (Math.random() - 0.5) * 6,
      };

      const handle = this.physicsWorld.createRigidBody({
        type: RigidBodyType.DYNAMIC,
        position: spawnPos,
        collisionShape,
        mass: 0.02,
        friction: 0.4,
        restitution: 0.5,
        angularVelocity: angularVel,
      });

      this.diceBodies.push({ handle, sides: template.sides, spawnPos, angularVel });
    }
  }

  private removeExcessDice(keepCount: number): void {
    if (!this.physicsWorld) return;

    while (this.diceBodies.length > keepCount) {
      const die = this.diceBodies.pop();
      if (die) {
        this.physicsWorld.removeRigidBody(die.handle);
      }
    }
  }

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

  // Public API for UI controls
  public incrementDiceSets(): void {
    if (this.diceSets < 200) { // Cap at 200 sets (1200 dice)
      this.diceSets++;
      this.updateDiceCountDisplay();
    }
  }

  public decrementDiceSets(): void {
    if (this.diceSets > 1) {
      this.diceSets--;
      this.updateDiceCountDisplay();
    }
  }

  public manualRoll(): void {
    // Set dice to the target count
    const targetDiceCount = this.diceSets * 6;
    const currentDiceCount = this.diceBodies.length;

    if (targetDiceCount > currentDiceCount) {
      this.addMoreDice(targetDiceCount - currentDiceCount);
    } else if (targetDiceCount < currentDiceCount) {
      this.removeExcessDice(targetDiceCount);
    }

    // Respawn all dice
    this.respawnDice();
  }

  public getDiceSets(): number {
    return this.diceSets;
  }

  private updateDiceCountDisplay(): void {
    const diceCountEl = document.getElementById('dice-count');
    if (diceCountEl) {
      const totalDice = this.diceSets * 6;
      diceCountEl.textContent = `${totalDice} dice total`;
    }
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
