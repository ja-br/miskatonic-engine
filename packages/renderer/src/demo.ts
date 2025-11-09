/**
 * 3D Demo Scene initialization
 */

import {
  Renderer,
  RenderBackend,
  Camera as LegacyCamera,
  OrbitControls as LegacyOrbitControls,
  CameraSystem,
  OrbitCameraController,
  RenderQueue,
  RenderCommandType,
  PrimitiveMode,
  BackendFactory,
  createCube,
  createSphere,
  InstanceBufferManager, // Epic 3.13: Instance rendering
  type RendererConfig,
  type DrawCommand,
  type IRendererBackend,
} from '../../rendering/src';
import {
  PhysicsWorld,
  RapierPhysicsEngine,
  RigidBodyType,
  CollisionShapeType,
  type RigidBodyHandle,
} from '../../physics/src';
import { World, TransformSystem, Transform, Camera, type EntityId } from '../../ecs/src';
import { DiceEntity } from './components/DiceEntity';
import './components/registerDemoComponents'; // Register custom components
import { MatrixPool } from './MatrixPool';

export class Demo {
  private canvas: HTMLCanvasElement;
  private renderer: Renderer | null = null;
  private backend: IRendererBackend | null = null;
  private animationId: number | null = null;
  private startTime: number = 0;
  private frameCount: number = 0;
  private lastFpsUpdate: number = 0;
  private lastFrameTime: number = 0;
  private frameTimeHistory: number[] = [];
  private resizeHandler: (() => void) | null = null;

  // ECS World and Systems
  private world: World;
  private transformSystem: TransformSystem;
  private cameraSystem: CameraSystem;

  // ECS Camera
  private cameraEntity: EntityId | null = null;
  private orbitController: OrbitCameraController | null = null;

  // Render queue for organized drawing
  private renderQueue: RenderQueue;
  private instanceManager: InstanceBufferManager | null = null;

  // Rendering resources
  private shaderProgramId: string = 'basic-lighting';
  private cubeVertexBufferId: string = 'cube-vertices'; // Interleaved position+normal
  private cubeIndexBufferId: string = 'cube-indices';
  private cubeIndexCount: number = 0;
  private sphereVertexBufferId: string = 'sphere-vertices'; // Interleaved position+normal
  private sphereIndexBufferId: string = 'sphere-indices';
  private sphereIndexCount: number = 0;

  // Physics
  private physicsWorld: PhysicsWorld | null = null;
  private groundBody: RigidBodyHandle | null = null;
  private lastTime: number = 0;
  private diceSets: number = 10; // Number of dice sets to roll (1 set = 6 dice) - Start with 10 sets (60 dice) to demonstrate instancing

  // Matrix pooling for performance (eliminates GC pressure)
  private matrixPool: MatrixPool;
  private mat3Pool: MatrixPool;
  private vec3Pool: MatrixPool;

  // Debug: Log instancing info only once
  private hasLoggedInstancing = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    // Initialize ECS World
    this.world = new World();

    // Initialize and register ECS Systems
    this.transformSystem = new TransformSystem(this.world);
    this.world.registerSystem(this.transformSystem);

    // CameraSystem is a utility class, not a System
    this.cameraSystem = new CameraSystem(this.world);

    // Initialize render queue
    this.renderQueue = new RenderQueue();

    // Initialize matrix pools (pre-allocate for 1200 dice)
    this.matrixPool = new MatrixPool(16, 4000); // mat4 matrices
    this.mat3Pool = new MatrixPool(9, 1500);     // mat3 normal matrices
    this.vec3Pool = new MatrixPool(3, 5000);     // vec3 uniforms
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

      // Create backend with automatic WebGPU/WebGL2 detection and fallback
      console.log('Creating rendering backend...');

      this.backend = await BackendFactory.create(this.canvas, {
        enableWebGPU: true,  // Enable WebGPU with automatic fallback to WebGL2
        enableWebGL2: true,
        antialias: true,
        alpha: false,
        depth: true,
        powerPreference: 'high-performance',
      });
      console.log(`Using backend: ${this.backend.name}`);

      // Create InstanceBufferManager for Epic 3.13 instanced rendering
      this.instanceManager = new InstanceBufferManager(this.backend);
      console.log('InstanceBufferManager initialized for instanced rendering');

      // Create legacy Renderer ONLY for WebGL2 backend (for BufferManager/ShaderManager)
      // WebGPU backend handles buffers/shaders directly
      if (this.backend.name === 'WebGL2') {
        const config: RendererConfig = {
          backend: RenderBackend.WEBGL2,
          canvas: this.canvas,
          width: this.canvas.width,
          height: this.canvas.height,
          antialias: true,
          alpha: false,
        };
        this.renderer = new Renderer(config);
      }

      // Create ECS camera entity
      this.cameraEntity = this.world.createEntity();

      // Add Transform component - positioned higher and farther to see larger play area
      this.world.addComponent(this.cameraEntity, Transform, new Transform(0, 25, 35));

      // Add Camera component - perspective projection
      this.world.addComponent(this.cameraEntity, Camera, Camera.perspective(
        (45 * Math.PI) / 180, // 45 degrees FOV in radians
        0.1,                   // near
        300                    // far (large viewing distance)
      ));

      // Create orbit camera controller
      this.orbitController = new OrbitCameraController(this.cameraEntity, this.world, 35); // distance = 35
      this.orbitController.setTarget(0, 0, 0);

      // Setup mouse controls for camera
      this.setupCameraControls();

      // Create shader program
      await this.createShaders();

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

  private async createShaders(): Promise<void> {
    if (!this.backend) return;

    // Load appropriate shaders based on backend
    if (this.backend.name === 'WebGPU') {
      console.log('Loading WGSL shaders for WebGPU backend');
      const wgslSource = await import('./shaders/basic-lighting.wgsl?raw').then(m => m.default);

      // Create shader via backend
      await this.backend.createShader(this.shaderProgramId, {
        vertex: wgslSource,  // WGSL uses single-file shaders
        fragment: wgslSource,
      });
      console.log('WGSL shaders compiled successfully');
    } else {
      // WebGL2 backend - requires legacy Renderer
      if (!this.renderer) {
        throw new Error('WebGL2 backend requires Renderer for shader management');
      }

      console.log('Loading GLSL shaders for WebGL2 backend');
      const vertexShaderSource = await import('./shaders/basic-lighting.vert?raw').then(m => m.default);
      const fragmentShaderSource = await import('./shaders/basic-lighting.frag?raw').then(m => m.default);

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

        console.log('GLSL shaders compiled and linked successfully');
      } catch (error) {
        console.error('Shader compilation failed:', error);
        throw new Error(`Failed to create shader program: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  /**
   * Interleave position and normal data for cache-efficient rendering
   */
  private interleavePositionNormal(positions: Float32Array, normals: Float32Array): Float32Array {
    const vertexCount = positions.length / 3;
    const interleaved = new Float32Array(vertexCount * 6); // 3 pos + 3 normal per vertex

    for (let i = 0; i < vertexCount; i++) {
      const posOffset = i * 3;
      const interleavedOffset = i * 6;

      // Position (x, y, z)
      interleaved[interleavedOffset + 0] = positions[posOffset + 0];
      interleaved[interleavedOffset + 1] = positions[posOffset + 1];
      interleaved[interleavedOffset + 2] = positions[posOffset + 2];

      // Normal (nx, ny, nz)
      interleaved[interleavedOffset + 3] = normals[posOffset + 0];
      interleaved[interleavedOffset + 4] = normals[posOffset + 1];
      interleaved[interleavedOffset + 5] = normals[posOffset + 2];
    }

    return interleaved;
  }

  private createGeometry(): void {
    if (!this.backend) return;

    // Create cube geometry with interleaved position+normal data
    const cubeData = createCube(1.0);
    const cubeInterleaved = this.interleavePositionNormal(cubeData.positions, cubeData.normals);

    this.backend.createBuffer(
      this.cubeVertexBufferId,
      'vertex',
      cubeInterleaved,
      'static'
    );
    this.backend.createBuffer(
      this.cubeIndexBufferId,
      'index',
      cubeData.indices,
      'static'
    );
    this.cubeIndexCount = cubeData.indices.length;

    // Create sphere geometry with interleaved position+normal data
    const sphereData = createSphere(0.5, 16, 12);
    const sphereInterleaved = this.interleavePositionNormal(sphereData.positions, sphereData.normals);

    this.backend.createBuffer(
      this.sphereVertexBufferId,
      'vertex',
      sphereInterleaved,
      'static'
    );
    this.backend.createBuffer(
      this.sphereIndexBufferId,
      'index',
      sphereData.indices,
      'static'
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
    const diceTemplate = [
      // D4 (tetrahedron - use small sphere as approximation)
      { sides: 4, shape: CollisionShapeType.SPHERE, radius: 0.4 },
      // D6 (cube)
      { sides: 6, shape: CollisionShapeType.BOX, halfExtents: { x: 0.5, y: 0.5, z: 0.5 } },
      // D8 (octahedron - use sphere)
      { sides: 8, shape: CollisionShapeType.SPHERE, radius: 0.5 },
      // D10 (pentagonal trapezohedron - use cylinder)
      { sides: 10, shape: CollisionShapeType.CYLINDER, radius: 0.45, height: 1.0 },
      // D12 (dodecahedron - use sphere)
      { sides: 12, shape: CollisionShapeType.SPHERE, radius: 0.55 },
      // D20 (icosahedron - use sphere)
      { sides: 20, shape: CollisionShapeType.SPHERE, radius: 0.6 },
    ];

    // Spawn initial dice (based on diceSets value)
    const setsToSpawn = this.diceSets; // Use the diceSets value (now 10)
    console.log(`Spawning ${setsToSpawn} sets of dice (${setsToSpawn * 6} total dice)...`);

    for (let set = 0; set < setsToSpawn; set++) {
      for (let i = 0; i < diceTemplate.length; i++) {
        const die = diceTemplate[i];

        // Spread dice across a grid pattern
        const gridX = (set % 6) * 3 - 7.5; // 6 columns
        const gridZ = Math.floor(set / 6) * 3 - 5; // Multiple rows
        const randomOffset = { x: (Math.random() - 0.5) * 1.5, z: (Math.random() - 0.5) * 1.5 };

        const position = {
          x: gridX + i * 0.5 + randomOffset.x,
          y: 15 + set * 2 + i * 0.5, // Stack sets vertically
          z: gridZ + randomOffset.z,
        };

        const angularVel = {
          x: (Math.random() - 0.5) * 6,
          y: (Math.random() - 0.5) * 6,
          z: (Math.random() - 0.5) * 6,
        };

        const dieInstance = { ...die, position, angularVel };

    for (const die of [dieInstance]) {
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

      // Create ECS entity for this dice
      const entity = this.world.createEntity();

      // Add Transform component (will be synced from physics)
      this.world.addComponent(entity, Transform, new Transform(
        die.position.x,
        die.position.y,
        die.position.z
      ));

      // Add DiceEntity component (links to physics body)
      this.world.addComponent(entity, DiceEntity, new DiceEntity(
        handle,
        die.sides,
        die.position,
        die.angularVel
      ));
    }
      } // end diceTemplate loop
    } // end sets loop

    console.log(`Spawned ${setsToSpawn * 6} dice across ${setsToSpawn} sets`);

    // Add collision callback to log collisions
    this.physicsWorld.onCollision((event) => {
      console.log('Collision detected:', event);
    });

    console.log('Physics initialized successfully');
  }

  start(): void {
    if (!this.backend) {
      console.error('Backend not initialized');
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
        // Re-initialize the backend (this is what actually renders)
        this.backend = await BackendFactory.create(this.canvas, {
          antialias: true,
          alpha: false,
          preferredBackend: 'webgl2'
        });

        // Recreate shaders and geometry
        await this.createShaders();
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

  /**
   * Setup mouse controls for ECS orbit camera
   */
  private setupCameraControls(): void {
    if (!this.orbitController) return;

    let isDragging = false;
    let lastX = 0;
    let lastY = 0;

    // Mouse down - start dragging
    this.canvas.addEventListener('mousedown', (e: MouseEvent) => {
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    });

    // Mouse up - stop dragging
    window.addEventListener('mouseup', () => {
      isDragging = false;
    });

    // Mouse move - rotate camera
    this.canvas.addEventListener('mousemove', (e: MouseEvent) => {
      if (!isDragging || !this.orbitController) return;

      const deltaX = e.clientX - lastX;
      const deltaY = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;

      // Convert pixel movement to radians
      const rotationSpeed = 0.005;
      this.orbitController.rotate(
        -deltaX * rotationSpeed,  // azimuth (horizontal)
        deltaY * rotationSpeed    // elevation (vertical)
      );
    });

    // Mouse wheel - zoom
    this.canvas.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
      if (!this.orbitController) return;

      // Zoom in/out based on wheel delta
      const zoomSpeed = 0.1;
      this.orbitController.zoom(e.deltaY * zoomSpeed);
    });
  }

  private renderLoop = (): void => {
    if (!this.backend || !this.cameraEntity) return;

    const now = performance.now();
    const deltaTime = this.lastTime ? (now - this.lastTime) / 1000 : 0;
    this.lastTime = now;

    // Step physics simulation
    let alpha = 0; // Interpolation factor
    if (this.physicsWorld && deltaTime > 0) {
      alpha = this.physicsWorld.step(deltaTime);
    }

    // Sync physics transforms to ECS entities
    if (this.physicsWorld) {
      const query = this.world.query().with(Transform).with(DiceEntity).build();
      for (const { components } of this.world.executeQuery(query)) {
        const transform = components.get(Transform);
        const diceEntity = components.get(DiceEntity);

        if (transform && diceEntity) {
          try {
            const physicsPos = this.physicsWorld.getPosition(diceEntity.bodyHandle);
            const physicsRot = this.physicsWorld.getRotation(diceEntity.bodyHandle);

            if (physicsPos && physicsRot) {
              // Update transform position
              transform.x = physicsPos.x;
              transform.y = physicsPos.y;
              transform.z = physicsPos.z;

              // Update transform rotation (quaternion to euler angles)
              // For now, we'll store the quaternion in the rotation fields
              // TODO: Convert quaternion to euler angles properly
              transform.rotationX = physicsRot.x;
              transform.rotationY = physicsRot.y;
              transform.rotationZ = physicsRot.z;
            }
          } catch (e) {
            // Body might have been removed, skip this entity
            continue;
          }
        }
      }
    }

    // Update ECS systems (includes TransformSystem)
    this.world.update(deltaTime);

    // Get view-projection matrix from ECS camera
    const aspectRatio = this.canvas.width / this.canvas.height;
    const viewProjMatrix = this.cameraSystem.getViewProjectionMatrix(this.cameraEntity, aspectRatio);

    // Get camera position from Transform component
    const cameraTransform = this.world.getComponent(this.cameraEntity, Transform);
    if (!cameraTransform) return;

    // Set up camera info for render queue
    const viewMatrix = this.cameraSystem.getViewMatrix(this.cameraEntity);
    const projMatrix = this.cameraSystem.getProjectionMatrix(this.cameraEntity, aspectRatio);
    if (viewMatrix && projMatrix) {
      this.renderQueue.setCamera({
        position: new Float32Array([cameraTransform.x, cameraTransform.y, cameraTransform.z]),
        viewMatrix,
        projectionMatrix: projMatrix,
      });
    }

    // Clear render queue for this frame
    this.renderQueue.clear();

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

    let drawCalls = 0;

    // Submit draw commands for all dice using ECS query
    const diceQuery = this.world.query().with(Transform).with(DiceEntity).build();
    const diceEntities = this.world.executeQuery(diceQuery);

    if (this.physicsWorld && diceEntities.length > 0) {
      for (const { components } of diceEntities) {
        const transform = components.get(Transform);
        const diceEntity = components.get(DiceEntity);

        if (!transform || !diceEntity) continue;

        let position, rotation;
        try {
          position = this.physicsWorld.getPosition(diceEntity.bodyHandle);
          rotation = this.physicsWorld.getRotation(diceEntity.bodyHandle);

          // Skip if body no longer exists
          if (!position || !rotation) continue;
        } catch (e) {
          // Body might have been removed, skip this entity
          continue;
        }

        // Acquire matrices from pool (eliminates GC pressure)
        const modelMatrix = this.matrixPool.acquire();
        const mvpMatrix = this.matrixPool.acquire();

        this.createModelMatrix(modelMatrix, position, rotation);
        this.multiplyMatrices(mvpMatrix, viewProjMatrix, modelMatrix);

        // Use cube mesh for D6, sphere for everything else
        const useCube = diceEntity.sides === 6;
        const vertexBufferId = useCube ? this.cubeVertexBufferId : this.sphereVertexBufferId;
        const indexBufferId = useCube ? this.cubeIndexBufferId : this.sphereIndexBufferId;
        const indexCount = useCube ? this.cubeIndexCount : this.sphereIndexCount;

        // Add depth-based darkening
        const depth = Math.max(0, Math.min(1, (position.y + 1) / 10));
        const [r, g, b] = getDieColor(diceEntity.sides);
        const brightness = 0.7 + depth * 0.3; // Brighter when higher up

        // Create draw command with interleaved vertex layout
        // Interleaved format: [px, py, pz, nx, ny, nz, px, py, pz, nx, ny, nz, ...]
        // Total stride: 24 bytes (6 floats * 4 bytes)
        const drawCmd: DrawCommand = {
          type: RenderCommandType.DRAW,
          shader: this.shaderProgramId,
          mode: PrimitiveMode.TRIANGLES,
          vertexBufferId,
          indexBufferId,
          indexType: 'uint16',
          vertexCount: indexCount,
          vertexLayout: {
            attributes: [
              {
                name: 'aPosition',
                type: 'float',
                size: 3,
                location: 0,
                offset: 0,      // Start of vertex data
                stride: 24,     // 6 floats (pos + normal)
              },
              {
                name: 'aNormal',
                type: 'float',
                size: 3,
                location: 1,
                offset: 12,     // After position (3 floats * 4 bytes)
                stride: 24,     // Same stride as position
              },
            ],
          },
          uniforms: (() => {
            // Acquire uniform arrays from pool
            const normalMatrix = this.mat3Pool.acquire();
            normalMatrix[0] = 1; normalMatrix[1] = 0; normalMatrix[2] = 0;
            normalMatrix[3] = 0; normalMatrix[4] = 1; normalMatrix[5] = 0;
            normalMatrix[6] = 0; normalMatrix[7] = 0; normalMatrix[8] = 1;

            const lightDir = this.vec3Pool.acquire();
            lightDir[0] = 0.5; lightDir[1] = 1.0; lightDir[2] = 0.5;

            const cameraPos = this.vec3Pool.acquire();
            cameraPos[0] = cameraTransform.x;
            cameraPos[1] = cameraTransform.y;
            cameraPos[2] = cameraTransform.z;

            const baseColor = this.vec3Pool.acquire();
            baseColor[0] = r * brightness;
            baseColor[1] = g * brightness;
            baseColor[2] = b * brightness;

            return new Map([
              ['uModelViewProjection', { name: 'uModelViewProjection', type: 'mat4', value: mvpMatrix }],
              ['uModel', { name: 'uModel', type: 'mat4', value: modelMatrix }],
              ['uNormalMatrix', { name: 'uNormalMatrix', type: 'mat3', value: normalMatrix }],
              ['uLightDir', { name: 'uLightDir', type: 'vec3', value: lightDir }],
              ['uCameraPos', { name: 'uCameraPos', type: 'vec3', value: cameraPos }],
              ['uBaseColor', { name: 'uBaseColor', type: 'vec3', value: baseColor }],
            ]);
          })(),
          state: {
            blendMode: 'none',
            depthTest: 'less',
            depthWrite: true,
            cullMode: 'back',
          },
        };

        // Submit to render queue
        // Epic 3.13 FIX: Use render type (cube/sphere) for materialId, NOT dice type
        // This allows all spheres (D4, D8, D10, D12, D20) to instance together
        this.renderQueue.submit({
          drawCommand: drawCmd,
          materialId: useCube ? 'dice-cube' : 'dice-sphere',
          worldMatrix: modelMatrix,
          depth: 0,
          sortKey: 0,
        });

        drawCalls++;
      }
    }

    // Epic 3.13: Sort and detect instances
    this.renderQueue.sort();

    // Epic 3.13: Upload instance buffers to GPU if instancing is enabled
    if (this.instanceManager) {
      const opaqueGroups = this.renderQueue.getInstanceGroups('opaque');

      // Log only once for debugging
      if (!this.hasLoggedInstancing && opaqueGroups.length > 0) {
        console.log(`\n=== Epic 3.13: Instanced Rendering Debug ===`);
        console.log(`Found ${opaqueGroups.length} opaque groups`);
      }

      for (const group of opaqueGroups) {
        if (!this.hasLoggedInstancing) {
          console.log(`\nGroup "${group.key}":`);
          console.log(`  - Objects: ${group.commands.length}`);
          console.log(`  - Instance buffer created: ${!!group.instanceBuffer}`);
        }

        if (group.instanceBuffer) {
          const gpuBuffer = this.instanceManager.upload(group.instanceBuffer);

          if (!this.hasLoggedInstancing) {
            console.log(`  - GPU buffer: ${gpuBuffer.id} (${gpuBuffer.count} instances)`);
          }

          // Set instanceBufferId on all commands in this group
          for (const cmd of group.commands) {
            cmd.drawCommand.instanceBufferId = gpuBuffer.id;
            cmd.drawCommand.instanceCount = gpuBuffer.count;
          }
        }
      }

      if (!this.hasLoggedInstancing && opaqueGroups.length > 0) {
        this.hasLoggedInstancing = true;
      }
    }

    // Get render commands (now with instance buffer IDs set)
    const queuedCommands = this.renderQueue.getCommands();
    const renderCommands = queuedCommands.map(qc => qc.drawCommand);

    // Log render command count only once
    if (!this.hasLoggedInstancing && drawCalls > 0) {
      console.log(`\nResult: ${drawCalls} objects → ${renderCommands.length} render commands`);
      console.log(`Draw call reduction: ${((1 - renderCommands.length / drawCalls) * 100).toFixed(1)}%\n`);
      this.hasLoggedInstancing = true;
    }

    // Begin frame
    this.backend.beginFrame();

    // Always execute commands (even if empty) to ensure render pass is created and screen is cleared
    this.backend.executeCommands(renderCommands);

    // End frame
    this.backend.endFrame();

    // Release all pooled matrices back to pool (eliminates per-frame allocations)
    this.matrixPool.releaseAll();
    this.mat3Pool.releaseAll();
    this.vec3Pool.releaseAll();

    // Track frame time
    const frameTime = now - this.lastFrameTime;
    this.lastFrameTime = now;
    this.frameTimeHistory.push(frameTime);
    if (this.frameTimeHistory.length > 60) this.frameTimeHistory.shift(); // Keep last 60 frames

    // Update FPS counter
    this.frameCount++;
    if (now - this.lastFpsUpdate >= 1000) {
      const fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsUpdate));

      // Calculate average frame time from last 60 frames
      const avgFrameTime = this.frameTimeHistory.reduce((a, b) => a + b, 0) / this.frameTimeHistory.length;

      // Epic 3.13 FIX: Get ACTUAL draw call count from RenderQueue after batching/instancing
      const queueStats = this.renderQueue.getStats();
      const actualDrawCalls = queueStats.opaqueCount + queueStats.alphaTestCount + queueStats.transparentCount
        - queueStats.totalInstances // Remove instanced objects
        + queueStats.instancedDrawCalls; // Add instanced draw calls (one per group)

      // Calculate total triangles (approximate average between cube and sphere)
      const avgTrianglesPerDie = ((this.cubeIndexCount / 3) + (this.sphereIndexCount / 3)) / 2;
      const triangles = Math.round(avgTrianglesPerDie * drawCalls);

      // Count total dice using ECS query
      const diceQuery = this.world.query().with(DiceEntity).build();
      const diceCount = Array.from(this.world.executeQuery(diceQuery)).length;

      // Estimate VRAM usage based on buffer sizes
      // Cube: 8 vertices * 6 floats (pos + normal) * 4 bytes = 192 bytes
      // Cube indices: 36 indices * 2 bytes (uint16) = 72 bytes
      // Sphere: ~408 vertices (16 segments * 12 rings) * 6 floats * 4 bytes = ~9792 bytes
      // Sphere indices: ~1152 indices * 2 bytes = ~2304 bytes
      const cubeVertexBytes = 8 * 6 * 4; // 8 vertices, 6 floats each (pos+normal), 4 bytes per float
      const cubeIndexBytes = this.cubeIndexCount * 2; // uint16
      const sphereVertexBytes = ((16 + 1) * (12 + 1)) * 6 * 4; // (segments+1) * (rings+1) vertices
      const sphereIndexBytes = this.sphereIndexCount * 2; // uint16
      const vramBytes = cubeVertexBytes + cubeIndexBytes + sphereVertexBytes + sphereIndexBytes;
      const vramMB = vramBytes / (1024 * 1024);

      // Calculate % of enforced VRAM budget (VRAMProfiler default: 256MB)
      const vramBudgetMB = 256;
      const vramUsagePercent = (vramMB / vramBudgetMB) * 100;

      // Count buffers (vertex + index for cube and sphere)
      const bufferCount = 4;
      const textureCount = 0; // No textures in this demo

      this.updateStats(
        fps,
        avgFrameTime,
        actualDrawCalls,
        triangles,
        queueStats.instanceGroups,
        queueStats.totalInstances,
        queueStats.drawCallReduction,
        diceCount,
        vramMB,
        vramUsagePercent,
        bufferCount,
        textureCount
      );
      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }

    this.animationId = requestAnimationFrame(this.renderLoop);
  };

  private respawnDice(): void {
    if (!this.physicsWorld) return;

    // Reset instancing log so it prints again after respawn
    this.hasLoggedInstancing = false;

    // Respawn all current dice using ECS query
    const query = this.world.query().with(DiceEntity).build();
    for (const { components } of this.world.executeQuery(query)) {
      const diceEntity = components.get(DiceEntity);
      if (!diceEntity) continue;

      // Reset position to spawn point with random offset (spread across larger area)
      const randomOffset = {
        x: (Math.random() - 0.5) * 20.0,
        y: Math.random() * 5.0,
        z: (Math.random() - 0.5) * 20.0,
      };

      this.physicsWorld.setPosition(diceEntity.bodyHandle, {
        x: diceEntity.spawnX + randomOffset.x,
        y: diceEntity.spawnY + randomOffset.y,
        z: diceEntity.spawnZ + randomOffset.z,
      });

      // Random rotation
      const randomRot = Math.random() * Math.PI * 2;
      const axis = Math.random() < 0.33 ? { x: 1, y: 0, z: 0 } : Math.random() < 0.5 ? { x: 0, y: 1, z: 0 } : { x: 0, y: 0, z: 1 };
      const halfAngle = randomRot / 2;
      const s = Math.sin(halfAngle);
      this.physicsWorld.setRotation(diceEntity.bodyHandle, {
        x: axis.x * s,
        y: axis.y * s,
        z: axis.z * s,
        w: Math.cos(halfAngle),
      });

      // Set linear velocity to zero
      this.physicsWorld.setLinearVelocity(diceEntity.bodyHandle, { x: 0, y: 0, z: 0 });

      // Set new random angular velocity
      const newAngularVel = {
        x: diceEntity.angularVelX * (0.5 + Math.random()),
        y: diceEntity.angularVelY * (0.5 + Math.random()),
        z: diceEntity.angularVelZ * (0.5 + Math.random()),
      };
      this.physicsWorld.setAngularVelocity(diceEntity.bodyHandle, newAngularVel);

      // Wake up the body
      this.physicsWorld.wakeUp(diceEntity.bodyHandle);
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

      // Create ECS entity for this dice
      const entity = this.world.createEntity();

      // Add Transform component (will be synced from physics)
      this.world.addComponent(entity, Transform, new Transform(
        spawnPos.x,
        spawnPos.y,
        spawnPos.z
      ));

      // Add DiceEntity component (links to physics body)
      this.world.addComponent(entity, DiceEntity, new DiceEntity(
        handle,
        template.sides,
        spawnPos,
        angularVel
      ));
    }

    // Update the dice count display
    this.updateDiceCountDisplay();
  }

  private removeExcessDice(keepCount: number): void {
    if (!this.physicsWorld) return;

    // Get all dice entities
    const query = this.world.query().with(DiceEntity).build();
    const diceEntities = Array.from(this.world.executeQuery(query));

    // Remove excess dice
    while (diceEntities.length > keepCount) {
      const { entity, components } = diceEntities.pop()!;
      const diceEntity = components.get(DiceEntity);

      if (diceEntity) {
        // IMPORTANT: Remove ECS entity FIRST, then physics body
        // This prevents race conditions where physics sync tries to access removed bodies
        this.world.destroyEntity(entity);
        this.physicsWorld.removeRigidBody(diceEntity.bodyHandle);
      }
    }
  }

  private createModelMatrix(
    out: Float32Array,
    position: { x: number; y: number; z: number },
    rotation: { x: number; y: number; z: number; w: number }
  ): void {
    // Convert quaternion to rotation matrix
    const x = rotation.x, y = rotation.y, z = rotation.z, w = rotation.w;
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2;
    const yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;

    out[0] = 1 - (yy + zz); out[1] = xy + wz;       out[2] = xz - wy;       out[3] = 0;
    out[4] = xy - wz;       out[5] = 1 - (xx + zz); out[6] = yz + wx;       out[7] = 0;
    out[8] = xz + wy;       out[9] = yz - wx;       out[10] = 1 - (xx + yy); out[11] = 0;
    out[12] = position.x;   out[13] = position.y;   out[14] = position.z;    out[15] = 1;
  }

  private multiplyMatrices(out: Float32Array, a: Float32Array, b: Float32Array): void {
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
  }

  private updateStats(
    fps: number,
    frameTime: number,
    drawCalls: number,
    triangles: number,
    instanceGroups: number,
    instancedObjects: number,
    drawCallReduction: number,
    objectCount: number,
    vramUsage: number,
    vramUsagePercent: number,
    bufferCount: number,
    textureCount: number
  ): void {
    const fpsEl = document.getElementById('fps');
    const frameTimeEl = document.getElementById('frame-time');
    const drawCallsEl = document.getElementById('draw-calls');
    const trianglesEl = document.getElementById('triangles');
    const instanceGroupsEl = document.getElementById('instance-groups');
    const instancedObjectsEl = document.getElementById('instanced-objects');
    const reductionEl = document.getElementById('draw-call-reduction');
    const objectCountEl = document.getElementById('object-count');
    const vramEl = document.getElementById('vram-usage');
    const bufferCountEl = document.getElementById('buffer-count');
    const textureCountEl = document.getElementById('texture-count');

    if (fpsEl) fpsEl.textContent = fps.toString();
    if (frameTimeEl) frameTimeEl.textContent = frameTime.toFixed(2);
    if (drawCallsEl) drawCallsEl.textContent = drawCalls.toString();
    if (trianglesEl) trianglesEl.textContent = triangles.toString();
    if (instanceGroupsEl) instanceGroupsEl.textContent = instanceGroups.toString();
    if (instancedObjectsEl) instancedObjectsEl.textContent = instancedObjects.toString();
    if (reductionEl) reductionEl.textContent = drawCallReduction.toFixed(1);
    if (objectCountEl) objectCountEl.textContent = objectCount.toString();
    if (vramEl) vramEl.textContent = `${vramUsage.toFixed(2)} (${vramUsagePercent.toFixed(3)}%)`;
    if (bufferCountEl) bufferCountEl.textContent = bufferCount.toString();
    if (textureCountEl) textureCountEl.textContent = textureCount.toString();
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
    // Add more dice (based on slider value) and make them fall from above
    const diceToAdd = this.diceSets * 6;
    this.addMoreDice(diceToAdd);
  }

  public getDiceSets(): number {
    return this.diceSets;
  }

  public setDiceSets(value: number): void {
    const clampedValue = Math.max(1, Math.min(200, Math.floor(value)));
    if (this.diceSets !== clampedValue) {
      this.diceSets = clampedValue;
      this.updateDiceCountDisplay();
    }
  }

  public reset(): void {
    if (!this.physicsWorld) return;

    // Get all dice entities
    const query = this.world.query().with(DiceEntity).build();
    const diceEntities = Array.from(this.world.executeQuery(query));

    console.log(`[RESET] Found ${diceEntities.length} dice entities to remove`);

    // Remove all dice
    for (const { entity, components } of diceEntities) {
      const diceEntity = components.get(DiceEntity);
      if (diceEntity) {
        // Remove physics body
        try {
          this.physicsWorld.removeRigidBody(diceEntity.bodyHandle);
        } catch (e) {
          // Body already removed
        }
        // Remove ECS entity
        this.world.destroyEntity(entity);
      }
    }

    // Verify entities are gone
    const verifyQuery = this.world.query().with(DiceEntity).build();
    const remainingEntities = Array.from(this.world.executeQuery(verifyQuery));
    console.log(`[RESET] After removal, ${remainingEntities.length} dice entities remain`);

    // The entities are now removed. The next render loop will show an empty scene.
    // No need to force a render - the animation loop will handle it.

    // Update display
    this.updateDiceCountDisplay();
  }

  private updateDiceCountDisplay(): void {
    const diceCountEl = document.getElementById('dice-count');
    if (diceCountEl) {
      // Count actual dice in scene
      const query = this.world.query().with(DiceEntity).build();
      const actualDiceCount = Array.from(this.world.executeQuery(query)).length;
      diceCountEl.textContent = `${actualDiceCount} dice total`;
    }
  }

  dispose(): void {
    this.stop();

    // Remove resize event listener to prevent memory leak
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }

    // ECS camera cleanup (entities managed by World)
    this.cameraEntity = null;
    this.orbitController = null;

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

    // Note: Dice entities are managed by World and will be cleaned up automatically
    this.groundBody = null;
  }
}
