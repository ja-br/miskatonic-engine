/**
 * 3D Demo Scene initialization
 */

import {
  RenderBackend,
  CameraSystem,
  OrbitCameraController,
  BackendFactory,
  createCube,
  createSphere,
  OPAQUE_PIPELINE_STATE,
  InstanceBuffer,
  InstanceBufferManager,
  globalInstanceBufferPool,
  RetroLightingSystem,
  RetroPostProcessor,
  type RetroLight,
  type DrawCommand,
  type IRendererBackend,
  type BackendShaderHandle,
  type BackendBufferHandle,
  type BackendBindGroupHandle,
  type BackendBindGroupLayoutHandle,
  type BackendPipelineHandle,
  // Epic 3.5: Object Culling
  ObjectCuller,
  BoundingSphere,
  BoundingBox,
  type SpatialObject,
  type CullResult,
  SortOrder,
} from '../../rendering/src';
import {
  PhysicsWorld,
  RapierPhysicsEngine,
  RigidBodyType,
  CollisionShapeType,
  type RigidBodyHandle,
} from '../../physics/src';
import { World, TransformSystem, Transform, Camera, Query, type EntityId } from '../../ecs/src';
import * as Mat4 from '../../ecs/src/math/Mat4';
import { DiceEntity } from './components/DiceEntity';
import './components/registerDemoComponents'; // Register custom components
import { MatrixPool } from './MatrixPool';

export class Demo {
  // Constants
  private static readonly MAX_DICE_LIMIT = 5000; // Hard cap for GPU memory safety (conservative for integrated GPUs)
  private static readonly WEBGPU_UNIFORM_ALIGNMENT = 256; // WebGPU requires 256-byte uniform buffer alignment
  private static readonly UNIFORM_FLOATS = 64; // 256 bytes / 4 bytes per float
  private static readonly INSTANCE_FLOATS_PER_DIE = 20; // mat4 (16 floats) + vec4 color (4 floats) = 80 bytes
  private static readonly MIN_INSTANCE_BUFFER_CAPACITY = 64; // Matches pool bucket size (power of 2)
  private static readonly INSTANCE_BUFFER_COUNT = 2; // Double-buffering (WebGPU copies command buffers on submit)

  // Epic 3.4: Retro rendering shader constants
  private static readonly VERTEX_STRIDE = 32; // 8 floats: position (3) + normal (3) + uv (2) = 32 bytes
  private static readonly INSTANCE_STRIDE = 80; // 20 floats: mat4 transform (16) + vec4 color (4) = 80 bytes
  private static readonly CAMERA_UNIFORM_FLOATS = 20; // mat4 viewProj (16) + vec3 position (3) + padding (1) = 80 bytes

  private canvas: HTMLCanvasElement;
  private backend: IRendererBackend | null = null;
  private animationId: number | null = null;
  private startTime: number = 0;
  private frameCount: number = 0;
  private lastFpsUpdate: number = 0;
  private lastFrameTime: number = 0;
  private frameTimeHistory: number[] = [];
  private resizeHandler: (() => void) | null = null;
  private lastDiceCount: number = 0;
  private vramDebugLogged: boolean = false;

  // ECS World and Systems
  private world: World;
  private transformSystem: TransformSystem;
  private cameraSystem: CameraSystem;

  // ECS Camera
  private cameraEntity: EntityId | null = null;
  private orbitController: OrbitCameraController | null = null;

  // Epic 3.14: Resource handles (no RenderQueue)
  private cubeShaderInstanced!: BackendShaderHandle;
  private sphereShaderInstanced!: BackendShaderHandle;
  private bindGroupLayout!: BackendBindGroupLayoutHandle;
  private sharedUniformBuffer!: BackendBufferHandle; // Shared uniform buffer for camera (viewProj + position)
  private sharedBindGroup!: BackendBindGroupHandle; // Camera bind group (@group(0))
  private cubePipelineInstanced!: BackendPipelineHandle;
  private spherePipelineInstanced!: BackendPipelineHandle;

  // Epic 3.4: Retro Rendering System
  private retroLighting!: RetroLightingSystem;
  public retroPostProcessor!: RetroPostProcessor;
  private lightBindGroupLayout!: BackendBindGroupLayoutHandle;
  private lightBindGroup!: BackendBindGroupHandle;

  // Epic 3.5: Object Culling System
  private objectCuller!: ObjectCuller;
  private spatialObjectMap: Map<EntityId, { spatial: SpatialObject; boundingSphere: BoundingSphere }> = new Map();

  // GPU instancing infrastructure (double-buffered)
  private instanceBufferManager!: InstanceBufferManager;
  // Pre-allocated persistent buffers (never deleted, only resized when needed)
  // Start with 64 capacity to minimize initial VRAM usage, will auto-resize as needed
  private cubeInstanceBuffers: InstanceBuffer[] = [
    new InstanceBuffer(64),
    new InstanceBuffer(64),
  ];
  private sphereInstanceBuffers: InstanceBuffer[] = [
    new InstanceBuffer(64),
    new InstanceBuffer(64),
  ];
  private instanceBufferFrameIndex: number = 0;

  // Rendering resources
  private cubeVertexBuffer!: BackendBufferHandle;
  private cubeIndexBuffer!: BackendBufferHandle;
  private cubeIndexCount: number = 0;
  private sphereVertexBuffer!: BackendBufferHandle;
  private sphereIndexBuffer!: BackendBufferHandle;
  private sphereIndexCount: number = 0;

  // Stats tracking
  private lastDrawCallCount: number = 0;
  private lastInstanceGroupCount: number = 0;
  private lastInstancedObjectCount: number = 0;

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

  // P1.1: Cached query for dice entities (eliminates rebuilding + Map allocations)
  private diceQuery: Query | null = null;

  // P1.2: Cache physics rotations to avoid fetching twice per frame
  private rotationCache: Map<EntityId, { x: number; y: number; z: number; w: number }> = new Map();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    // Initialize ECS World
    this.world = new World();

    // Initialize and register ECS Systems
    this.transformSystem = new TransformSystem(this.world);
    this.world.registerSystem(this.transformSystem);

    // CameraSystem is a utility class, not a System
    this.cameraSystem = new CameraSystem(this.world);

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

      // Create WebGPU backend
      console.log('Creating rendering backend...');

      this.backend = await BackendFactory.create(this.canvas, {
        antialias: true,
        alpha: false,
        depth: true,
        depthFormat: 'depth16unorm', // VRAM optimization: 2 bytes/pixel vs depth24plus (4 bytes/pixel) = 50% savings
        powerPreference: 'high-performance',
      });
      console.log(`Using backend: ${this.backend.name}`);

      // VRAM optimization: Log canvas resolution and expected depth buffer size
      const depthBytesPerPixel = this.backend.getDepthFormat() === 'depth16unorm' ? 2 : 4;
      const expectedDepthMB = (this.canvas.width * this.canvas.height * depthBytesPerPixel / 1024 / 1024).toFixed(2);
      console.log(`Canvas resolution: ${this.canvas.width}x${this.canvas.height} (DPR: ${window.devicePixelRatio})`);
      console.log(`Depth format: ${this.backend.getDepthFormat()}`);
      console.log(`Expected depth buffer: ${expectedDepthMB} MB`);

      // Initialize instance buffer manager for GPU instancing
      this.instanceBufferManager = new InstanceBufferManager(this.backend);

      // Epic 3.4: Initialize retro rendering systems
      this.retroLighting = new RetroLightingSystem(this.backend, {
        maxLights: 4,
        enableVertexColors: true,
        enableLightmaps: false,
        enableFog: false,
      });

      // Setup simple directional light for retro vertex lighting
      const retroLights: RetroLight[] = [
        {
          type: 'directional',
          position: [0, 10, 0],
          color: [1.0, 0.95, 0.9], // Warm white
          intensity: 1.2,
          direction: [0.5, -1.0, -0.5], // Diagonal from top (flipped Z to align with camera view)
        },
        {
          type: 'point',
          position: [-10, 5, -10],
          color: [0.8, 0.9, 1.0], // Cool fill light
          intensity: 1.2,
          range: 50.0,
        },
      ];
      this.retroLighting.setLights(retroLights);

      // CRITICAL: Sync backend depth buffer with current canvas size
      this.backend.resize(this.canvas.width, this.canvas.height);

      // Create ECS camera entity
      this.cameraEntity = this.world.createEntity();

      // Add Transform component - positioned higher and farther to see larger play area
      this.world.addComponent(this.cameraEntity, Transform, new Transform(0, 25, 35));

      // Add Camera component - perspective projection
      this.world.addComponent(this.cameraEntity, Camera, Camera.perspective(
        (45 * Math.PI) / 180, // 45 degrees FOV in radians
        1.0,                   // near (moved from 0.1 to 1.0 for better depth precision)
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

      // Epic 3.5: Initialize object culler
      this.objectCuller = new ObjectCuller({
        spatialGrid: {
          bounds: new BoundingBox(-100, -10, -100, 100, 100, 100),
          cellsPerAxis: 16, // 16x16x16 = 4096 cells
        },
        enableStats: true,
        sortOrder: SortOrder.NEAR_TO_FAR,
      });
      console.log('Object culler initialized (16x16x16 grid, bounds: [-100,-10,-100] to [100,100,100])');

      console.log('Renderer initialized successfully');
      console.log('Backend:', this.backend.name);
      console.log('Canvas size:', this.canvas.width, 'x', this.canvas.height);

      return true;
    } catch (error) {
      console.error('Failed to initialize renderer:', error);
      return false;
    }
  }

  private async createShaders(): Promise<void> {
    if (!this.backend) return;

    // Epic 3.4: Load retro rendering WGSL shader (simple-lambert-instanced)
    console.log('Loading Miskatonic WGSL shader for WebGPU backend');
    const wgslSourceInstanced = await import('../../rendering/src/retro/shaders/simple-lambert-instanced.wgsl?raw').then(m => m.default);

    // Create shader handles (instanced only - retro rendering uses instanced rendering exclusively)
    this.cubeShaderInstanced = this.backend.createShader('cube-shader-instanced', {
      vertex: wgslSourceInstanced,
      fragment: wgslSourceInstanced,
    });
    this.sphereShaderInstanced = this.backend.createShader('sphere-shader-instanced', {
      vertex: wgslSourceInstanced,
      fragment: wgslSourceInstanced,
    });

    console.log('Miskatonic WGSL shader compiled successfully (vertex lighting)');

    // Epic 3.4: Create bind group layouts for retro rendering
    // @group(0) - Camera uniforms: mat4 viewProj (64 bytes) + vec3 position (12 bytes) + padding (4 bytes) = 80 bytes
    this.bindGroupLayout = this.backend.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: ['vertex', 'fragment'],
          type: 'uniform',
          minBindingSize: 256, // WebGPU requires 256-byte alignment (actual data is 80 bytes)
        },
      ],
    });

    // @group(1) - Light storage buffer (read-only in vertex shader for retro vertex lighting)
    this.lightBindGroupLayout = this.backend.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: ['vertex'],
          type: 'read-only-storage',
          minBindingSize: 96, // CORRECTED: 48 bytes per light * 2 lights = 96 bytes (storage buffer uses 4-byte vec3 alignment, NOT 16-byte)
        },
      ],
    });

    // Create camera uniform buffer for retro rendering
    // Actual data: 20 floats (80 bytes) - mat4 viewProj (16) + vec3 position (3) + padding (1)
    // Allocated: 64 floats (256 bytes) for WebGPU alignment requirement
    this.sharedUniformBuffer = this.backend.createBuffer(
      'camera-uniforms',
      'uniform',
      new Float32Array(Demo.UNIFORM_FLOATS), // 64 floats = 256 bytes (aligned)
      'dynamic_draw'
    );

    // Create camera bind group (@group(0))
    this.sharedBindGroup = this.backend.createBindGroup(this.bindGroupLayout, {
      bindings: [{ binding: 0, resource: this.sharedUniformBuffer }],
    });

    // Create light bind group (@group(1)) from RetroLightingSystem
    this.lightBindGroup = this.backend.createBindGroup(this.lightBindGroupLayout, {
      bindings: [{ binding: 0, resource: this.retroLighting.getLightBuffer() }],
    });

    // Epic 3.4: Create retro rendering instanced pipelines
    // Vertex layout 0: per-vertex data (position + normal)
    // Vertex layout 1: per-instance data (mat4 transform + vec4 color)
    this.cubePipelineInstanced = this.backend.createRenderPipeline({
      label: 'cube-pipeline-instanced',
      shader: this.cubeShaderInstanced,
      vertexLayouts: [
        // Layout 0: per-vertex (position + normal)
        {
          arrayStride: 24, // 6 floats (position + normal)
          stepMode: 'vertex',
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x3' },  // position
            { shaderLocation: 1, offset: 12, format: 'float32x3' }, // normal
          ],
        },
        // Layout 1: per-instance (mat4 transform + vec4 color)
        {
          arrayStride: 80, // 20 floats (16 for mat4 + 4 for vec4 color)
          stepMode: 'instance',
          attributes: [
            { shaderLocation: 2, offset: 0, format: 'float32x4' },  // transform row 0
            { shaderLocation: 3, offset: 16, format: 'float32x4' }, // transform row 1
            { shaderLocation: 4, offset: 32, format: 'float32x4' }, // transform row 2
            { shaderLocation: 5, offset: 48, format: 'float32x4' }, // transform row 3
            { shaderLocation: 6, offset: 64, format: 'float32x4' }, // color
          ],
        },
      ],
      bindGroupLayouts: [this.bindGroupLayout, this.lightBindGroupLayout], // @group(0) camera, @group(1) lights
      pipelineState: OPAQUE_PIPELINE_STATE,
      colorFormat: 'bgra8unorm',
      depthFormat: this.backend.getDepthFormat(),
    });

    this.spherePipelineInstanced = this.backend.createRenderPipeline({
      label: 'sphere-pipeline-instanced',
      shader: this.sphereShaderInstanced,
      vertexLayouts: [
        // Layout 0: per-vertex (position + normal)
        {
          arrayStride: 24,
          stepMode: 'vertex',
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x3' },
            { shaderLocation: 1, offset: 12, format: 'float32x3' },
          ],
        },
        // Layout 1: per-instance (mat4 transform + vec4 color)
        {
          arrayStride: 80,
          stepMode: 'instance',
          attributes: [
            { shaderLocation: 2, offset: 0, format: 'float32x4' },
            { shaderLocation: 3, offset: 16, format: 'float32x4' },
            { shaderLocation: 4, offset: 32, format: 'float32x4' },
            { shaderLocation: 5, offset: 48, format: 'float32x4' },
            { shaderLocation: 6, offset: 64, format: 'float32x4' },
          ],
        },
      ],
      bindGroupLayouts: [this.bindGroupLayout, this.lightBindGroupLayout], // @group(0) camera, @group(1) lights
      pipelineState: OPAQUE_PIPELINE_STATE,
      colorFormat: 'bgra8unorm',
      depthFormat: this.backend.getDepthFormat(),
    });

    console.log('Retro rendering pipelines created successfully (instanced only with vertex lighting)');
    console.log('Resources will be allocated dynamically as needed');

    // Epic 3.4: Initialize retro post-processor (shaders loaded internally)
    this.retroPostProcessor = new RetroPostProcessor(
      this.backend,
      {
        bloomThreshold: 0.8,
        bloomIntensity: 0.5,
        bloomMipLevels: 5,
        grainAmount: 0.02,
        gamma: 2.2,
        ditherPattern: 0,
        internalResolution: { width: 640, height: 480 },  // PS1-style fixed resolution
        crt: {
          enabled: true,
          masterIntensity: 1.0,
          brightness: 0.0,
          contrast: 0.0,
          saturation: 1.0,
          scanlinesStrength: 0.50,        // Moderate scanline strength (CRT-Yah default)
          beamWidthMin: 0.8,
          beamWidthMax: 1.0,
          beamShape: 0.7,
          maskIntensity: 0.30,            // Subtle phosphor mask (not dominant)
          maskType: 'aperture-grille',
          curvatureAmount: 0.03,          // Very subtle screen curve (0.10 was too distorted!)
          vignetteAmount: 0.20,           // Subtle edge darkening
          cornerRadius: 0.05,             // Subtle rounded corners
          colorOverflow: 0.3,             // Phosphor bloom intensity
        },
      }
    );
    this.retroPostProcessor.resize(this.canvas.width, this.canvas.height);
    console.log('Retro post-processor initialized (bloom + grain + dither)');
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

    this.cubeVertexBuffer = this.backend.createBuffer(
      'cube-vertices',
      'vertex',
      cubeInterleaved,
      'static_draw'
    );
    this.cubeIndexBuffer = this.backend.createBuffer(
      'cube-indices',
      'index',
      cubeData.indices,
      'static_draw'
    );
    this.cubeIndexCount = cubeData.indices.length;

    // Create sphere geometry with interleaved position+normal data
    // VRAM optimization: Reduced tessellation from (16,12) to (12,8) for 45% fewer vertices
    const sphereData = createSphere(0.5, 12, 8);
    const sphereInterleaved = this.interleavePositionNormal(sphereData.positions, sphereData.normals);

    this.sphereVertexBuffer = this.backend.createBuffer(
      'sphere-vertices',
      'vertex',
      sphereInterleaved,
      'static_draw'
    );
    this.sphereIndexBuffer = this.backend.createBuffer(
      'sphere-indices',
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

    // CRITICAL: Initialize all ECS systems (allocates matrix indices, etc.)
    this.world.init();
    console.log('ECS systems initialized');
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

    // Handle WebGPU context restoration
    this.canvas.addEventListener('webglcontextrestored', async () => {
      console.log('WebGPU context restored. Re-initializing renderer...');
      try {
        // Re-initialize the backend (WebGPU-only)
        this.backend = await BackendFactory.create(this.canvas, {
          antialias: true,
          alpha: false
        });

        // Recreate shaders and geometry
        await this.createShaders();
        this.createGeometry();

        // CRITICAL: Resize backend to match current canvas size
        if (this.backend) {
          this.backend.resize(this.canvas.width, this.canvas.height);
        }

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

    // Notify backend to resize depth buffer to match canvas
    if (this.backend) {
      this.backend.resize(this.canvas.width, this.canvas.height);
    }

    // Epic 3.4: Resize post-processor render targets
    if (this.retroPostProcessor) {
      this.retroPostProcessor.resize(this.canvas.width, this.canvas.height);
    }
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

  /**
   * Render instanced mesh with triple-buffering to prevent race conditions
   * Uses shared uniform buffer for view/projection matrix (not per-object buffers)
   */
  private renderInstancedMesh(
    instances: Array<{ entity: EntityId; transform: Transform; diceEntity: DiceEntity }>,
    bufferArray: InstanceBuffer[],
    pipeline: BackendPipelineHandle,
    vertexBuffer: BackendBufferHandle,
    indexBuffer: BackendBufferHandle,
    indexCount: number,
    getDieColor: (sides: number) => [number, number, number],
    viewProjMatrix: Float32Array,
    cameraTransform: Transform
  ): boolean {
    if (!this.physicsWorld) return false;

    // Get current buffer for this frame (triple-buffered rotation)
    const instanceBuffer = bufferArray[this.instanceBufferFrameIndex];

    // Resize if needed (rare - only when dice count grows beyond current capacity)
    if (instanceBuffer.getCapacity() < instances.length) {
      const newCapacity = Math.pow(2, Math.ceil(Math.log2(instances.length)));
      console.log(`[Demo] RESIZING buffer from ${instanceBuffer.getCapacity()} to ${newCapacity}`);
      instanceBuffer.resize(newCapacity);
    }

    // Safe to clear: GPU finished with this buffer 2 frames ago
    instanceBuffer.clear();

    // Build instance data
    let validInstanceCount = 0;
    for (let i = 0; i < instances.length; i++) {
      const { entity, transform, diceEntity } = instances[i];

      // Use cached rotation from sync loop
      const rotation = this.rotationCache.get(entity);
      if (!rotation) continue;

      let position;
      try {
        position = this.physicsWorld.getPosition(diceEntity.bodyHandle);
        if (!position) continue;
      } catch (e) {
        continue;
      }

      // Build model matrix
      const modelMatrix = this.matrixPool.acquire();
      const scale = { x: transform.scaleX, y: transform.scaleY, z: transform.scaleZ };
      this.createModelMatrix(modelMatrix, position, rotation, scale);

      // Get pure material color (let lighting system handle all brightness variation)
      const [r, g, b] = getDieColor(diceEntity.sides);

      // Set instance transform and color
      instanceBuffer.setInstanceTransform(validInstanceCount, modelMatrix);
      instanceBuffer.setInstanceColor(validInstanceCount, r, g, b, 1.0);

      // CRITICAL: Release matrix back to pool (fixes matrix pool leak)
      this.matrixPool.release(modelMatrix);

      validInstanceCount++;
    }

    if (validInstanceCount === 0) return false;

    // Upload instance buffer to GPU
    const gpuBuffer = this.instanceBufferManager.upload(instanceBuffer);

    // Shared uniform buffer is updated ONCE per frame in renderLoop, not here
    // This prevents race conditions from multiple updateBuffer calls

    // Epic 3.4: Issue retro instanced draw call with camera and light bind groups
    const drawCommand: DrawCommand = {
      pipeline,
      bindGroups: new Map([
        [0, this.sharedBindGroup], // Camera uniforms (@group(0))
        [1, this.lightBindGroup],  // Light storage buffer (@group(1))
      ]),
      geometry: {
        type: 'indexed',
        vertexBuffers: new Map([
          [0, vertexBuffer],
          [1, gpuBuffer.handle], // Extract the actual buffer handle, not the wrapper object
        ]),
        indexBuffer,
        indexFormat: 'uint16',
        indexCount,
        instanceCount: instanceBuffer.getCount(),
      },
    };

    this.backend!.executeDrawCommand(drawCommand);
    return true;
  }

  private renderLoop = (): void => {
    if (!this.backend || !this.cameraEntity) return;

    const now = performance.now();
    const deltaTime = this.lastTime ? (now - this.lastTime) / 1000 : 0;
    this.lastTime = now;

    // Step physics simulation
    const t0 = performance.now();
    let alpha = 0; // Interpolation factor
    if (this.physicsWorld && deltaTime > 0) {
      alpha = this.physicsWorld.step(deltaTime);
    }
    const t1 = performance.now();

    // Sync physics transforms to ECS entities
    if (this.physicsWorld) {
      // P1.1: Use cached query instead of rebuilding every frame
      if (!this.diceQuery) {
        this.diceQuery = this.world.query().with(Transform).with(DiceEntity).build();
      }

      // P1.2: Clear rotation cache from previous frame
      this.rotationCache.clear();

      for (const { entity, components } of this.world.executeQuery(this.diceQuery)) {
        const diceEntity = components.get(DiceEntity);

        if (diceEntity) {
          try {
            const physicsPos = this.physicsWorld.getPosition(diceEntity.bodyHandle);
            const physicsRot = this.physicsWorld.getRotation(diceEntity.bodyHandle);

            if (physicsPos && physicsRot) {
              // P0 FIX: Only sync position to Transform
              // Rotation is read directly from physics in render loop (no conversion needed)
              // This avoids wasteful quaternion→Euler→matrix conversion
              this.transformSystem.setPosition(entity, physicsPos.x, physicsPos.y, physicsPos.z);

              // P1.2: Cache rotation to avoid fetching twice
              this.rotationCache.set(entity, physicsRot);
            }
          } catch (e) {
            // Body might have been removed, skip this entity
            continue;
          }
        }
      }
    }
    const t2 = performance.now();

    // Update ECS systems (includes TransformSystem)
    this.world.update(deltaTime);
    const t3 = performance.now();

    // Get view-projection matrix from ECS camera
    const aspectRatio = this.canvas.width / this.canvas.height;
    const viewProjMatrix = this.cameraSystem.getViewProjectionMatrix(this.cameraEntity, aspectRatio);
    if (!viewProjMatrix) {
      console.warn('Failed to get view-projection matrix');
      return;
    }

    // Get camera position from Transform component
    const cameraTransform = this.world.getComponent(this.cameraEntity, Transform);
    if (!cameraTransform) return;

    // Epic 3.14: Begin frame
    this.backend.beginFrame();
    // console.log('[RENDER] Frame started');

    // Epic 3.4: Render to post-processor's intermediate texture (NOT swapchain)
    const sceneFramebuffer = this.retroPostProcessor.getSceneFramebuffer();
    // console.log('[RENDER] Got scene framebuffer:', !!sceneFramebuffer);
    this.backend.beginRenderPass(sceneFramebuffer, [0.05, 0.05, 0.08, 1.0], 1.0, 0, 'Scene Render Pass');
    // console.log('[RENDER] Began scene render pass');

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

    let drawCallCount = 0;
    let instancedObjectCount = 0;
    let instanceGroupCount = 0;

    // Rotate to next buffer frame (GPU finished with this buffer 2 frames ago)
    this.instanceBufferFrameIndex = (this.instanceBufferFrameIndex + 1) % Demo.INSTANCE_BUFFER_COUNT;

    // Render all dice using GPU instancing
    const diceEntities = this.world.executeQuery(this.diceQuery!);
    const tDiceLoopStart = performance.now();

    // Epic 3.5: Culling timing and stats (initialized outside for FPS display)
    let tCullStart = performance.now();
    let tCullEnd = tCullStart;
    let cullVisible = 0;
    let cullCulled = 0;

    if (this.physicsWorld && diceEntities.length > 0) {
      // Epic 3.5: Update object culler with current dice positions and perform culling
      tCullStart = performance.now();
      this.updateObjectCuller();

      // Epic 3.5: Perform culling (pass matrix and camera position directly)
      const cullResult = this.objectCuller.cull(viewProjMatrix, cameraTransform);
      tCullEnd = performance.now();

      // Epic 3.5: Capture culling stats for display
      cullVisible = cullResult.length;
      cullCulled = diceEntities.length - cullVisible;

      // Create Set of visible entity IDs for fast lookup (O(1) instead of O(n))
      const visibleEntities = new Set(cullResult.map(result => result.object.id));

      // Epic 3.4: Update camera uniform buffer for retro rendering
      // Camera struct: mat4 viewProj (16 floats) + vec3 position (3 floats) + padding (1 float) = 20 floats (80 bytes)
      const uniformData = new Float32Array(Demo.CAMERA_UNIFORM_FLOATS);
      uniformData.set(viewProjMatrix, 0); // mat4 viewProj (offset 0-15)
      uniformData[16] = cameraTransform.x; // vec3 position.x (offset 16)
      uniformData[17] = cameraTransform.y; // vec3 position.y (offset 17)
      uniformData[18] = cameraTransform.z; // vec3 position.z (offset 18)
      uniformData[19] = 0.0; // padding (offset 19)
      this.backend!.updateBuffer(this.sharedUniformBuffer, uniformData);

      // Group dice by mesh type (cube vs sphere)
      const cubeInstances: Array<{ entity: EntityId; transform: Transform; diceEntity: DiceEntity }> = [];
      const sphereInstances: Array<{ entity: EntityId; transform: Transform; diceEntity: DiceEntity }> = [];

      for (const { entity, components } of diceEntities) {
        // Epic 3.5: Skip culled (off-screen) objects
        if (!visibleEntities.has(entity)) continue;
        const transform = components.get(Transform);
        const diceEntity = components.get(DiceEntity);

        if (!transform || !diceEntity) continue;

        // Use cube mesh for D6, sphere for everything else
        const useCube = diceEntity.sides === 6;
        if (useCube) {
          cubeInstances.push({ entity, transform, diceEntity });
        } else {
          sphereInstances.push({ entity, transform, diceEntity });
        }
      }

      // console.log('[RENDER] Cube instances:', cubeInstances.length, 'Sphere instances:', sphereInstances.length);

      // Render cube instances
      if (cubeInstances.length > 0) {
        const rendered = this.renderInstancedMesh(
          cubeInstances,
          this.cubeInstanceBuffers,
          this.cubePipelineInstanced,
          this.cubeVertexBuffer,
          this.cubeIndexBuffer,
          this.cubeIndexCount,
          getDieColor,
          viewProjMatrix,
          cameraTransform
        );
        // console.log('[RENDER] Cube mesh rendered:', rendered);
        if (rendered) {
          drawCallCount++;
          instanceGroupCount++;
          instancedObjectCount += cubeInstances.length;
        }
      }

      // Render sphere instances
      if (sphereInstances.length > 0) {
        const rendered = this.renderInstancedMesh(
          sphereInstances,
          this.sphereInstanceBuffers,
          this.spherePipelineInstanced,
          this.sphereVertexBuffer,
          this.sphereIndexBuffer,
          this.sphereIndexCount,
          getDieColor,
          viewProjMatrix,
          cameraTransform
        );
        // console.log('[RENDER] Sphere mesh rendered:', rendered);
        if (rendered) {
          drawCallCount++;
          instanceGroupCount++;
          instancedObjectCount += sphereInstances.length;
        }
      }
    }
    const tDiceLoopEnd = performance.now();
    const t4 = tDiceLoopEnd; // For timing compatibility
    const t5 = tDiceLoopEnd;

    // Epic 3.4: End scene render pass (rendering to intermediate texture is complete)
    this.backend.endRenderPass();
    // console.log('[RENDER] Ended scene render pass');

    // Epic 3.4: Apply post-processing effects (bloom + grain + dither) and composite to swapchain
    const sceneTexture = this.retroPostProcessor.getSceneTexture();
    // console.log('[RENDER] Got scene texture:', !!sceneTexture);
    this.retroPostProcessor.updateTime(deltaTime);
    // console.log('[RENDER] Applying post-processor...');
    this.retroPostProcessor.apply(sceneTexture);

    // Epic 3.14: End frame
    const t6 = performance.now();
    this.backend.endFrame();
    // console.log('[RENDER] Frame ended');
    const t7 = performance.now();

    // Release all pooled matrices back to pool (eliminates per-frame allocations)
    this.matrixPool.releaseAll();
    this.mat3Pool.releaseAll();
    this.vec3Pool.releaseAll();

    // Track frame time
    const frameTime = now - this.lastFrameTime;
    this.lastFrameTime = now;
    this.frameTimeHistory.push(frameTime);
    if (this.frameTimeHistory.length > 60) this.frameTimeHistory.shift(); // Keep last 60 frames

    // Store instancing stats
    this.lastDrawCallCount = drawCallCount;
    this.lastInstanceGroupCount = instanceGroupCount;
    this.lastInstancedObjectCount = instancedObjectCount;

    // Update FPS counter
    this.frameCount++;
    if (now - this.lastFpsUpdate >= 1000) {
      const fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsUpdate));

      // Calculate average frame time from last 60 frames
      const avgFrameTime = this.frameTimeHistory.reduce((a, b) => a + b, 0) / this.frameTimeHistory.length;

      // Epic 3.14: Draw calls = diceEntities.length (no batching/instancing)
      const actualDrawCalls = this.lastDrawCallCount;

      // Calculate total triangles (approximate average between cube and sphere)
      const avgTrianglesPerDie = ((this.cubeIndexCount / 3) + (this.sphereIndexCount / 3)) / 2;
      const triangles = Math.round(avgTrianglesPerDie * actualDrawCalls);

      // Count total dice using ECS query
      const diceQuery = this.world.query().with(DiceEntity).build();
      const diceCount = Array.from(this.world.executeQuery(diceQuery)).length;

      // Epic 3.8: Get VRAM usage from VRAMProfiler
      const vramStats = this.backend.getVRAMStats();
      const vramMB = vramStats.totalUsed / (1024 * 1024);
      const vramUsagePercent = vramStats.utilizationPercent;

      // Debug VRAM allocations when dice cleared
      if (diceCount === 0 && this.lastDiceCount > 0 && !this.vramDebugLogged) {
        console.log('='.repeat(80));
        console.log('[VRAM DEBUG] Allocations after clearing dice:');
        const profiler = this.backend.getVRAMProfiler();
        const allocations = profiler.getLargestAllocations(50); // Top 50 by size
        console.table(allocations.map(a => ({
          name: a.id,
          category: a.category,
          mb: (a.bytes / 1024 / 1024).toFixed(2)
        })));
        console.log('='.repeat(80));
        this.vramDebugLogged = true;
      }
      if (diceCount > 0) {
        this.vramDebugLogged = false; // Reset flag when dice are added
      }
      this.lastDiceCount = diceCount;

      // Count allocations from VRAM profiler
      let bufferCount = 0;
      let textureCount = 0;
      for (const [category, usage] of vramStats.byCategory) {
        if (category === 'vertex_buffers' || category === 'index_buffers' || category === 'uniform_buffers') {
          bufferCount += usage.allocations;
        } else if (category === 'textures') {
          textureCount += usage.allocations;
        }
      }

      // Calculate CPU timing for this frame (t6-t7 calculated after executeCommands)
      const cpuTiming = {
        physics: (t1 - t0).toFixed(2),
        sync: (t2 - t1).toFixed(2),
        ecs: (t3 - t2).toFixed(2),
        diceLoop: (tDiceLoopEnd - tDiceLoopStart).toFixed(2),
        cull: (tCullEnd - tCullStart).toFixed(2),
        sort: (t5 - t4).toFixed(2),
        gpuEncode: (t7 - t6).toFixed(2)
      };

      // Epic 3.5: Culling statistics
      const cullStats = {
        visible: cullVisible,
        culled: cullCulled
      };

      // Calculate total CPU time
      const totalCpu = (t1 - t0) + (t2 - t1) + (t3 - t2) + (tDiceLoopEnd - tDiceLoopStart) +
                       (tCullEnd - tCullStart) + (t5 - t4) + (t7 - t6);

      // Estimate GPU execution time (frame time - CPU time)
      const gpuExec = Math.max(0, avgFrameTime - totalCpu);

      this.updateStats(
        fps,
        avgFrameTime,
        actualDrawCalls,
        triangles,
        this.lastInstanceGroupCount, // Number of instanced draw calls
        this.lastInstancedObjectCount, // Number of objects rendered via instancing
        0, // drawCallReduction (legacy)
        diceCount,
        vramMB,
        vramUsagePercent,
        bufferCount,
        textureCount,
        cpuTiming,
        undefined, // resourcePoolStats removed (was tracking obsolete per-object uniform buffer pool)
        gpuExec,
        cullStats
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

    // CRITICAL FIX: Initialize TransformSystem for new entities to allocate matrix indices
    // Without this, new entities have localMatrixIndex = -1 which causes allocation failures
    // after multiple button clicks when capacity is exceeded
    this.transformSystem.init();

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
        // Epic 3.5: Remove from object culler and spatial map (prevent memory leak)
        const spatialData = this.spatialObjectMap.get(entity);
        if (spatialData) {
          this.objectCuller.removeObject(spatialData.spatial);
          this.spatialObjectMap.delete(entity);
        }

        // IMPORTANT: Remove ECS entity FIRST, then physics body
        // This prevents race conditions where physics sync tries to access removed bodies
        this.world.destroyEntity(entity);
        this.physicsWorld.removeRigidBody(diceEntity.bodyHandle);
      }
    }
  }

  /**
   * CRITICAL FIX #14: Convert quaternion to Euler angles (in radians)
   * Uses proper mathematical conversion to avoid gimbal lock and maintain correct rotation
   *
   * @param quat - Quaternion rotation (x, y, z, w)
   * @returns Euler angles in radians { x: pitch, y: yaw, z: roll }
   */
  private quaternionToEuler(quat: { x: number; y: number; z: number; w: number }): { x: number; y: number; z: number } {
    const { x, y, z, w } = quat;

    // Roll (X-axis rotation)
    const sinr_cosp = 2 * (w * x + y * z);
    const cosr_cosp = 1 - 2 * (x * x + y * y);
    const roll = Math.atan2(sinr_cosp, cosr_cosp);

    // Pitch (Y-axis rotation)
    const sinp = 2 * (w * y - z * x);
    const pitch = Math.abs(sinp) >= 1 ? Math.sign(sinp) * Math.PI / 2 : Math.asin(sinp);

    // Yaw (Z-axis rotation)
    const siny_cosp = 2 * (w * z + x * y);
    const cosy_cosp = 1 - 2 * (y * y + z * z);
    const yaw = Math.atan2(siny_cosp, cosy_cosp);

    return { x: roll, y: pitch, z: yaw };
  }

  private createModelMatrix(
    out: Float32Array,
    position: { x: number; y: number; z: number },
    rotation: { x: number; y: number; z: number; w: number },
    scale: { x: number; y: number; z: number } = { x: 1, y: 1, z: 1 }
  ): void {
    // Convert quaternion to rotation matrix
    const x = rotation.x, y = rotation.y, z = rotation.z, w = rotation.w;
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2;
    const yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;

    // Apply scale to rotation matrix (TRS composition)
    const sx = scale.x, sy = scale.y, sz = scale.z;

    out[0] = (1 - (yy + zz)) * sx; out[1] = (xy + wz) * sx;       out[2] = (xz - wy) * sx;       out[3] = 0;
    out[4] = (xy - wz) * sy;       out[5] = (1 - (xx + zz)) * sy; out[6] = (yz + wx) * sy;       out[7] = 0;
    out[8] = (xz + wy) * sz;       out[9] = (yz - wx) * sz;       out[10] = (1 - (xx + yy)) * sz; out[11] = 0;
    out[12] = position.x;          out[13] = position.y;          out[14] = position.z;          out[15] = 1;
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
    textureCount: number,
    cpuTiming?: { physics: string; sync: string; ecs: string; diceLoop: string; cull: string; sort: string; gpuEncode: string },
    resourcePoolStats?: { poolSize: number; used: number },
    gpuExec?: number,
    cullStats?: { visible: number; culled: number }
  ): void {
    // Basic performance metrics
    const fpsEl = document.getElementById('fps');
    const frameTimeEl = document.getElementById('frame-time');
    const resolutionEl = document.getElementById('resolution');

    if (fpsEl) fpsEl.textContent = fps.toString();
    if (frameTimeEl) frameTimeEl.textContent = frameTime.toFixed(2);
    if (resolutionEl) resolutionEl.textContent = `${this.canvas.width}x${this.canvas.height}`;

    // Object statistics
    const objectCountEl = document.getElementById('object-count');
    const instanceGroupsEl = document.getElementById('instance-groups');
    const instancedObjectsEl = document.getElementById('instanced-objects');

    if (objectCountEl) objectCountEl.textContent = objectCount.toString();
    if (instanceGroupsEl) instanceGroupsEl.textContent = instanceGroups.toString();
    if (instancedObjectsEl) instancedObjectsEl.textContent = instancedObjects.toString();

    // Memory statistics
    const vramEl = document.getElementById('vram-usage');
    const bufferCountEl = document.getElementById('buffer-count');
    const textureCountEl = document.getElementById('texture-count');

    if (vramEl) vramEl.textContent = `${vramUsage.toFixed(2)} MB (${vramUsagePercent.toFixed(1)}%)`;
    if (bufferCountEl) bufferCountEl.textContent = bufferCount.toString();
    if (textureCountEl) textureCountEl.textContent = textureCount.toString();

    // CPU timing breakdown
    if (cpuTiming) {
      const cpuPhysicsEl = document.getElementById('cpu-physics');
      const cpuSyncEl = document.getElementById('cpu-sync');
      const cpuEcsEl = document.getElementById('cpu-ecs');
      const cpuLoopEl = document.getElementById('cpu-loop');
      const cpuCullEl = document.getElementById('cpu-cull');
      const cpuSortEl = document.getElementById('cpu-sort');
      const cpuGpuEl = document.getElementById('cpu-gpu');
      const cpuTotalEl = document.getElementById('cpu-total');

      if (cpuPhysicsEl) cpuPhysicsEl.textContent = cpuTiming.physics;
      if (cpuSyncEl) cpuSyncEl.textContent = cpuTiming.sync;
      if (cpuEcsEl) cpuEcsEl.textContent = cpuTiming.ecs;
      if (cpuLoopEl) cpuLoopEl.textContent = cpuTiming.diceLoop;
      if (cpuCullEl) cpuCullEl.textContent = cpuTiming.cull;
      if (cpuSortEl) cpuSortEl.textContent = cpuTiming.sort;
      if (cpuGpuEl) cpuGpuEl.textContent = cpuTiming.gpuEncode;

      // Calculate total CPU time
      const totalCpu = parseFloat(cpuTiming.physics) + parseFloat(cpuTiming.sync) +
                       parseFloat(cpuTiming.ecs) + parseFloat(cpuTiming.diceLoop) +
                       parseFloat(cpuTiming.cull) + parseFloat(cpuTiming.sort) +
                       parseFloat(cpuTiming.gpuEncode);
      if (cpuTotalEl) cpuTotalEl.textContent = totalCpu.toFixed(2);
    }

    // Epic 3.5: Culling statistics
    if (cullStats) {
      const cullVisibleEl = document.getElementById('cull-visible');
      const cullCulledEl = document.getElementById('cull-culled');
      const cullReductionEl = document.getElementById('cull-reduction');

      if (cullVisibleEl) cullVisibleEl.textContent = cullStats.visible.toString();
      if (cullCulledEl) cullCulledEl.textContent = cullStats.culled.toString();

      if (cullReductionEl) {
        const total = cullStats.visible + cullStats.culled;
        const reduction = total > 0 ? (cullStats.culled / total) * 100 : 0;
        cullReductionEl.textContent = reduction.toFixed(1);
      }
    }

    // GPU execution time (estimate from frame time - CPU total)
    if (gpuExec !== undefined) {
      const gpuExecEl = document.getElementById('gpu-exec');
      if (gpuExecEl) gpuExecEl.textContent = gpuExec.toFixed(2);
    }

    // Resource pool statistics
    if (resourcePoolStats) {
      const poolSizeEl = document.getElementById('preallocated-resources');
      const usedEl = document.getElementById('used-resources');
      const utilEl = document.getElementById('resource-utilization');

      if (poolSizeEl) poolSizeEl.textContent = resourcePoolStats.poolSize.toString();
      if (usedEl) usedEl.textContent = resourcePoolStats.used.toString();
      if (utilEl) {
        const utilization = resourcePoolStats.poolSize > 0
          ? (resourcePoolStats.used / resourcePoolStats.poolSize) * 100
          : 0;
        utilEl.textContent = utilization.toFixed(1);
      }
    }
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

    // Epic 3.5: Clear object culler and spatial map (prevent memory leak)
    this.objectCuller.clear();
    this.spatialObjectMap.clear();
    console.log('[RESET] Object culler and spatial map cleared');

    // Epic 3.4: Clear and resize instance buffers to minimum capacity to free VRAM
    const minCapacity = 128;
    console.log(`[RESET] Clearing and resizing instance buffers to minimum capacity: ${minCapacity}`);
    for (let i = 0; i < Demo.INSTANCE_BUFFER_COUNT; i++) {
      // Delete GPU buffers FIRST to free VRAM immediately
      // CRITICAL: Without this, GPU buffers persist at old capacity since renderInstancedMesh
      // won't be called when there are 0 dice
      this.instanceBufferManager.delete(this.cubeInstanceBuffers[i]);
      this.instanceBufferManager.delete(this.sphereInstanceBuffers[i]);

      // Clear the CPU buffers (sets count to 0)
      this.cubeInstanceBuffers[i].clear();
      this.sphereInstanceBuffers[i].clear();

      // Resize CPU buffers to minimum capacity
      this.cubeInstanceBuffers[i].resize(minCapacity);
      this.sphereInstanceBuffers[i].resize(minCapacity);
    }

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

  /**
   * Epic 3.5: Calculate correct bounding sphere radius for die type
   * Uses actual physics collision shape dimensions to prevent pop-in/pop-out
   */
  private getDieBoundingSphereRadius(sides: number): number {
    switch (sides) {
      case 4:  return 0.4;  // D4: SPHERE radius 0.4
      case 6:  return Math.sqrt(0.5 * 0.5 + 0.5 * 0.5 + 0.5 * 0.5);  // D6: BOX diagonal ≈ 0.866
      case 8:  return 0.5;  // D8: SPHERE radius 0.5
      case 10: return Math.sqrt(0.45 * 0.45 + 0.5 * 0.5);  // D10: CYLINDER ≈ 0.673
      case 12: return 0.55;  // D12: SPHERE radius 0.55
      case 20: return 0.6;  // D20: SPHERE radius 0.6
      default:
        console.warn(`Unknown die type: ${sides}, using default radius 0.5`);
        return 0.5;
    }
  }

  /**
   * Epic 3.5: Update frustum culler with current dice positions
   * PERFORMANCE: Reuses BoundingSphere objects, skips sleeping bodies
   */
  private updateObjectCuller(): void {
    if (!this.physicsWorld || !this.diceQuery) return;

    const diceEntities = this.world.executeQuery(this.diceQuery);

    for (const { entity, components } of diceEntities) {
      const diceEntity = components.get(DiceEntity);
      if (!diceEntity) continue;

      // Get or create spatial data for this entity
      let spatialData = this.spatialObjectMap.get(entity);
      if (!spatialData) {
        // First time seeing this entity - create spatial object
        const radius = this.getDieBoundingSphereRadius(diceEntity.sides);
        const boundingSphere = new BoundingSphere(0, 0, 0, radius);
        const spatial: SpatialObject = {
          id: entity,
          boundingSphere: boundingSphere
        };
        this.objectCuller.addObject(spatial);

        spatialData = { spatial, boundingSphere };
        this.spatialObjectMap.set(entity, spatialData);
      }

      // OPTIMIZATION: Only update position if body is awake
      if (this.physicsWorld.isSleeping(diceEntity.bodyHandle)) {
        continue;
      }

      // Update position (reuses existing BoundingSphere - NO ALLOCATION)
      try {
        const position = this.physicsWorld.getPosition(diceEntity.bodyHandle);
        if (position) {
          spatialData.boundingSphere.x = position.x;
          spatialData.boundingSphere.y = position.y;
          spatialData.boundingSphere.z = position.z;
          // Radius never changes, no need to update

          // Notify spatial grid of position change
          this.objectCuller.updateObject(spatialData.spatial);
        }
      } catch (e) {
        // Body might have been removed, will be cleaned up in removal phase
      }
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

    // Epic 3.4: Dispose retro post-processor
    if (this.retroPostProcessor) {
      this.retroPostProcessor.dispose();
    }

    // Dispose physics world
    if (this.physicsWorld) {
      this.physicsWorld.dispose();
      this.physicsWorld = null;
    }

    // Note: Dice entities are managed by World and will be cleaned up automatically
    this.groundBody = null;
  }
}
