/**
 * Model Viewer - Static 3D model inspection tool (Epic 3.6)
 * Validates retro rendering pipeline with real-world models
 */

import {
  BackendFactory,
  OrbitCameraController,
  CameraSystem,
  loadOBJ,
  createPlane,
  RetroLightingSystem,
  RetroPostProcessor,
  type RetroLight,
  type IRendererBackend,
  type BackendShaderHandle,
  type BackendBufferHandle,
  type BackendBindGroupHandle,
  type BackendBindGroupLayoutHandle,
  type BackendPipelineHandle,
  type GeometryData,
  OPAQUE_PIPELINE_STATE,
} from '../../rendering/src';
import { World, TransformSystem, Transform, Camera, type EntityId } from '../../ecs/src';
import * as Mat4 from '../../ecs/src/math/Mat4';

export class ModelViewer {
  // Constants
  private static readonly VERTEX_STRIDE = 48; // position (3) + normal (3) + uv (2) + color (4) = 12 floats = 48 bytes
  private static readonly CAMERA_UNIFORM_FLOATS = 20; // mat4 viewProj (16) + vec3 position (3) + padding (1)

  // Canvas and backend
  private canvas: HTMLCanvasElement;
  private backend: IRendererBackend | null = null;
  private animationId: number | null = null;
  private resizeHandler: (() => void) | null = null;

  // ECS World and Systems
  private world: World;
  private transformSystem: TransformSystem;
  private cameraSystem: CameraSystem;

  // Camera
  private cameraEntity: EntityId | null = null;
  private orbitController: OrbitCameraController | null = null;

  // Retro rendering
  private retroLighting!: RetroLightingSystem;
  public retroPostProcessor!: RetroPostProcessor;
  private lightBindGroupLayout!: BackendBindGroupLayoutHandle;
  private lightBindGroup!: BackendBindGroupHandle;
  private materialBindGroupLayout!: BackendBindGroupLayoutHandle;
  private materialBindGroup!: BackendBindGroupHandle;
  private materialBuffer!: BackendBufferHandle;
  private dummyTexture!: any;
  private dummySampler!: any;

  // Shader and pipeline
  private modelShader!: BackendShaderHandle;
  private bindGroupLayout!: BackendBindGroupLayoutHandle;
  private sharedUniformBuffer!: BackendBufferHandle;
  private sharedBindGroup!: BackendBindGroupHandle;
  private modelPipeline!: BackendPipelineHandle;

  // Model geometry
  private modelVertexBuffer!: BackendBufferHandle;
  private modelIndexBuffer!: BackendBufferHandle;
  private modelIndexCount: number = 0;
  private modelVertexCount: number = 0;

  // Ground plane
  private groundVertexBuffer!: BackendBufferHandle;
  private groundIndexBuffer!: BackendBufferHandle;
  private groundIndexCount: number = 0;

  // Stats
  private frameCount: number = 0;
  private lastFpsUpdate: number = 0;
  private lastFrameTime: number = 0;
  private frameTimeHistory: number[] = [];
  private startTime: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    // Initialize ECS World
    this.world = new World();

    // Initialize and register ECS Systems
    this.transformSystem = new TransformSystem(this.world);
    this.world.registerSystem(this.transformSystem);

    // CameraSystem is a utility class
    this.cameraSystem = new CameraSystem(this.world);
  }

  async initialize(): Promise<boolean> {
    try {
      console.log('Initializing Model Viewer...');

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
        depthFormat: 'depth16unorm',
        powerPreference: 'high-performance',
      });
      console.log(`Using backend: ${this.backend.name}`);

      // Initialize retro rendering systems
      this.retroLighting = new RetroLightingSystem(this.backend, {
        maxLights: 4,
        enableVertexColors: true,
        enableLightmaps: false,
        enableFog: false,
      });

      // Setup directional light
      const retroLights: RetroLight[] = [
        {
          type: 'directional',
          position: [0, 10, 0],
          color: [1.0, 0.95, 0.9],
          intensity: 1.2,
          direction: [0.5, -1.0, -0.5],
        },
      ];
      this.retroLighting.setLights(retroLights);

      // Resize backend to match canvas
      this.backend.resize(this.canvas.width, this.canvas.height);

      // Create camera entity
      this.cameraEntity = this.world.createEntity();
      this.world.addComponent(this.cameraEntity, Transform, new Transform(0, 5, 10));
      this.world.addComponent(this.cameraEntity, Camera, Camera.perspective(
        (45 * Math.PI) / 180,
        1.0,
        100
      ));

      // Create orbit controller
      this.orbitController = new OrbitCameraController(this.cameraEntity, this.world, 10);
      this.orbitController.setTarget(0, 0, 0);

      // Setup camera controls
      this.setupCameraControls();

      // Load shaders
      await this.createShaders();

      // Load model
      await this.loadModel();

      // Create ground plane
      this.createGroundPlane();

      console.log('Model Viewer initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize Model Viewer:', error);
      return false;
    }
  }

  private async createShaders(): Promise<void> {
    if (!this.backend) return;

    console.log('Loading simple-lambert shader (non-instanced)...');
    const wgslSource = await import('../../rendering/src/retro/shaders/simple-lambert.wgsl?raw').then(m => m.default);

    this.modelShader = this.backend.createShader('model-shader', {
      vertex: wgslSource,
      fragment: wgslSource,
    });

    console.log('Shader compiled successfully');
  }

  private async loadModel(): Promise<void> {
    if (!this.backend) return;

    console.log('Loading model...');

    let modelData: GeometryData;
    try {
      // Try to load Naked Snake model
      modelData = await loadOBJ('/models/Naked Snake/Naked_Snake.obj');
      console.log('Loaded Naked Snake model');
    } catch (error) {
      console.warn('Failed to load model, using fallback sphere:', error);
      // Fallback to generated sphere
      const { createSphere } = await import('../../rendering/src/Geometry');
      modelData = createSphere(2.0, 32, 24);
    }

    // Store stats
    this.modelVertexCount = modelData.positions.length / 3;
    this.modelIndexCount = modelData.indices.length;

    console.log(`Model: ${this.modelVertexCount} vertices, ${this.modelIndexCount / 3} triangles`);

    // Interleave vertex data (position, normal, uv)
    const interleavedData = this.interleaveVertexData(modelData);

    // Create GPU buffers
    this.modelVertexBuffer = this.backend.createBuffer(
      'model-vertices',
      'vertex',
      interleavedData,
      'static_draw'
    );
    this.modelIndexBuffer = this.backend.createBuffer(
      'model-indices',
      'index',
      modelData.indices,
      'static_draw'
    );

    // Create pipeline
    this.createPipeline();
  }

  private createGroundPlane(): void {
    if (!this.backend) return;

    const groundData = createPlane(20, 20, 4, 4);
    const interleavedData = this.interleaveVertexData(groundData);

    this.groundVertexBuffer = this.backend.createBuffer(
      'ground-vertices',
      'vertex',
      interleavedData,
      'static_draw'
    );
    this.groundIndexBuffer = this.backend.createBuffer(
      'ground-indices',
      'index',
      groundData.indices,
      'static_draw'
    );
    this.groundIndexCount = groundData.indices.length;
  }

  private interleaveVertexData(data: GeometryData): Float32Array {
    const vertexCount = data.positions.length / 3;
    const interleaved = new Float32Array(vertexCount * 12); // 12 floats per vertex (pos, normal, uv, color)

    for (let i = 0; i < vertexCount; i++) {
      const offset = i * 12;
      // Position
      interleaved[offset + 0] = data.positions[i * 3 + 0];
      interleaved[offset + 1] = data.positions[i * 3 + 1];
      interleaved[offset + 2] = data.positions[i * 3 + 2];
      // Normal
      interleaved[offset + 3] = data.normals[i * 3 + 0];
      interleaved[offset + 4] = data.normals[i * 3 + 1];
      interleaved[offset + 5] = data.normals[i * 3 + 2];
      // UV
      interleaved[offset + 6] = data.uvs[i * 2 + 0];
      interleaved[offset + 7] = data.uvs[i * 2 + 1];
      // Vertex color (default white ambient)
      interleaved[offset + 8] = 0.2;  // R - ambient
      interleaved[offset + 9] = 0.2;  // G - ambient
      interleaved[offset + 10] = 0.2; // B - ambient
      interleaved[offset + 11] = 1.0; // A
    }

    return interleaved;
  }

  private createPipeline(): void {
    if (!this.backend) return;

    // Create bind group layout for camera uniforms (@group(0))
    this.bindGroupLayout = this.backend.createBindGroupLayout('camera-layout', [
      {
        binding: 0,
        visibility: 'vertex',
        type: 'buffer',
        bufferType: 'uniform',
      },
    ]);

    // Create uniform buffer for camera
    const uniformData = new Float32Array(ModelViewer.CAMERA_UNIFORM_FLOATS);
    this.sharedUniformBuffer = this.backend.createBuffer(
      'camera-uniform',
      'uniform',
      uniformData,
      'dynamic_draw'
    );

    // Create bind group for camera (@group(0))
    this.sharedBindGroup = this.backend.createBindGroup('camera-bind-group', this.bindGroupLayout, [
      {
        binding: 0,
        resource: this.sharedUniformBuffer,
      },
    ]);

    // Create material bind group layout (@group(1))
    this.materialBindGroupLayout = this.backend.createBindGroupLayout('material-layout', [
      { binding: 0, visibility: 'fragment', type: 'texture', textureType: '2d' },
      { binding: 1, visibility: 'fragment', type: 'sampler' },
      { binding: 2, visibility: 'fragment', type: 'buffer', bufferType: 'uniform' },
    ]);

    // Create dummy 1x1 white texture
    this.dummyTexture = this.backend.createTexture('dummy-texture', {
      width: 1,
      height: 1,
      format: 'rgba8unorm',
      usage: 'texture_binding',
    });
    const whitePixel = new Uint8Array([255, 255, 255, 255]);
    this.backend.updateTexture(this.dummyTexture, whitePixel, 1, 1);

    // Create sampler
    this.dummySampler = this.backend.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
    });

    // Create material uniform buffer
    const materialData = new Float32Array(8); // vec4 albedo + vec4 padding
    materialData[0] = 1.0; // R
    materialData[1] = 1.0; // G
    materialData[2] = 1.0; // B
    materialData[3] = 1.0; // A
    this.materialBuffer = this.backend.createBuffer(
      'material-uniform',
      'uniform',
      materialData,
      'static_draw'
    );

    // Create material bind group (@group(1))
    this.materialBindGroup = this.backend.createBindGroup('material-bind-group', this.materialBindGroupLayout, [
      { binding: 0, resource: this.dummyTexture },
      { binding: 1, resource: this.dummySampler },
      { binding: 2, resource: this.materialBuffer },
    ]);

    // Get light bind group from RetroLightingSystem (@group(2))
    this.lightBindGroupLayout = this.retroLighting.getBindGroupLayout();
    this.lightBindGroup = this.retroLighting.getBindGroup();

    // Create pipeline
    this.modelPipeline = this.backend.createRenderPipeline({
      shader: this.modelShader,
      vertexBufferLayout: {
        stride: ModelViewer.VERTEX_STRIDE,
        attributes: [
          { location: 0, offset: 0, format: 'float32x3' },  // position
          { location: 1, offset: 12, format: 'float32x3' }, // normal
          { location: 2, offset: 24, format: 'float32x2' }, // uv
          { location: 3, offset: 32, format: 'float32x4' }, // color (ambient)
        ],
      },
      bindGroupLayouts: [this.bindGroupLayout, this.materialBindGroupLayout, this.lightBindGroupLayout],
      pipelineState: OPAQUE_PIPELINE_STATE,
    });
  }

  private setupCameraControls(): void {
    if (!this.orbitController) return;

    let isDragging = false;
    let lastX = 0;
    let lastY = 0;

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { // Left button
        isDragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
      }
    });

    this.canvas.addEventListener('mousemove', (e) => {
      if (isDragging && this.orbitController) {
        const deltaX = e.clientX - lastX;
        const deltaY = e.clientY - lastY;
        this.orbitController.rotate(deltaX * 0.01, deltaY * 0.01);
        lastX = e.clientX;
        lastY = e.clientY;
      }
    });

    this.canvas.addEventListener('mouseup', () => {
      isDragging = false;
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (this.orbitController) {
        this.orbitController.zoom(e.deltaY * 0.01);
      }
    });

    // Reset camera on 'R' key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'r' || e.key === 'R') {
        if (this.orbitController && this.cameraEntity) {
          this.orbitController = new OrbitCameraController(this.cameraEntity, this.world, 10);
          this.orbitController.setTarget(0, 0, 0);
          console.log('Camera reset');
        }
      }
    });
  }

  private resizeCanvas(): void {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.canvas.style.width = `${window.innerWidth}px`;
    this.canvas.style.height = `${window.innerHeight}px`;

    if (this.backend) {
      this.backend.resize(this.canvas.width, this.canvas.height);
    }
  }

  start(): void {
    this.startTime = performance.now();
    this.lastFpsUpdate = this.startTime;
    this.render();
  }

  private render = (): void => {
    if (!this.backend || !this.cameraEntity) return;

    const currentTime = performance.now();
    const deltaTime = (currentTime - this.lastFrameTime) / 1000;
    this.lastFrameTime = currentTime;

    // Update ECS systems
    this.world.update(deltaTime);
    this.transformSystem.update(this.world, deltaTime);

    // Update camera controller
    if (this.orbitController) {
      this.orbitController.update(deltaTime);
    }

    // Get camera matrices
    const cameraTransform = this.world.getComponent(this.cameraEntity, Transform);
    const cameraComponent = this.world.getComponent(this.cameraEntity, Camera);

    if (!cameraTransform || !cameraComponent) {
      this.animationId = requestAnimationFrame(this.render);
      return;
    }

    // Update camera uniform buffer
    const viewMatrix = Mat4.lookAt(
      cameraTransform.positionX, cameraTransform.positionY, cameraTransform.positionZ,
      0, 0, 0, // Look at origin
      0, 1, 0  // Up vector
    );

    const aspect = this.canvas.width / this.canvas.height;
    const projectionMatrix = cameraComponent.getProjectionMatrix(aspect);
    const viewProjectionMatrix = Mat4.multiply(projectionMatrix, viewMatrix);

    const uniformData = new Float32Array(ModelViewer.CAMERA_UNIFORM_FLOATS);
    uniformData.set(viewProjectionMatrix, 0);
    uniformData[16] = cameraTransform.positionX;
    uniformData[17] = cameraTransform.positionY;
    uniformData[18] = cameraTransform.positionZ;

    this.backend.updateBuffer(this.sharedUniformBuffer, uniformData);

    // Begin frame
    this.backend.beginFrame();

    // Bind pipeline and resources
    this.backend.bindPipeline(this.modelPipeline);
    this.backend.bindGroup(0, this.sharedBindGroup);     // Camera
    this.backend.bindGroup(1, this.materialBindGroup);   // Material
    this.backend.bindGroup(2, this.lightBindGroup);      // Lights

    // Draw ground plane
    this.backend.setVertexBuffer(this.groundVertexBuffer);
    this.backend.setIndexBuffer(this.groundIndexBuffer, 'uint16');
    this.backend.drawIndexed(this.groundIndexCount);

    // Draw model
    this.backend.setVertexBuffer(this.modelVertexBuffer);
    this.backend.setIndexBuffer(this.modelIndexBuffer,
      this.modelVertexCount > 65535 ? 'uint32' : 'uint16'
    );
    this.backend.drawIndexed(this.modelIndexCount);

    // End frame
    this.backend.endFrame();

    // Update FPS
    this.updateFPS(currentTime);

    this.animationId = requestAnimationFrame(this.render);
  };

  private updateFPS(currentTime: number): void {
    this.frameCount++;
    this.frameTimeHistory.push(currentTime - this.lastFrameTime);
    if (this.frameTimeHistory.length > 60) {
      this.frameTimeHistory.shift();
    }

    if (currentTime - this.lastFpsUpdate >= 500) {
      const fps = Math.round(this.frameCount / ((currentTime - this.lastFpsUpdate) / 1000));
      const avgFrameTime = this.frameTimeHistory.reduce((a, b) => a + b, 0) / this.frameTimeHistory.length;

      // Update UI
      const fpsEl = document.getElementById('fps-counter');
      if (fpsEl) {
        fpsEl.textContent = `${fps} FPS (${avgFrameTime.toFixed(2)}ms)`;
      }

      this.frameCount = 0;
      this.lastFpsUpdate = currentTime;
    }
  }

  stop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
    }

    if (this.backend) {
      this.backend.destroy();
      this.backend = null;
    }
  }
}
