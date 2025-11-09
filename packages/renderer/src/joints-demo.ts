/**
 * Joint Constraints Demo
 *
 * Demonstrates various types of physics joint constraints:
 * - FIXED: Welded bodies (chain links)
 * - REVOLUTE: Hinges (door, pendulum)
 * - PRISMATIC: Sliders (elevator platform)
 * - SPHERICAL: Ball-and-socket (ragdoll arm)
 * - Powered joints with motors
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
  BackendFactory,
  type IRendererBackend,
  RenderQueue,
  type DrawCommand,
  RenderCommandType,
  PrimitiveMode,
} from '../../rendering/src';
import {
  PhysicsWorld,
  RapierPhysicsEngine,
  RigidBodyType,
  CollisionShapeType,
  JointType,
  type RigidBodyHandle,
  type JointHandle,
} from '../../physics/src';
import { World, TransformSystem, Transform, Camera, type EntityId } from '../../ecs/src';
import { JointBodyEntity } from './components/JointBodyEntity';
import './components/registerDemoComponents';

export class JointsDemo {
  private canvas: HTMLCanvasElement;
  private backend: IRendererBackend | null = null;
  private renderer: Renderer | null = null;
  private renderQueue: RenderQueue;
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
  private joints: JointHandle[] = [];
  private lastTime: number = 0;

  // Demo controls
  private motorSpeed: number = 2.0;
  private motorJoint: JointHandle | null = null;

  // Elevator animation
  private elevatorPlatform: RigidBodyHandle | null = null;
  private elevatorTime: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    // Initialize ECS World
    this.world = new World();

    // Initialize and register ECS Systems
    this.transformSystem = new TransformSystem(this.world);
    this.world.registerSystem(this.transformSystem);

    // CameraSystem is a utility class, not a System
    this.cameraSystem = new CameraSystem(this.world);

    // Initialize RenderQueue
    this.renderQueue = new RenderQueue();
  }

  async initialize(): Promise<boolean> {
    try {
      console.log('Initializing joints demo...');

      // Setup WebGL context loss handling
      this.setupContextLossHandling();

      // Resize canvas to fill window
      this.resizeCanvas();
      this.resizeHandler = () => this.resizeCanvas();
      window.addEventListener('resize', this.resizeHandler);

      console.log('Creating rendering backend...');

      // Create backend with WebGPU enabled (automatic fallback to WebGL2)
      this.backend = await BackendFactory.create(this.canvas, {
        enableWebGPU: true,
        enableWebGL2: true,
        antialias: true,
        alpha: false,
        depth: true,
        powerPreference: 'high-performance',
      });

      console.log(`Using backend: ${this.backend.name}`);

      // Create legacy Renderer only for WebGL2 backend (for BufferManager/ShaderManager compatibility)
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

      // Add Transform component - positioned to view joint demos
      this.world.addComponent(this.cameraEntity, Transform, new Transform(0, 15, 30));

      // Add Camera component - perspective projection
      this.world.addComponent(this.cameraEntity, Camera, Camera.perspective(
        (45 * Math.PI) / 180, // 45 degrees FOV in radians
        0.1,                   // near
        200                    // far
      ));

      // Create orbit camera controller
      this.orbitController = new OrbitCameraController(this.cameraEntity, this.world, 30); // distance = 30
      this.orbitController.setTarget(0, 5, 0); // Look at joint area

      // Setup mouse controls for camera
      this.setupCameraControls();

      // Create shader program
      await this.createShaders();

      // Create geometry
      this.createGeometry();

      // Initialize physics world
      await this.initializePhysics();

      console.log('Joints demo initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize joints demo:', error);
      return false;
    }
  }

  private async createShaders(): Promise<void> {
    if (!this.backend) return;

    if (this.backend.name === 'WebGPU') {
      console.log('Loading WGSL shaders for WebGPU backend');
      const wgslSource = await import('./shaders/basic-lighting.wgsl?raw').then(m => m.default);
      await this.backend.createShader(this.shaderProgramId, {
        vertex: wgslSource,
        fragment: wgslSource,
      });
      console.log('WGSL shaders compiled successfully');
    } else {
      console.log('Loading GLSL shaders for WebGL2 backend');
      // Import shaders as raw strings using Vite's ?raw suffix
      const vertexShaderSource = await import('./shaders/basic-lighting.vert?raw').then(m => m.default);
      const fragmentShaderSource = await import('./shaders/basic-lighting.frag?raw').then(m => m.default);

      if (this.renderer) {
        const shaderManager = this.renderer.getShaderManager();
        shaderManager.createProgram(this.shaderProgramId, {
          vertex: vertexShaderSource,
          fragment: fragmentShaderSource,
        });
      }
      console.log('GLSL shaders compiled successfully');
    }
  }

  private createGeometry(): void {
    if (!this.backend) return;

    // Create cube geometry
    const cubeData = createCube(1.0);
    this.backend.createBuffer(
      this.cubeVertexBufferId,
      'vertex',
      cubeData.positions,
      'static'
    );
    this.backend.createBuffer(
      this.cubeNormalBufferId,
      'vertex',
      cubeData.normals,
      'static'
    );
    this.backend.createBuffer(
      this.cubeIndexBufferId,
      'index',
      cubeData.indices,
      'static'
    );
    this.cubeIndexCount = cubeData.indices.length;

    // Create sphere geometry
    const sphereData = createSphere(0.5, 16, 12);
    this.backend.createBuffer(
      this.sphereVertexBufferId,
      'vertex',
      sphereData.positions,
      'static'
    );
    this.backend.createBuffer(
      this.sphereNormalBufferId,
      'vertex',
      sphereData.normals,
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

  /**
   * Helper to create a physics body and corresponding ECS entity
   */
  private createBodyEntity(
    handle: RigidBodyHandle,
    type: 'cube' | 'sphere',
    scale: { x: number; y: number; z: number },
    color: [number, number, number]
  ): EntityId {
    if (!this.physicsWorld) {
      throw new Error('Physics world not initialized');
    }

    const position = this.physicsWorld.getPosition(handle);
    const rotation = this.physicsWorld.getRotation(handle);

    // Create ECS entity
    const entity = this.world.createEntity();

    // Add Transform component
    this.world.addComponent(entity, Transform, new Transform(
      position.x, position.y, position.z
    ));

    // Add JointBodyEntity component
    this.world.addComponent(entity, JointBodyEntity, new JointBodyEntity(
      handle, type, scale, color
    ));

    return entity;
  }

  private async initializePhysics(): Promise<void> {
    console.log('Initializing physics with joint constraints...');

    // Create physics world
    const engine = new RapierPhysicsEngine();
    this.physicsWorld = await PhysicsWorld.create(engine, {
      gravity: { x: 0, y: -9.81, z: 0 },
      timestep: 1 / 60,
    });

    // Create ground plane
    const groundHandle = this.physicsWorld.createRigidBody({
      type: RigidBodyType.STATIC,
      position: { x: 0, y: 0, z: 0 },
      collisionShape: {
        type: CollisionShapeType.BOX,
        halfExtents: { x: 50, y: 0.5, z: 50 },
      },
      friction: 0.6,
      restitution: 0.2,
    });
    this.createBodyEntity(groundHandle, 'cube', { x: 100, y: 1, z: 100 }, [0.3, 0.3, 0.3]);

    // Create demonstrations
    this.createChainDemo(-15, 10, 0);
    this.createDoorDemo(-5, 0, -10);
    this.createPendulumDemo(5, 15, -10);
    this.createSliderDemo(15, 5, 0);
    this.createRagdollArmDemo(0, 8, 10);
    this.createMotorDemo(-10, 5, 10);

    // Count bodies using ECS query
    const bodyQuery = this.world.query().with(JointBodyEntity).build();
    const bodyCount = Array.from(this.world.executeQuery(bodyQuery)).length;
    console.log(`Physics initialized with ${bodyCount} bodies and ${this.joints.length} joints`);
  }

  /**
   * Chain demo - FIXED joints welding links together
   */
  private createChainDemo(x: number, y: number, z: number): void {
    if (!this.physicsWorld) return;

    // Create anchor point
    const anchorHandle = this.physicsWorld.createRigidBody({
      type: RigidBodyType.STATIC,
      position: { x, y, z },
      collisionShape: {
        type: CollisionShapeType.SPHERE,
        radius: 0.3,
      },
    });
    this.createBodyEntity(anchorHandle, 'sphere', { x: 0.6, y: 0.6, z: 0.6 }, [0.5, 0.5, 0.5]);

    // Create chain links
    const linkCount = 8;
    const linkLength = 0.8;
    const linkWidth = 0.3;
    let prevHandle = anchorHandle;

    for (let i = 0; i < linkCount; i++) {
      const linkY = y - (i + 1) * linkLength;
      const linkHandle = this.physicsWorld.createRigidBody({
        type: RigidBodyType.DYNAMIC,
        position: { x, y: linkY, z },
        collisionShape: {
          type: CollisionShapeType.BOX,
          halfExtents: { x: linkWidth / 2, y: linkLength / 2, z: linkWidth / 2 },
        },
        mass: 0.5,
        friction: 0.5,
        restitution: 0.1,
      });
      this.createBodyEntity(linkHandle, 'cube', { x: linkWidth, y: linkLength, z: linkWidth }, [0.8, 0.4, 0.2]);

      // Create fixed joint between links
      const joint = this.physicsWorld.createJoint({
        type: JointType.FIXED,
        bodyA: prevHandle,
        bodyB: linkHandle,
        anchorA: { position: { x: 0, y: -linkLength / 2, z: 0 } },
        anchorB: { position: { x: 0, y: linkLength / 2, z: 0 } },
        collideConnected: false,
      });
      this.joints.push(joint);

      prevHandle = linkHandle;
    }

    // Add weight at the end
    const weightHandle = this.physicsWorld.createRigidBody({
      type: RigidBodyType.DYNAMIC,
      position: { x, y: y - (linkCount + 1) * linkLength, z },
      collisionShape: {
        type: CollisionShapeType.SPHERE,
        radius: 0.5,
      },
      mass: 2.0,
      friction: 0.5,
      restitution: 0.3,
    });
    this.createBodyEntity(weightHandle, 'sphere', { x: 1.0, y: 1.0, z: 1.0 }, [0.9, 0.7, 0.1]);

    const weightJoint = this.physicsWorld.createJoint({
      type: JointType.FIXED,
      bodyA: prevHandle,
      bodyB: weightHandle,
      anchorA: { position: { x: 0, y: -linkLength / 2, z: 0 } },
      anchorB: { position: { x: 0, y: 0.5, z: 0 } },
      collideConnected: false,
    });
    this.joints.push(weightJoint);
  }

  /**
   * Door demo - REVOLUTE joint (hinge)
   */
  private createDoorDemo(x: number, y: number, z: number): void {
    if (!this.physicsWorld) return;

    // Create door frame (static)
    const frameHandle = this.physicsWorld.createRigidBody({
      type: RigidBodyType.STATIC,
      position: { x, y: y + 2, z },
      collisionShape: {
        type: CollisionShapeType.BOX,
        halfExtents: { x: 0.2, y: 2, z: 0.2 },
      },
    });
    this.createBodyEntity(frameHandle, 'cube', { x: 0.4, y: 4, z: 0.4 }, [0.4, 0.3, 0.2]);

    // Create door (dynamic)
    const doorHandle = this.physicsWorld.createRigidBody({
      type: RigidBodyType.DYNAMIC,
      position: { x: x + 1.5, y: y + 2, z },
      collisionShape: {
        type: CollisionShapeType.BOX,
        halfExtents: { x: 1.5, y: 1.8, z: 0.1 },
      },
      mass: 2.0,
      friction: 0.5,
      restitution: 0.1,
    });
    this.createBodyEntity(doorHandle, 'cube', { x: 3, y: 3.6, z: 0.2 }, [0.6, 0.3, 0.1]);

    // Create revolute joint (hinge) with limits
    const joint = this.physicsWorld.createJoint({
      type: JointType.REVOLUTE,
      bodyA: frameHandle,
      bodyB: doorHandle,
      anchorA: { position: { x: 0, y: 0, z: 0 } },
      anchorB: { position: { x: -1.5, y: 0, z: 0 } }, // Hinge on left edge
      axis: { x: 0, y: 1, z: 0 }, // Rotate around Y axis
      limits: { min: -Math.PI / 2, max: Math.PI / 2 }, // 90 degrees each way
      collideConnected: false,
    });
    this.joints.push(joint);

    // Give the door a push
    this.physicsWorld.applyImpulse(doorHandle, { x: 0, y: 0, z: 15 });
  }

  /**
   * Pendulum demo - REVOLUTE joint
   */
  private createPendulumDemo(x: number, y: number, z: number): void {
    if (!this.physicsWorld) return;

    // Create anchor
    const anchorHandle = this.physicsWorld.createRigidBody({
      type: RigidBodyType.STATIC,
      position: { x, y, z },
      collisionShape: {
        type: CollisionShapeType.SPHERE,
        radius: 0.2,
      },
    });
    this.createBodyEntity(anchorHandle, 'sphere', { x: 0.4, y: 0.4, z: 0.4 }, [0.5, 0.5, 0.5]);

    // Create pendulum rod
    const rodLength = 4.0;
    const rodHandle = this.physicsWorld.createRigidBody({
      type: RigidBodyType.DYNAMIC,
      position: { x, y: y - rodLength / 2, z },
      collisionShape: {
        type: CollisionShapeType.BOX,
        halfExtents: { x: 0.1, y: rodLength / 2, z: 0.1 },
      },
      mass: 0.5,
      friction: 0.3,
      restitution: 0.1,
    });
    this.createBodyEntity(rodHandle, 'cube', { x: 0.2, y: rodLength, z: 0.2 }, [0.7, 0.7, 0.7]);

    // Create revolute joint at top
    const joint = this.physicsWorld.createJoint({
      type: JointType.REVOLUTE,
      bodyA: anchorHandle,
      bodyB: rodHandle,
      anchorA: { position: { x: 0, y: 0, z: 0 } },
      anchorB: { position: { x: 0, y: rodLength / 2, z: 0 } },
      axis: { x: 0, y: 0, z: 1 }, // Swing in X-Y plane
      collideConnected: false,
    });
    this.joints.push(joint);

    // Add weight at bottom
    const weightHandle = this.physicsWorld.createRigidBody({
      type: RigidBodyType.DYNAMIC,
      position: { x, y: y - rodLength, z },
      collisionShape: {
        type: CollisionShapeType.SPHERE,
        radius: 0.6,
      },
      mass: 3.0,
      friction: 0.3,
      restitution: 0.2,
    });
    this.createBodyEntity(weightHandle, 'sphere', { x: 1.2, y: 1.2, z: 1.2 }, [0.9, 0.1, 0.1]);

    // Connect weight to rod with fixed joint
    const weightJoint = this.physicsWorld.createJoint({
      type: JointType.FIXED,
      bodyA: rodHandle,
      bodyB: weightHandle,
      anchorA: { position: { x: 0, y: -rodLength / 2, z: 0 } },
      anchorB: { position: { x: 0, y: 0, z: 0 } },
      collideConnected: false,
    });
    this.joints.push(weightJoint);

    // Give it initial velocity
    this.physicsWorld.setLinearVelocity(weightHandle, { x: 8, y: 0, z: 0 });
  }

  /**
   * Slider demo - PRISMATIC joint
   */
  private createSliderDemo(x: number, y: number, z: number): void {
    if (!this.physicsWorld) return;

    // Create guide rails
    const rail1Handle = this.physicsWorld.createRigidBody({
      type: RigidBodyType.STATIC,
      position: { x, y, z: z - 0.5 },
      collisionShape: {
        type: CollisionShapeType.BOX,
        halfExtents: { x: 0.1, y: 5, z: 0.1 },
      },
    });
    this.createBodyEntity(rail1Handle, 'cube', { x: 0.2, y: 10, z: 0.2 }, [1.0, 0.2, 0.2]);

    const rail2Handle = this.physicsWorld.createRigidBody({
      type: RigidBodyType.STATIC,
      position: { x, y, z: z + 0.5 },
      collisionShape: {
        type: CollisionShapeType.BOX,
        halfExtents: { x: 0.1, y: 5, z: 0.1 },
      },
    });
    this.createBodyEntity(rail2Handle, 'cube', { x: 0.2, y: 10, z: 0.2 }, [1.0, 0.2, 0.2]);

    // Create platform
    const platformHandle = this.physicsWorld.createRigidBody({
      type: RigidBodyType.DYNAMIC,
      position: { x, y, z },
      collisionShape: {
        type: CollisionShapeType.BOX,
        halfExtents: { x: 0.8, y: 0.2, z: 0.8 },
      },
      mass: 2.0,
      friction: 0.3,
      restitution: 0.8, // Higher restitution for bouncing
      linearDamping: 0.1, // Low damping to keep moving
    });
    this.createBodyEntity(platformHandle, 'cube', { x: 1.6, y: 0.4, z: 1.6 }, [1.0, 1.0, 0.0]);

    // Create prismatic joint (vertical slider)
    const joint = this.physicsWorld.createJoint({
      type: JointType.PRISMATIC,
      bodyA: rail1Handle,
      bodyB: platformHandle,
      anchorA: { position: { x: 0, y: 0, z: 0.5 } },
      anchorB: { position: { x: 0, y: 0, z: 0 } },
      axis: { x: 0, y: 1, z: 0 }, // Slide along Y axis
      limits: { min: -4, max: 4 }, // 4 units up/down
      collideConnected: false,
    });
    this.joints.push(joint);

    // Store platform handle for animation in update loop
    this.elevatorPlatform = platformHandle;
  }

  /**
   * Ragdoll arm demo - SPHERICAL joints (ball-and-socket)
   */
  private createRagdollArmDemo(x: number, y: number, z: number): void {
    if (!this.physicsWorld) return;

    // Create shoulder anchor
    const shoulderHandle = this.physicsWorld.createRigidBody({
      type: RigidBodyType.STATIC,
      position: { x, y, z },
      collisionShape: {
        type: CollisionShapeType.SPHERE,
        radius: 0.3,
      },
    });
    this.createBodyEntity(shoulderHandle, 'sphere', { x: 0.6, y: 0.6, z: 0.6 }, [0.5, 0.5, 0.5]);

    // Create upper arm
    const upperArmLength = 2.0;
    const upperArmHandle = this.physicsWorld.createRigidBody({
      type: RigidBodyType.DYNAMIC,
      position: { x, y: y - upperArmLength / 2, z },
      collisionShape: {
        type: CollisionShapeType.BOX,
        halfExtents: { x: 0.25, y: upperArmLength / 2, z: 0.25 },
      },
      mass: 0.8,
      friction: 0.5,
      restitution: 0.1,
    });
    this.createBodyEntity(upperArmHandle, 'cube', { x: 0.5, y: upperArmLength, z: 0.5 }, [0.9, 0.7, 0.6]);

    // Shoulder joint (spherical - full rotation)
    const shoulderJoint = this.physicsWorld.createJoint({
      type: JointType.SPHERICAL,
      bodyA: shoulderHandle,
      bodyB: upperArmHandle,
      anchorA: { position: { x: 0, y: 0, z: 0 } },
      anchorB: { position: { x: 0, y: upperArmLength / 2, z: 0 } },
      collideConnected: false,
    });
    this.joints.push(shoulderJoint);

    // Create forearm
    const forearmLength = 1.8;
    const forearmHandle = this.physicsWorld.createRigidBody({
      type: RigidBodyType.DYNAMIC,
      position: { x, y: y - upperArmLength - forearmLength / 2, z },
      collisionShape: {
        type: CollisionShapeType.BOX,
        halfExtents: { x: 0.2, y: forearmLength / 2, z: 0.2 },
      },
      mass: 0.5,
      friction: 0.5,
      restitution: 0.1,
    });
    this.createBodyEntity(forearmHandle, 'cube', { x: 0.4, y: forearmLength, z: 0.4 }, [0.9, 0.7, 0.6]);

    // Elbow joint (revolute - hinge)
    const elbowJoint = this.physicsWorld.createJoint({
      type: JointType.REVOLUTE,
      bodyA: upperArmHandle,
      bodyB: forearmHandle,
      anchorA: { position: { x: 0, y: -upperArmLength / 2, z: 0 } },
      anchorB: { position: { x: 0, y: forearmLength / 2, z: 0 } },
      axis: { x: 1, y: 0, z: 0 }, // Bend in one plane
      limits: { min: -Math.PI * 0.8, max: 0 }, // Can only bend forward
      collideConnected: false,
    });
    this.joints.push(elbowJoint);

    // Create hand
    const handHandle = this.physicsWorld.createRigidBody({
      type: RigidBodyType.DYNAMIC,
      position: { x, y: y - upperArmLength - forearmLength - 0.3, z },
      collisionShape: {
        type: CollisionShapeType.SPHERE,
        radius: 0.3,
      },
      mass: 0.2,
      friction: 0.6,
      restitution: 0.2,
    });
    this.createBodyEntity(handHandle, 'sphere', { x: 0.6, y: 0.6, z: 0.6 }, [0.9, 0.6, 0.5]);

    // Wrist joint (spherical)
    const wristJoint = this.physicsWorld.createJoint({
      type: JointType.SPHERICAL,
      bodyA: forearmHandle,
      bodyB: handHandle,
      anchorA: { position: { x: 0, y: -forearmLength / 2, z: 0 } },
      anchorB: { position: { x: 0, y: 0.3, z: 0 } },
      collideConnected: false,
    });
    this.joints.push(wristJoint);

    // Give the arm a push
    this.physicsWorld.applyImpulse(handHandle, { x: 5, y: 0, z: 3 });
  }

  /**
   * Motor demo - Powered REVOLUTE joint
   */
  private createMotorDemo(x: number, y: number, z: number): void {
    if (!this.physicsWorld) return;

    // Create motor housing
    const housingHandle = this.physicsWorld.createRigidBody({
      type: RigidBodyType.STATIC,
      position: { x, y, z },
      collisionShape: {
        type: CollisionShapeType.BOX,
        halfExtents: { x: 0.5, y: 0.5, z: 0.5 },
      },
    });
    this.createBodyEntity(housingHandle, 'cube', { x: 1, y: 1, z: 1 }, [0.3, 0.3, 0.3]);

    // Create rotating shaft
    const shaftHandle = this.physicsWorld.createRigidBody({
      type: RigidBodyType.DYNAMIC,
      position: { x, y, z },
      collisionShape: {
        type: CollisionShapeType.BOX,
        halfExtents: { x: 2, y: 0.2, z: 0.2 },
      },
      mass: 1.0,
      friction: 0.3,
      restitution: 0.1,
    });
    this.createBodyEntity(shaftHandle, 'cube', { x: 4, y: 0.4, z: 0.4 }, [0.9, 0.1, 0.1]);

    // Create powered revolute joint (motor)
    this.motorJoint = this.physicsWorld.createJoint({
      type: JointType.REVOLUTE,
      bodyA: housingHandle,
      bodyB: shaftHandle,
      anchorA: { position: { x: 0, y: 0, z: 0 } },
      anchorB: { position: { x: 0, y: 0, z: 0 } },
      axis: { x: 0, y: 1, z: 0 }, // Rotate around Y axis
      motor: {
        targetVelocity: this.motorSpeed,
        maxForce: 10.0,
      },
      collideConnected: false,
    });
    this.joints.push(this.motorJoint);

    // Add weight at the end to show motor power
    const weight1Handle = this.physicsWorld.createRigidBody({
      type: RigidBodyType.DYNAMIC,
      position: { x: x + 2, y, z },
      collisionShape: {
        type: CollisionShapeType.SPHERE,
        radius: 0.5,
      },
      mass: 2.0,
      friction: 0.5,
      restitution: 0.2,
    });
    this.createBodyEntity(weight1Handle, 'sphere', { x: 1, y: 1, z: 1 }, [0.1, 0.9, 0.1]);

    const weightJoint1 = this.physicsWorld.createJoint({
      type: JointType.FIXED,
      bodyA: shaftHandle,
      bodyB: weight1Handle,
      anchorA: { position: { x: 2, y: 0, z: 0 } },
      anchorB: { position: { x: 0, y: 0, z: 0 } },
      collideConnected: false,
    });
    this.joints.push(weightJoint1);

    // Add counterweight
    const weight2Handle = this.physicsWorld.createRigidBody({
      type: RigidBodyType.DYNAMIC,
      position: { x: x - 2, y, z },
      collisionShape: {
        type: CollisionShapeType.SPHERE,
        radius: 0.5,
      },
      mass: 2.0,
      friction: 0.5,
      restitution: 0.2,
    });
    this.createBodyEntity(weight2Handle, 'sphere', { x: 1, y: 1, z: 1 }, [0.1, 0.1, 0.9]);

    const weightJoint2 = this.physicsWorld.createJoint({
      type: JointType.FIXED,
      bodyA: shaftHandle,
      bodyB: weight2Handle,
      anchorA: { position: { x: -2, y: 0, z: 0 } },
      anchorB: { position: { x: 0, y: 0, z: 0 } },
      collideConnected: false,
    });
    this.joints.push(weightJoint2);
  }

  start(): void {
    if (!this.backend) {
      console.error('Backend not initialized');
      return;
    }

    console.log('Starting joints demo render loop...');
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
    this.canvas.addEventListener('webglcontextlost', (event) => {
      console.warn('WebGL context lost.');
      event.preventDefault();
      this.stop();
    }, false);

    this.canvas.addEventListener('webglcontextrestored', async () => {
      console.log('WebGL context restored. Re-initializing...');
      try {
        const config: RendererConfig = {
          backend: RenderBackend.WEBGL2,
          canvas: this.canvas,
          width: this.canvas.width,
          height: this.canvas.height,
          antialias: true,
          alpha: false,
        };
        this.renderer = new Renderer(config);
        await this.createShaders();
        this.createGeometry();
        this.start();
      } catch (error) {
        console.error('Failed to restore renderer:', error);
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
    if (!this.backend || !this.cameraEntity || !this.physicsWorld) return;

    const now = performance.now();
    const deltaTime = this.lastTime ? (now - this.lastTime) / 1000 : 0;
    this.lastTime = now;

    // Step physics
    if (deltaTime > 0) {
      this.physicsWorld.step(deltaTime);

      // Apply oscillating force to elevator platform
      if (this.elevatorPlatform) {
        this.elevatorTime += deltaTime;
        const force = Math.sin(this.elevatorTime * 0.8) * 80; // Medium speed, stronger force
        this.physicsWorld.applyForce(this.elevatorPlatform, { x: 0, y: force, z: 0 });
      }
    }

    // Sync physics body transforms to ECS Transform components
    if (this.physicsWorld) {
      const query = this.world.query().with(Transform).with(JointBodyEntity).build();
      for (const { components } of this.world.executeQuery(query)) {
        const transform = components.get(Transform);
        const bodyEntity = components.get(JointBodyEntity);
        if (transform && bodyEntity) {
          try {
            const physicsPos = this.physicsWorld.getPosition(bodyEntity.bodyHandle);
            const physicsRot = this.physicsWorld.getRotation(bodyEntity.bodyHandle);

            // Update Transform component with physics data
            transform.x = physicsPos.x;
            transform.y = physicsPos.y;
            transform.z = physicsPos.z;
            transform.rotationX = physicsRot.x;
            transform.rotationY = physicsRot.y;
            transform.rotationZ = physicsRot.z;
            transform.rotationW = physicsRot.w;
          } catch (error) {
            // Physics body was removed but entity still exists (race condition during removal)
            // Skip this entity - it will be cleaned up on next frame
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
    if (!viewMatrix || !projMatrix) return;

    this.renderQueue.setCamera({
      position: new Float32Array([cameraTransform.x, cameraTransform.y, cameraTransform.z]),
      viewMatrix,
      projectionMatrix: projMatrix,
    });

    // Clear render queue for this frame
    this.renderQueue.clear();

    let drawCalls = 0;

    // Submit draw commands for all bodies using ECS query
    const bodyQuery = this.world.query().with(Transform).with(JointBodyEntity).build();
    const bodyEntities = this.world.executeQuery(bodyQuery);

    if (this.physicsWorld && bodyEntities.length > 0) {
      for (const { components } of bodyEntities) {
        const transform = components.get(Transform);
        const bodyEntity = components.get(JointBodyEntity);
        if (!transform || !bodyEntity) continue;

        const position = this.physicsWorld.getPosition(bodyEntity.bodyHandle);
        const rotation = this.physicsWorld.getRotation(bodyEntity.bodyHandle);

        // Get scale and color from component
        const scale = { x: bodyEntity.scaleX, y: bodyEntity.scaleY, z: bodyEntity.scaleZ };
        const color = [bodyEntity.colorR, bodyEntity.colorG, bodyEntity.colorB];
        const renderType = bodyEntity.renderType === 0 ? 'cube' : 'sphere';

        // Create model matrix with scale
        const modelMatrix = this.createModelMatrix(position, rotation, scale);
        const mvpMatrix = this.multiplyMatrices(viewProjMatrix, modelMatrix);

        // Select appropriate buffers based on render type
        const useCube = renderType === 'cube';
        const vertexBufferId = useCube ? this.cubeVertexBufferId : this.sphereVertexBufferId;
        const normalBufferId = useCube ? this.cubeNormalBufferId : this.sphereNormalBufferId;
        const indexBufferId = useCube ? this.cubeIndexBufferId : this.sphereIndexBufferId;
        const indexCount = useCube ? this.cubeIndexCount : this.sphereIndexCount;

        // Create draw command
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
                location: 0,
                format: 'float32x3',
                offset: 0,
                stride: 12,
                bufferId: vertexBufferId,
              },
              {
                name: 'aNormal',
                location: 1,
                format: 'float32x3',
                offset: 0,
                stride: 12,
                bufferId: normalBufferId,
              },
            ],
          },
          uniforms: new Map([
            ['uModelViewProjection', { name: 'uModelViewProjection', type: 'mat4', value: mvpMatrix }],
            ['uModel', { name: 'uModel', type: 'mat4', value: modelMatrix }],
            ['uNormalMatrix', { name: 'uNormalMatrix', type: 'mat3', value: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]) }],
            ['uLightDir', { name: 'uLightDir', type: 'vec3', value: new Float32Array([0.5, 1.0, 0.5]) }],
            ['uCameraPos', { name: 'uCameraPos', type: 'vec3', value: new Float32Array([cameraTransform.x, cameraTransform.y, cameraTransform.z]) }],
            ['uBaseColor', { name: 'uBaseColor', type: 'vec3', value: new Float32Array([color[0], color[1], color[2]]) }],
          ]),
          state: {
            blendMode: 'none',
            depthTest: 'less',
            depthWrite: true,
            cullMode: 'back',
          },
        };

        // Submit to render queue
        this.renderQueue.submit({
          drawCommand: drawCmd,
          materialId: `joint-body-${renderType}`,
          worldMatrix: modelMatrix,
          depth: 0,
          sortKey: 0,
        });

        drawCalls++;
      }
    }

    // Sort and execute render queue
    this.renderQueue.sort();
    const queuedCommands = this.renderQueue.getCommands();
    const renderCommands = queuedCommands.map(qc => qc.drawCommand);

    // Begin frame
    this.backend.beginFrame();
    this.backend.clear([0.1, 0.15, 0.2, 1.0], 1.0);

    // Execute all render commands
    this.backend.executeCommands(renderCommands);

    // End frame
    this.backend.endFrame();

    // Update FPS
    this.frameCount++;
    if (now - this.lastFpsUpdate >= 1000) {
      const fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsUpdate));
      const avgTrianglesPerBody = ((this.cubeIndexCount / 3) + (this.sphereIndexCount / 3)) / 2;
      const triangles = Math.round(avgTrianglesPerBody * drawCalls);

      // Count bodies using ECS query
      const bodyQuery = this.world.query().with(JointBodyEntity).build();
      const bodyCount = Array.from(this.world.executeQuery(bodyQuery)).length;

      this.updateStats(fps, drawCalls, triangles, bodyCount, this.joints.length);
      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }

    this.animationId = requestAnimationFrame(this.renderLoop);
  };

  private createModelMatrix(
    position: { x: number; y: number; z: number },
    rotation: { x: number; y: number; z: number; w: number },
    scale: { x: number; y: number; z: number }
  ): Float32Array {
    // Convert quaternion to rotation matrix
    const x = rotation.x, y = rotation.y, z = rotation.z, w = rotation.w;
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2;
    const yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;

    // Apply scale to rotation matrix
    return new Float32Array([
      (1 - (yy + zz)) * scale.x, (xy + wz) * scale.x,       (xz - wy) * scale.x,       0,
      (xy - wz) * scale.y,       (1 - (xx + zz)) * scale.y, (yz + wx) * scale.y,       0,
      (xz + wy) * scale.z,       (yz - wx) * scale.z,       (1 - (xx + yy)) * scale.z, 0,
      position.x,                position.y,                position.z,                1,
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

  /**
   * Render debug visualization lines for joints
   * Shows constraint connections (yellow) and axes (cyan)
   */
  private renderJointDebugLines(gl: WebGL2RenderingContext, viewProjMatrix: Float32Array): void {
    if (!this.physicsWorld) return;

    // Save current WebGL state
    const prevDepthTest = gl.getParameter(gl.DEPTH_TEST);
    const prevBlend = gl.getParameter(gl.BLEND);

    // Enable additive blending for bright debug lines
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.disable(gl.DEPTH_TEST); // Always show debug lines on top

    // Collect all line vertices and colors
    const lineVertices: number[] = [];
    const lineColors: number[] = [];

    for (const jointHandle of this.joints) {
      const debugInfo = this.physicsWorld.getJointDebugInfo(jointHandle);
      if (!debugInfo) continue;

      // Draw constraint line (yellow) from anchorA to anchorB
      lineVertices.push(
        debugInfo.anchorA.x, debugInfo.anchorA.y, debugInfo.anchorA.z,
        debugInfo.anchorB.x, debugInfo.anchorB.y, debugInfo.anchorB.z
      );
      lineColors.push(
        1.0, 1.0, 0.0, 1.0, // Yellow
        1.0, 1.0, 0.0, 1.0
      );

      // Draw axis line (cyan) if available (revolute/prismatic)
      if (debugInfo.axis) {
        const axisLength = 0.5; // Half meter axis visualization
        const axisEnd = {
          x: debugInfo.anchorA.x + debugInfo.axis.x * axisLength,
          y: debugInfo.anchorA.y + debugInfo.axis.y * axisLength,
          z: debugInfo.anchorA.z + debugInfo.axis.z * axisLength
        };

        lineVertices.push(
          debugInfo.anchorA.x, debugInfo.anchorA.y, debugInfo.anchorA.z,
          axisEnd.x, axisEnd.y, axisEnd.z
        );
        lineColors.push(
          0.0, 1.0, 1.0, 1.0, // Cyan
          0.0, 1.0, 1.0, 1.0
        );
      }
    }

    if (lineVertices.length === 0) {
      // Restore WebGL state
      if (!prevDepthTest) gl.disable(gl.DEPTH_TEST);
      if (!prevBlend) gl.disable(gl.BLEND);
      return;
    }

    // Create simple line shader inline (no need for shader manager)
    const lineProgram = this.getOrCreateLineShader(gl);
    if (!lineProgram) {
      if (!prevDepthTest) gl.disable(gl.DEPTH_TEST);
      if (!prevBlend) gl.disable(gl.BLEND);
      return;
    }

    gl.useProgram(lineProgram);

    // Set MVP matrix
    const mvpLoc = gl.getUniformLocation(lineProgram, 'uMVP');
    gl.uniformMatrix4fv(mvpLoc, false, viewProjMatrix);

    // Reuse or create buffers
    const vertexCount = lineVertices.length / 3;

    // Initialize buffers if not created
    if (!this.debugLineBuffers.vertex) {
      this.debugLineBuffers.vertex = gl.createBuffer();
      this.debugLineBuffers.color = gl.createBuffer();
      this.debugLineBuffers.maxVertices = 0;
    }

    // Reallocate if we need more space (with 50% growth for amortization)
    const vertexData = new Float32Array(lineVertices);
    const colorData = new Float32Array(lineColors);

    if (vertexCount > this.debugLineBuffers.maxVertices) {
      this.debugLineBuffers.maxVertices = Math.ceil(vertexCount * 1.5);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.debugLineBuffers.vertex);
      gl.bufferData(gl.ARRAY_BUFFER, this.debugLineBuffers.maxVertices * 3 * 4, gl.DYNAMIC_DRAW);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.debugLineBuffers.color);
      gl.bufferData(gl.ARRAY_BUFFER, this.debugLineBuffers.maxVertices * 4 * 4, gl.DYNAMIC_DRAW);
    }

    // Upload vertex data using bufferSubData (faster than bufferData)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.debugLineBuffers.vertex);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, vertexData);
    const posLoc = gl.getAttribLocation(lineProgram, 'aPosition');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);

    // Upload color data using bufferSubData
    gl.bindBuffer(gl.ARRAY_BUFFER, this.debugLineBuffers.color);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, colorData);
    const colorLoc = gl.getAttribLocation(lineProgram, 'aColor');
    gl.enableVertexAttribArray(colorLoc);
    gl.vertexAttribPointer(colorLoc, 4, gl.FLOAT, false, 0, 0);

    // Draw lines
    gl.lineWidth(2.0); // May not work on all platforms, but worth trying
    gl.drawArrays(gl.LINES, 0, vertexCount);

    // Cleanup attribute arrays (but keep buffers)
    gl.disableVertexAttribArray(posLoc);
    gl.disableVertexAttribArray(colorLoc);

    // Restore WebGL state
    if (!prevDepthTest) gl.disable(gl.DEPTH_TEST);
    if (!prevBlend) gl.disable(gl.BLEND);
  }

  private lineShader: WebGLProgram | null = null;
  private debugLineBuffers: {
    vertex: WebGLBuffer | null;
    color: WebGLBuffer | null;
    maxVertices: number;
  } = {
    vertex: null,
    color: null,
    maxVertices: 0
  };

  /**
   * Get or create a simple line shader for debug visualization
   */
  private getOrCreateLineShader(gl: WebGL2RenderingContext): WebGLProgram | null {
    if (this.lineShader) return this.lineShader;

    const vertexShaderSource = `#version 300 es
      in vec3 aPosition;
      in vec4 aColor;
      uniform mat4 uMVP;
      out vec4 vColor;

      void main() {
        gl_Position = uMVP * vec4(aPosition, 1.0);
        vColor = aColor;
      }
    `;

    const fragmentShaderSource = `#version 300 es
      precision mediump float;
      in vec4 vColor;
      out vec4 fragColor;

      void main() {
        fragColor = vColor;
      }
    `;

    // Compile vertex shader
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    if (!vertexShader) return null;
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      console.error('Line vertex shader compile error:', gl.getShaderInfoLog(vertexShader));
      return null;
    }

    // Compile fragment shader
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    if (!fragmentShader) return null;
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      console.error('Line fragment shader compile error:', gl.getShaderInfoLog(fragmentShader));
      return null;
    }

    // Link program
    const program = gl.createProgram();
    if (!program) return null;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Line shader link error:', gl.getProgramInfoLog(program));
      return null;
    }

    this.lineShader = program;
    return program;
  }

  private updateStats(fps: number, drawCalls: number, triangles: number, bodies: number, joints: number): void {
    const fpsEl = document.getElementById('fps');
    const drawCallsEl = document.getElementById('draw-calls');
    const trianglesEl = document.getElementById('triangles');
    const bodiesEl = document.getElementById('bodies');
    const jointsEl = document.getElementById('joints');

    if (fpsEl) fpsEl.textContent = fps.toString();
    if (drawCallsEl) drawCallsEl.textContent = drawCalls.toString();
    if (trianglesEl) trianglesEl.textContent = triangles.toString();
    if (bodiesEl) bodiesEl.textContent = bodies.toString();
    if (jointsEl) jointsEl.textContent = joints.toString();
  }

  // Public API for controlling motor
  public setMotorSpeed(speed: number): void {
    this.motorSpeed = speed;
    if (this.physicsWorld && this.motorJoint !== null) {
      this.physicsWorld.setJointMotor(this.motorJoint, {
        targetVelocity: speed,
        maxForce: 10.0,
      });
    }
  }

  public getMotorSpeed(): number {
    return this.motorSpeed;
  }

  dispose(): void {
    this.stop();

    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }

    // ECS camera cleanup (entities managed by World)
    this.cameraEntity = null;
    this.orbitController = null;

    if (this.physicsWorld) {
      this.physicsWorld.dispose();
      this.physicsWorld = null;
    }

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }

    // Bodies are managed by ECS World, no manual cleanup needed
    this.joints = [];
  }
}
