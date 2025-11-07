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
  JointType,
  type RigidBodyHandle,
  type JointHandle,
} from '../../physics/src';

interface RenderableBody {
  handle: RigidBodyHandle;
  type: 'cube' | 'sphere';
  scale: { x: number; y: number; z: number };
  color: [number, number, number];
}

export class JointsDemo {
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
  private bodies: RenderableBody[] = [];
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

      // Create renderer config
      const config: RendererConfig = {
        backend: RenderBackend.WEBGL2,
        canvas: this.canvas,
        width: this.canvas.width,
        height: this.canvas.height,
        antialias: true,
        alpha: false,
      };

      // Initialize renderer
      this.renderer = new Renderer(config);

      // Create camera
      const aspect = this.canvas.width / this.canvas.height;
      this.camera = new Camera(45, aspect, 0.1, 200);
      this.camera.setPosition(0, 15, 30);
      this.camera.setTarget(0, 5, 0);

      // Setup orbit controls
      this.controls = new OrbitControls(this.camera, this.canvas);

      // Create shader program
      this.createShaders();

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
        vec3 N = normalize(vNormal);
        vec3 L = normalize(uLightDir);
        vec3 V = normalize(uCameraPos - vPosition);
        vec3 H = normalize(L + V);

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

    console.log('Shaders compiled successfully');
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
    this.bodies.push({
      handle: groundHandle,
      type: 'cube',
      scale: { x: 100, y: 1, z: 100 },
      color: [0.3, 0.3, 0.3],
    });

    // Create demonstrations
    this.createChainDemo(-15, 10, 0);
    this.createDoorDemo(-5, 0, -10);
    this.createPendulumDemo(5, 15, -10);
    this.createSliderDemo(15, 5, 0);
    this.createRagdollArmDemo(0, 8, 10);
    this.createMotorDemo(-10, 5, 10);

    console.log(`Physics initialized with ${this.bodies.length} bodies and ${this.joints.length} joints`);
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
    this.bodies.push({
      handle: anchorHandle,
      type: 'sphere',
      scale: { x: 0.6, y: 0.6, z: 0.6 },
      color: [0.5, 0.5, 0.5],
    });

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
      this.bodies.push({
        handle: linkHandle,
        type: 'cube',
        scale: { x: linkWidth, y: linkLength, z: linkWidth },
        color: [0.8, 0.4, 0.2],
      });

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
    this.bodies.push({
      handle: weightHandle,
      type: 'sphere',
      scale: { x: 1.0, y: 1.0, z: 1.0 },
      color: [0.9, 0.7, 0.1],
    });

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
    this.bodies.push({
      handle: frameHandle,
      type: 'cube',
      scale: { x: 0.4, y: 4, z: 0.4 },
      color: [0.4, 0.3, 0.2],
    });

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
    this.bodies.push({
      handle: doorHandle,
      type: 'cube',
      scale: { x: 3, y: 3.6, z: 0.2 },
      color: [0.6, 0.3, 0.1],
    });

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
    this.bodies.push({
      handle: anchorHandle,
      type: 'sphere',
      scale: { x: 0.4, y: 0.4, z: 0.4 },
      color: [0.5, 0.5, 0.5],
    });

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
    this.bodies.push({
      handle: rodHandle,
      type: 'cube',
      scale: { x: 0.2, y: rodLength, z: 0.2 },
      color: [0.7, 0.7, 0.7],
    });

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
    this.bodies.push({
      handle: weightHandle,
      type: 'sphere',
      scale: { x: 1.2, y: 1.2, z: 1.2 },
      color: [0.9, 0.1, 0.1],
    });

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
    this.bodies.push({
      handle: rail1Handle,
      type: 'cube',
      scale: { x: 0.2, y: 10, z: 0.2 },
      color: [1.0, 0.2, 0.2], // Bright red for visibility
    });

    const rail2Handle = this.physicsWorld.createRigidBody({
      type: RigidBodyType.STATIC,
      position: { x, y, z: z + 0.5 },
      collisionShape: {
        type: CollisionShapeType.BOX,
        halfExtents: { x: 0.1, y: 5, z: 0.1 },
      },
    });
    this.bodies.push({
      handle: rail2Handle,
      type: 'cube',
      scale: { x: 0.2, y: 10, z: 0.2 },
      color: [1.0, 0.2, 0.2], // Bright red for visibility
    });

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
    this.bodies.push({
      handle: platformHandle,
      type: 'cube',
      scale: { x: 1.6, y: 0.4, z: 1.6 },
      color: [1.0, 1.0, 0.0], // Bright yellow for high visibility
    });

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
    this.bodies.push({
      handle: shoulderHandle,
      type: 'sphere',
      scale: { x: 0.6, y: 0.6, z: 0.6 },
      color: [0.5, 0.5, 0.5],
    });

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
    this.bodies.push({
      handle: upperArmHandle,
      type: 'cube',
      scale: { x: 0.5, y: upperArmLength, z: 0.5 },
      color: [0.9, 0.7, 0.6],
    });

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
    this.bodies.push({
      handle: forearmHandle,
      type: 'cube',
      scale: { x: 0.4, y: forearmLength, z: 0.4 },
      color: [0.9, 0.7, 0.6],
    });

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
    this.bodies.push({
      handle: handHandle,
      type: 'sphere',
      scale: { x: 0.6, y: 0.6, z: 0.6 },
      color: [0.9, 0.6, 0.5],
    });

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
    this.bodies.push({
      handle: housingHandle,
      type: 'cube',
      scale: { x: 1, y: 1, z: 1 },
      color: [0.3, 0.3, 0.3],
    });

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
    this.bodies.push({
      handle: shaftHandle,
      type: 'cube',
      scale: { x: 4, y: 0.4, z: 0.4 },
      color: [0.9, 0.1, 0.1],
    });

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
    this.bodies.push({
      handle: weight1Handle,
      type: 'sphere',
      scale: { x: 1, y: 1, z: 1 },
      color: [0.1, 0.9, 0.1],
    });

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
    this.bodies.push({
      handle: weight2Handle,
      type: 'sphere',
      scale: { x: 1, y: 1, z: 1 },
      color: [0.1, 0.1, 0.9],
    });

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
    if (!this.renderer) {
      console.error('Renderer not initialized');
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
        this.createShaders();
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

  private renderLoop = (): void => {
    if (!this.renderer || !this.camera || !this.physicsWorld) return;

    const now = performance.now();
    const deltaTime = this.lastTime ? (now - this.lastTime) / 1000 : 0;
    this.lastTime = now;

    // Step physics
    if (deltaTime > 0) {
      this.physicsWorld.step(deltaTime);

      // Apply oscillating force to elevator platform
      if (this.elevatorPlatform) {
        this.elevatorTime += deltaTime;
        const force = Math.sin(this.elevatorTime * 0.5) * 50; // Slow oscillation
        this.physicsWorld.applyForce(this.elevatorPlatform, { x: 0, y: force, z: 0 });
      }
    }

    const gl = this.renderer.getContext().gl;
    const shaderManager = this.renderer.getShaderManager();
    const bufferManager = this.renderer.getBufferManager();

    // Clear
    gl.clearColor(0.1, 0.15, 0.2, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);

    // Get shader program
    const program = shaderManager.getProgram(this.shaderProgramId);
    if (!program) return;

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

    // Get buffers
    const cubeVertexBuffer = bufferManager.getBuffer(this.cubeVertexBufferId);
    const cubeNormalBuffer = bufferManager.getBuffer(this.cubeNormalBufferId);
    const cubeIndexBuffer = bufferManager.getBuffer(this.cubeIndexBufferId);
    const sphereVertexBuffer = bufferManager.getBuffer(this.sphereVertexBufferId);
    const sphereNormalBuffer = bufferManager.getBuffer(this.sphereNormalBufferId);
    const sphereIndexBuffer = bufferManager.getBuffer(this.sphereIndexBufferId);

    let drawCalls = 0;

    // Render all bodies
    for (const body of this.bodies) {
      const position = this.physicsWorld.getPosition(body.handle);
      const rotation = this.physicsWorld.getRotation(body.handle);

      // Create model matrix with scale
      const modelMatrix = this.createModelMatrix(position, rotation, body.scale);
      const mvpMatrix = this.multiplyMatrices(viewProjMatrix, modelMatrix);

      // Bind appropriate buffers
      if (body.type === 'cube' && cubeVertexBuffer && cubeNormalBuffer && cubeIndexBuffer) {
        gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexBuffer.buffer);
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, cubeNormalBuffer.buffer);
        gl.enableVertexAttribArray(normLoc);
        gl.vertexAttribPointer(normLoc, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeIndexBuffer.buffer);
      } else if (body.type === 'sphere' && sphereVertexBuffer && sphereNormalBuffer && sphereIndexBuffer) {
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

      // Set uniforms
      gl.uniformMatrix4fv(mvpLoc, false, mvpMatrix);
      gl.uniformMatrix4fv(modelLoc, false, modelMatrix);
      gl.uniformMatrix3fv(normalMatLoc, false, new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]));
      gl.uniform3f(baseColorLoc, body.color[0], body.color[1], body.color[2]);

      // Draw
      const indexCount = body.type === 'cube' ? this.cubeIndexCount : this.sphereIndexCount;
      gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0);
      drawCalls++;
    }

    // Update FPS
    this.frameCount++;
    if (now - this.lastFpsUpdate >= 1000) {
      const fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsUpdate));
      const avgTrianglesPerBody = ((this.cubeIndexCount / 3) + (this.sphereIndexCount / 3)) / 2;
      const triangles = Math.round(avgTrianglesPerBody * drawCalls);
      this.updateStats(fps, drawCalls, triangles, this.bodies.length, this.joints.length);
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

    if (this.controls) {
      this.controls.dispose();
      this.controls = null;
    }

    if (this.physicsWorld) {
      this.physicsWorld.dispose();
      this.physicsWorld = null;
    }

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }

    this.camera = null;
    this.bodies = [];
    this.joints = [];
  }
}
