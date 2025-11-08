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
import { World, TransformSystem, Transform, Camera, type EntityId } from '../../ecs/src';
import { DiceEntity } from './components/DiceEntity';
import './components/registerDemoComponents'; // Register custom components

export class Demo {
  private canvas: HTMLCanvasElement;
  private renderer: Renderer | null = null;
  private animationId: number | null = null;
  private startTime: number = 0;
  private frameCount: number = 0;
  private lastFpsUpdate: number = 0;
  private resizeHandler: (() => void) | null = null;

  // ECS World and Systems
  private world: World;
  private transformSystem: TransformSystem;
  private cameraSystem: CameraSystem;

  // ECS Camera
  private cameraEntity: EntityId | null = null;
  private orbitController: OrbitCameraController | null = null;

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
  private groundBody: RigidBodyHandle | null = null;
  private lastTime: number = 0;
  private diceSets: number = 1; // Number of dice sets to roll (1 set = 6 dice)

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    // Initialize ECS World
    this.world = new World();

    // Initialize and register ECS Systems
    this.transformSystem = new TransformSystem(this.world);
    this.world.registerSystem(this.transformSystem);

    // CameraSystem is a utility class, not a System
    this.cameraSystem = new CameraSystem(this.world);
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
    if (!this.renderer) return;

    // Import shaders as raw strings using Vite's ?raw suffix
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
    if (!this.renderer || !this.cameraEntity) return;

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
          const physicsPos = this.physicsWorld.getPosition(diceEntity.bodyHandle);
          const physicsRot = this.physicsWorld.getRotation(diceEntity.bodyHandle);

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
      }
    }

    // Update ECS systems (includes TransformSystem)
    this.world.update(deltaTime);

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

    // Get view-projection matrix from ECS camera
    const aspectRatio = this.canvas.width / this.canvas.height;
    const viewProjMatrix = this.cameraSystem.getViewProjectionMatrix(this.cameraEntity, aspectRatio);

    // Get camera position from Transform component
    const cameraTransform = this.world.getComponent(this.cameraEntity, Transform);
    if (!cameraTransform) return;

    // Get uniform locations
    const mvpLoc = gl.getUniformLocation(program.program, 'uModelViewProjection');
    const modelLoc = gl.getUniformLocation(program.program, 'uModel');
    const normalMatLoc = gl.getUniformLocation(program.program, 'uNormalMatrix');
    const lightDirLoc = gl.getUniformLocation(program.program, 'uLightDir');
    const cameraPosLoc = gl.getUniformLocation(program.program, 'uCameraPos');
    const baseColorLoc = gl.getUniformLocation(program.program, 'uBaseColor');

    // Set common uniforms
    gl.uniform3f(lightDirLoc, 0.5, 1.0, 0.5);
    gl.uniform3f(cameraPosLoc, cameraTransform.x, cameraTransform.y, cameraTransform.z);

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

    // Draw all dice using ECS query
    const diceQuery = this.world.query().with(Transform).with(DiceEntity).build();
    const diceEntities = this.world.executeQuery(diceQuery);

    if (this.physicsWorld && diceEntities.length > 0) {
      for (const { components } of diceEntities) {
        const transform = components.get(Transform);
        const diceEntity = components.get(DiceEntity);

        if (!transform || !diceEntity) continue;

        const position = this.physicsWorld.getPosition(diceEntity.bodyHandle);
        const rotation = this.physicsWorld.getRotation(diceEntity.bodyHandle);
        const modelMatrix = this.createModelMatrix(position, rotation);
        const mvpMatrix = this.multiplyMatrices(viewProjMatrix, modelMatrix);

        // Use cube mesh for D6, sphere for everything else
        const useCube = diceEntity.sides === 6;

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
        const [r, g, b] = getDieColor(diceEntity.sides);
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
        // Remove physics body
        this.physicsWorld.removeRigidBody(diceEntity.bodyHandle);

        // Remove ECS entity
        this.world.removeEntity(entity);
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

    // Count current dice using ECS query
    const query = this.world.query().with(DiceEntity).build();
    const currentDiceCount = Array.from(this.world.executeQuery(query)).length;

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

  public setDiceSets(value: number): void {
    const clampedValue = Math.max(1, Math.min(200, Math.floor(value)));
    if (this.diceSets !== clampedValue) {
      this.diceSets = clampedValue;
      this.updateDiceCountDisplay();
    }
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
