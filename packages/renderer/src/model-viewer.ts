/**
 * Model Viewer - Static 3D model inspection tool (Epic 3.6)
 * Validates retro rendering pipeline with real-world models
 */

import {
  BackendFactory,
  OrbitCameraController,
  CameraSystem,
  loadOBJWithMaterials,
  loadOBJWithMaterialsFromContent,
  createPlane,
  createSphere,
  createCube,
  RetroLightingSystem,
  RetroPostProcessor,
  type RetroLight,
  type IRendererBackend,
  type BackendShaderHandle,
  type BackendBufferHandle,
  type BackendBindGroupHandle,
  type BackendBindGroupLayoutHandle,
  type BackendPipelineHandle,
  type BackendTextureHandle,
  type BackendSamplerHandle,
  type GeometryData,
  type DrawCommand,
  type ModelData,
  type MaterialGroup,
  OPAQUE_PIPELINE_STATE,
  WIREFRAME_PIPELINE_STATE,
} from '../../rendering/src';
import { World, TransformSystem, Transform, Camera, type EntityId } from '../../ecs/src';
import * as Mat4 from '../../ecs/src/math/Mat4';

export class ModelViewer {
  // Constants
  private static readonly VERTEX_STRIDE = 48; // position (3) + normal (3) + uv (2) + color (4) = 12 floats = 48 bytes
  private static readonly CAMERA_UNIFORM_FLOATS = 20; // mat4 viewProj (16) + vec3 position (3) + padding (1)
  private static readonly MATERIAL_UNIFORM_FLOATS = 8; // vec4 albedo + vec4 padding

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
  private dummyTexture!: BackendTextureHandle;
  private checkerboardTexture!: BackendTextureHandle;
  private dummySampler!: BackendSamplerHandle;

  // Shader and pipeline
  private modelShader!: BackendShaderHandle;
  private bindGroupLayout!: BackendBindGroupLayoutHandle;
  private sharedUniformBuffer!: BackendBufferHandle;
  private sharedBindGroup!: BackendBindGroupHandle;
  private modelPipeline!: BackendPipelineHandle;
  private wireframePipeline!: BackendPipelineHandle;
  private wireframeEnabled: boolean = false;

  // Model geometry (legacy single-material)
  private modelVertexBuffer!: BackendBufferHandle;
  private modelIndexBuffer!: BackendBufferHandle;
  private modelIndexCount: number = 0;
  private modelVertexCount: number = 0;
  private modelIndexFormat: 'uint16' | 'uint32' = 'uint16';

  // Multi-material support
  private materialGroups: {
    materialName: string;
    vertexBuffer: BackendBufferHandle;
    indexBuffer: BackendBufferHandle;
    indexCount: number;
    indexFormat: 'uint16' | 'uint32';
    texture: BackendTextureHandle;
    bindGroup: BackendBindGroupHandle;
  }[] = [];

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

  // Camera target (adjustable with Q/E keys)
  private targetY: number = 2;

  // Post-processing state
  private bloomEnabled: boolean = true;
  private bloomIntensity: number = 0.5;
  private crtEnabled: boolean = true;  // Match HTML checkbox default
  private grainAmount: number = 0.02;
  private lightIntensity: number = 1.2;

  // Light direction state (spherical coordinates)
  private lightAzimuth: number = Math.PI / 4;  // 45 degrees
  private lightElevation: number = Math.PI / 4; // 45 degrees

  // Event listener references for cleanup
  private mousedownHandler: ((e: MouseEvent) => void) | null = null;
  private mousemoveHandler: ((e: MouseEvent) => void) | null = null;
  private mouseupHandler: (() => void) | null = null;
  private wheelHandler: ((e: WheelEvent) => void) | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

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

      // Setup directional light using initial spherical coordinates
      this.updateLight();

      // Resize backend to match canvas
      this.backend.resize(this.canvas.width, this.canvas.height);

      // Create camera entity
      this.cameraEntity = this.world.createEntity();
      this.world.addComponent(this.cameraEntity, Transform, new Transform(0, 5, 10));
      this.world.addComponent(this.cameraEntity, Camera, Camera.perspective(
        (45 * Math.PI) / 180,
        1.0,
        500
      ));

      // Create orbit controller - target model center (slightly above ground)
      this.orbitController = new OrbitCameraController(this.cameraEntity, this.world, 10);
      this.orbitController.setTarget(0, this.targetY, 0);

      // Setup camera controls
      this.setupCameraControls();

      // Load shaders
      await this.createShaders();

      // Create pipeline and shared resources (only once)
      this.createPipeline();

      // Load model
      await this.loadModel();

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

    // Initialize retro post-processor (same as demo.ts)
    this.retroPostProcessor = new RetroPostProcessor(
      this.backend,
      {
        bloomThreshold: 0.8,
        bloomIntensity: this.bloomIntensity,
        bloomMipLevels: 5,
        grainAmount: this.grainAmount,
        gamma: 2.2,
        ditherPattern: 0,
        internalResolution: { width: 640, height: 480 },  // PS1-style fixed resolution
        crt: {
          enabled: this.crtEnabled,
          masterIntensity: 1.0,
          brightness: 0.0,
          contrast: 0.0,
          saturation: 1.0,
          scanlinesStrength: 0.50,
          beamWidthMin: 0.8,
          beamWidthMax: 1.0,
          beamShape: 0.7,
          maskIntensity: 0.30,
          maskType: 'aperture-grille',
          curvatureAmount: 0.03,
          vignetteAmount: 0.20,
          cornerRadius: 0.05,
          colorOverflow: 0.3,
        },
      }
    );
    this.retroPostProcessor.resize(this.canvas.width, this.canvas.height);
    console.log('Retro post-processor initialized');
  }

  private disposeModelResources(): void {
    if (!this.backend) return;

    // Dispose multi-material group resources
    for (const group of this.materialGroups) {
      this.backend.deleteBindGroup(group.bindGroup);
      this.backend.deleteBuffer(group.vertexBuffer);
      this.backend.deleteBuffer(group.indexBuffer);
      if (group.texture !== this.dummyTexture) {
        this.backend.deleteTexture(group.texture);
      }
    }
    this.materialGroups = [];

    // Dispose single-material model resources
    if (this.modelVertexBuffer) {
      this.backend.deleteBuffer(this.modelVertexBuffer);
      this.modelVertexBuffer = null as unknown as BackendBufferHandle;
    }
    if (this.modelIndexBuffer) {
      this.backend.deleteBuffer(this.modelIndexBuffer);
      this.modelIndexBuffer = null as unknown as BackendBufferHandle;
    }
  }

  private async loadModel(modelPath: string = '/models/Naked Snake/Naked_Snake.obj'): Promise<void> {
    if (!this.backend) return;

    console.log(`Loading model: ${modelPath}`);

    // Clean up previous model resources
    this.disposeModelResources();

    let modelData: ModelData | null = null;
    let simpleGeometry: GeometryData | null = null;

    try {
      if (modelPath === 'sphere') {
        simpleGeometry = createSphere(2.0, 32, 24);
        console.log('Generated sphere');
      } else if (modelPath === 'cube') {
        simpleGeometry = createCube(3.0);
        console.log('Generated cube');
      } else {
        // Load OBJ file with materials
        modelData = await loadOBJWithMaterials(modelPath);
        console.log(`Loaded model from ${modelPath}`);
        console.log(`  ${modelData.materialGroups.length} material groups`);
        console.log(`  ${modelData.materials.size} materials defined`);
      }
    } catch (error) {
      console.warn('Failed to load model, using fallback sphere:', error);
      simpleGeometry = createSphere(2.0, 32, 24);
    }

    if (modelData && modelData.materialGroups.length > 0) {
      // Multi-material model
      const basePath = modelPath.substring(0, modelPath.lastIndexOf('/') + 1);
      let totalVertices = 0;
      let totalTriangles = 0;

      for (const group of modelData.materialGroups) {
        const geometry = group.geometry;
        const indexCount = Math.floor(geometry.indices.length / 3) * 3;
        const vertexCount = geometry.positions.length / 3;

        totalVertices += vertexCount;
        totalTriangles += indexCount / 3;

        // Interleave vertex data
        const interleavedData = this.interleaveVertexData(geometry);

        // Create GPU buffers
        const vertexBuffer = this.backend.createBuffer(
          `vertices-${group.materialName}`,
          'vertex',
          interleavedData,
          'static_draw'
        );
        const indexBuffer = this.backend.createBuffer(
          `indices-${group.materialName}`,
          'index',
          geometry.indices,
          'static_draw'
        );

        // Determine index format from actual array type
        const indexFormat = geometry.indices instanceof Uint32Array ? 'uint32' : 'uint16';

        // Load texture for this material
        let texture = this.dummyTexture;
        const materialDef = modelData.materials.get(group.materialName);
        if (materialDef?.texturePath) {
          const textureUrl = basePath + materialDef.texturePath;
          try {
            texture = await this.loadTexture(textureUrl, group.materialName);
          } catch (error) {
            console.warn(`Failed to load texture ${materialDef.texturePath}:`, error);
            texture = this.checkerboardTexture; // Use checkerboard for failed textures
          }
        }

        // Create bind group for this material
        const bindGroup = this.backend.createBindGroup(this.materialBindGroupLayout, {
          bindings: [
            { binding: 0, resource: texture },
            { binding: 1, resource: this.dummySampler },
            { binding: 2, resource: this.materialBuffer },
          ],
        });

        this.materialGroups.push({
          materialName: group.materialName,
          vertexBuffer,
          indexBuffer,
          indexCount,
          indexFormat,
          texture,
          bindGroup,
        });
      }

      this.modelVertexCount = totalVertices;
      this.modelIndexCount = totalTriangles * 3;

      console.log(`Model: ${totalVertices} vertices, ${totalTriangles} triangles in ${this.materialGroups.length} groups`);
    } else if (simpleGeometry) {
      // Simple single-material geometry (sphere/cube/fallback)
      this.modelVertexCount = simpleGeometry.positions.length / 3;
      this.modelIndexCount = Math.floor(simpleGeometry.indices.length / 3) * 3;

      // Determine index format from actual array type
      this.modelIndexFormat = simpleGeometry.indices instanceof Uint32Array ? 'uint32' : 'uint16';

      const interleavedData = this.interleaveVertexData(simpleGeometry);

      this.modelVertexBuffer = this.backend.createBuffer(
        'model-vertices',
        'vertex',
        interleavedData,
        'static_draw'
      );
      this.modelIndexBuffer = this.backend.createBuffer(
        'model-indices',
        'index',
        simpleGeometry.indices,
        'static_draw'
      );

      console.log(`Model: ${this.modelVertexCount} vertices, ${this.modelIndexCount / 3} triangles`);
    }

    // Update UI with model stats
    this.updateModelStats();

    // Reset camera to default view for new model
    if (this.orbitController) {
      this.targetY = 2;
      this.orbitController.reset(10, 0, Math.PI / 6);
      this.orbitController.setTarget(0, this.targetY, 0);
    }
  }

  private async loadTexture(url: string, name: string): Promise<BackendTextureHandle> {
    if (!this.backend) throw new Error('Backend not initialized');

    const MAX_TEXTURE_SIZE = 256;

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        // Calculate resized dimensions (max 256px, maintain aspect ratio)
        let targetWidth = img.width;
        let targetHeight = img.height;

        if (img.width > MAX_TEXTURE_SIZE || img.height > MAX_TEXTURE_SIZE) {
          const scale = Math.min(MAX_TEXTURE_SIZE / img.width, MAX_TEXTURE_SIZE / img.height);
          targetWidth = Math.floor(img.width * scale);
          targetHeight = Math.floor(img.height * scale);
        }

        // Create canvas at target size
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Draw image scaled to target size
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);

        const texture = this.backend!.createTexture(
          `texture-${name}`,
          targetWidth,
          targetHeight,
          new Uint8Array(imageData.data.buffer),
          { format: 'rgba8unorm' }
        );

        const resized = (img.width !== targetWidth || img.height !== targetHeight)
          ? ` (resized from ${img.width}x${img.height})`
          : '';
        console.log(`Loaded texture: ${name} (${targetWidth}x${targetHeight})${resized}`);
        resolve(texture);
      };
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      img.src = url;
    });
  }

  private updateModelStats(): void {
    const vertexEl = document.getElementById('vertex-count');
    const triangleEl = document.getElementById('triangle-count');

    if (vertexEl) {
      vertexEl.textContent = this.modelVertexCount.toLocaleString();
    }
    if (triangleEl) {
      triangleEl.textContent = (this.modelIndexCount / 3).toLocaleString();
    }
  }

  private createGroundPlane(): void {
    if (!this.backend) return;

    const groundData = createPlane(20, 20, 4, 4);

    // Lower ground plane slightly below Y=0 to avoid z-fighting with model base
    for (let i = 1; i < groundData.positions.length; i += 3) {
      groundData.positions[i] = -0.1;
    }

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
    this.bindGroupLayout = this.backend.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: ['vertex'],
          type: 'uniform',
        },
      ],
    });

    // Create uniform buffer for camera
    const uniformData = new Float32Array(ModelViewer.CAMERA_UNIFORM_FLOATS);
    this.sharedUniformBuffer = this.backend.createBuffer(
      'camera-uniform',
      'uniform',
      uniformData,
      'dynamic_draw'
    );

    // Create bind group for camera (@group(0))
    this.sharedBindGroup = this.backend.createBindGroup(this.bindGroupLayout, {
      bindings: [
        {
          binding: 0,
          resource: this.sharedUniformBuffer,
        },
      ],
    });

    // Create material bind group layout (@group(1))
    this.materialBindGroupLayout = this.backend.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: ['fragment'], type: 'texture' },
        { binding: 1, visibility: ['fragment'], type: 'sampler' },
        { binding: 2, visibility: ['fragment'], type: 'uniform' },
      ],
    });

    // Create dummy 1x1 white texture
    const whitePixel = new Uint8Array([255, 255, 255, 255]);
    this.dummyTexture = this.backend.createTexture(
      'dummy-texture',
      1,
      1,
      whitePixel,
      {
        format: 'rgba8unorm',
      }
    );

    // Create 8x8 magenta/black checkerboard texture for failed textures
    const checkerSize = 8;
    const checkerData = new Uint8Array(checkerSize * checkerSize * 4);
    for (let y = 0; y < checkerSize; y++) {
      for (let x = 0; x < checkerSize; x++) {
        const offset = (y * checkerSize + x) * 4;
        const isWhite = (x + y) % 2 === 0;
        if (isWhite) {
          // Magenta for visibility
          checkerData[offset + 0] = 255; // R
          checkerData[offset + 1] = 0;   // G
          checkerData[offset + 2] = 255; // B
          checkerData[offset + 3] = 255; // A
        } else {
          // Black
          checkerData[offset + 0] = 0;   // R
          checkerData[offset + 1] = 0;   // G
          checkerData[offset + 2] = 0;   // B
          checkerData[offset + 3] = 255; // A
        }
      }
    }
    this.checkerboardTexture = this.backend.createTexture(
      'checkerboard-texture',
      checkerSize,
      checkerSize,
      checkerData,
      {
        format: 'rgba8unorm',
      }
    );

    // Create sampler
    this.dummySampler = this.backend.createSampler('dummy-sampler', {
      magFilter: 'linear',
      minFilter: 'linear',
    });

    // Create material uniform buffer
    const materialData = new Float32Array(ModelViewer.MATERIAL_UNIFORM_FLOATS);
    materialData[0] = 1.0; // R - albedo
    materialData[1] = 1.0; // G - albedo
    materialData[2] = 1.0; // B - albedo
    materialData[3] = 1.0; // A - albedo
    // materialData[4-7] are padding (initialized to 0)
    this.materialBuffer = this.backend.createBuffer(
      'material-uniform',
      'uniform',
      materialData,
      'static_draw'
    );

    // Create material bind group (@group(1))
    this.materialBindGroup = this.backend.createBindGroup(this.materialBindGroupLayout, {
      bindings: [
        { binding: 0, resource: this.dummyTexture },
        { binding: 1, resource: this.dummySampler },
        { binding: 2, resource: this.materialBuffer },
      ],
    });

    // Create light bind group layout (@group(2)) - read-only storage buffer for lights array
    this.lightBindGroupLayout = this.backend.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: ['vertex', 'fragment'], type: 'read-only-storage' },
      ],
    });

    // Create light bind group using buffer from RetroLightingSystem
    const lightBuffer = this.retroLighting.getLightBuffer();
    if (!lightBuffer) {
      throw new Error('RetroLightingSystem light buffer not initialized');
    }
    this.lightBindGroup = this.backend.createBindGroup(this.lightBindGroupLayout, {
      bindings: [
        { binding: 0, resource: lightBuffer },
      ],
    });

    // Create pipeline
    this.modelPipeline = this.backend.createRenderPipeline({
      shader: this.modelShader,
      vertexLayouts: [{
        arrayStride: ModelViewer.VERTEX_STRIDE,
        stepMode: 'vertex',
        attributes: [
          { shaderLocation: 0, offset: 0, format: 'float32x3' },  // position
          { shaderLocation: 1, offset: 12, format: 'float32x3' }, // normal
          { shaderLocation: 2, offset: 24, format: 'float32x2' }, // uv
          { shaderLocation: 3, offset: 32, format: 'float32x4' }, // color (ambient)
        ],
      }],
      bindGroupLayouts: [this.bindGroupLayout, this.materialBindGroupLayout, this.lightBindGroupLayout],
      pipelineState: OPAQUE_PIPELINE_STATE,
      colorFormat: 'bgra8unorm',
      depthFormat: 'depth16unorm',
    });

    // Create wireframe pipeline
    this.wireframePipeline = this.backend.createRenderPipeline({
      shader: this.modelShader,
      vertexLayouts: [{
        arrayStride: ModelViewer.VERTEX_STRIDE,
        stepMode: 'vertex',
        attributes: [
          { shaderLocation: 0, offset: 0, format: 'float32x3' },  // position
          { shaderLocation: 1, offset: 12, format: 'float32x3' }, // normal
          { shaderLocation: 2, offset: 24, format: 'float32x2' }, // uv
          { shaderLocation: 3, offset: 32, format: 'float32x4' }, // color (ambient)
        ],
      }],
      bindGroupLayouts: [this.bindGroupLayout, this.materialBindGroupLayout, this.lightBindGroupLayout],
      pipelineState: WIREFRAME_PIPELINE_STATE,
      colorFormat: 'bgra8unorm',
      depthFormat: 'depth16unorm',
    });
  }

  private setupCameraControls(): void {
    if (!this.orbitController) return;

    let isRotating = false;
    let isPanning = false;
    let lastX = 0;
    let lastY = 0;

    // Store handler references for cleanup
    this.mousedownHandler = (e: MouseEvent) => {
      if (e.button === 0) { // Left button - rotate
        isRotating = true;
        lastX = e.clientX;
        lastY = e.clientY;
      } else if (e.button === 2) { // Right button - pan
        isPanning = true;
        lastX = e.clientX;
        lastY = e.clientY;
        e.preventDefault();
      }
    };

    this.mousemoveHandler = (e: MouseEvent) => {
      if (!this.orbitController) return;

      const deltaX = e.clientX - lastX;
      const deltaY = e.clientY - lastY;

      if (isRotating) {
        this.orbitController.rotate(deltaX * 0.01, deltaY * 0.01);
      } else if (isPanning) {
        this.orbitController.pan(-deltaX, deltaY);
      }

      lastX = e.clientX;
      lastY = e.clientY;
    };

    this.mouseupHandler = () => {
      isRotating = false;
      isPanning = false;
    };

    this.wheelHandler = (e: WheelEvent) => {
      e.preventDefault();
      if (this.orbitController) {
        this.orbitController.zoom(e.deltaY * 0.01);
      }
    };

    // Keyboard controls
    this.keydownHandler = (e: KeyboardEvent) => {
      // Reset camera on 'R' key
      if (e.key === 'r' || e.key === 'R') {
        if (this.orbitController) {
          this.targetY = 2;
          this.orbitController.reset(10, 0, Math.PI / 6);
          this.orbitController.setTarget(0, this.targetY, 0);
          console.log('Camera reset');
        }
      }
      // Raise camera target with Q or Up arrow
      if (e.key === 'q' || e.key === 'Q' || e.key === 'ArrowUp') {
        this.targetY += 0.5;
        if (this.orbitController) {
          this.orbitController.setTarget(0, this.targetY, 0);
        }
      }
      // Lower camera target with E or Down arrow
      if (e.key === 'e' || e.key === 'E' || e.key === 'ArrowDown') {
        this.targetY -= 0.5;
        if (this.orbitController) {
          this.orbitController.setTarget(0, this.targetY, 0);
        }
      }
    };

    // Prevent context menu on right-click
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Register event listeners
    this.canvas.addEventListener('mousedown', this.mousedownHandler);
    this.canvas.addEventListener('mousemove', this.mousemoveHandler);
    this.canvas.addEventListener('mouseup', this.mouseupHandler);
    this.canvas.addEventListener('wheel', this.wheelHandler);
    window.addEventListener('keydown', this.keydownHandler);
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

    // Resize post-processor render targets
    if (this.retroPostProcessor) {
      this.retroPostProcessor.resize(this.canvas.width, this.canvas.height);
    }
  }

  start(): void {
    this.startTime = performance.now();
    this.lastFrameTime = this.startTime;
    this.lastFpsUpdate = this.startTime;
    this.render();
  }

  private render = (): void => {
    if (!this.backend || !this.cameraEntity) return;

    const currentTime = performance.now();
    const frameTime = currentTime - this.lastFrameTime;
    const deltaTime = frameTime / 1000;
    this.lastFrameTime = currentTime;

    // Update ECS systems
    this.transformSystem.update(this.world, deltaTime);

    // OrbitCameraController updates immediately on rotate/zoom calls
    // No update() method needed

    // Get camera matrices
    const cameraTransform = this.world.getComponent(this.cameraEntity, Transform);
    const cameraComponent = this.world.getComponent(this.cameraEntity, Camera);

    if (!cameraTransform || !cameraComponent) {
      this.animationId = requestAnimationFrame(this.render);
      return;
    }

    // Update camera uniform buffer - use lookAt with orbit target
    const eyeVec = new Float32Array([cameraTransform.x, cameraTransform.y, cameraTransform.z]);
    const targetVec = new Float32Array([0, this.targetY, 0]); // Match orbit controller target
    const upVec = new Float32Array([0, 1, 0]);
    const viewMatrix = Mat4.lookAt(eyeVec, targetVec, upVec);

    const aspect = this.canvas.width / this.canvas.height;
    const projectionMatrix = this.cameraSystem.getProjectionMatrix(this.cameraEntity, aspect);
    const viewProjectionMatrix = Mat4.multiply(projectionMatrix, viewMatrix);

    const uniformData = new Float32Array(ModelViewer.CAMERA_UNIFORM_FLOATS);
    uniformData.set(viewProjectionMatrix, 0);
    uniformData[16] = cameraTransform.x;
    uniformData[17] = cameraTransform.y;
    uniformData[18] = cameraTransform.z;

    this.backend.updateBuffer(this.sharedUniformBuffer, uniformData);

    // Begin frame
    this.backend.beginFrame();

    // Render to post-processor's intermediate texture (NOT swapchain)
    const sceneFramebuffer = this.retroPostProcessor.getSceneFramebuffer();
    this.backend.beginRenderPass(
      sceneFramebuffer,               // render to intermediate texture
      [0.1, 0.1, 0.15, 1.0],         // clear color (dark blue-gray)
      1.0,                            // clear depth
      undefined,                      // stencil
      'Model Viewer Pass',            // label
      true                            // requireDepth = true for 3D rendering
    );

    // Select pipeline based on wireframe mode
    const activePipeline = this.wireframeEnabled ? this.wireframePipeline : this.modelPipeline;

    // Draw model - either multi-material or single
    if (this.materialGroups.length > 0) {
      // Multi-material: one draw call per material group
      for (const group of this.materialGroups) {
        const materialCommand: DrawCommand = {
          pipeline: activePipeline,
          bindGroups: new Map([
            [0, this.sharedBindGroup],
            [1, group.bindGroup],
            [2, this.lightBindGroup],
          ]),
          geometry: {
            type: 'indexed',
            vertexBuffers: new Map([[0, group.vertexBuffer]]),
            indexBuffer: group.indexBuffer,
            indexFormat: group.indexFormat,
            indexCount: group.indexCount,
          },
          label: `model-${group.materialName}`,
        };
        this.backend.executeDrawCommand(materialCommand);
      }
    } else if (this.modelVertexBuffer && this.modelIndexBuffer) {
      // Single material fallback - only if buffers exist
      const modelCommand: DrawCommand = {
        pipeline: activePipeline,
        bindGroups: new Map([
          [0, this.sharedBindGroup],
          [1, this.materialBindGroup],
          [2, this.lightBindGroup],
        ]),
        geometry: {
          type: 'indexed',
          vertexBuffers: new Map([[0, this.modelVertexBuffer]]),
          indexBuffer: this.modelIndexBuffer,
          indexFormat: this.modelIndexFormat,
          indexCount: this.modelIndexCount,
        },
        label: 'model',
      };
      this.backend.executeDrawCommand(modelCommand);
    }
    // If neither condition is true, skip model rendering (loading in progress)

    // End scene render pass (rendering to intermediate texture is complete)
    this.backend.endRenderPass();

    // Apply post-processing effects and composite to swapchain
    const sceneTexture = this.retroPostProcessor.getSceneTexture();
    this.retroPostProcessor.updateTime(deltaTime);
    this.retroPostProcessor.apply(sceneTexture);

    // End frame
    this.backend.endFrame();

    // Update FPS
    this.updateFPS(frameTime);

    this.animationId = requestAnimationFrame(this.render);
  };

  private updateFPS(frameTime: number): void {
    this.frameCount++;
    this.frameTimeHistory.push(frameTime);
    if (this.frameTimeHistory.length > 60) {
      this.frameTimeHistory.shift();
    }

    const currentTime = performance.now();

    // Update stats every 1 second (aligned with demo.ts throttling)
    if (currentTime - this.lastFpsUpdate >= 1000) {
      const fps = Math.round(this.frameCount / ((currentTime - this.lastFpsUpdate) / 1000));
      const avgFrameTime = this.frameTimeHistory.reduce((a, b) => a + b, 0) / this.frameTimeHistory.length;

      // Update FPS
      const fpsEl = document.getElementById('fps-counter');
      if (fpsEl) {
        fpsEl.textContent = `${fps} (${avgFrameTime.toFixed(2)}ms)`;
      }

      // Update VRAM usage
      if (this.backend) {
        const vramStats = this.backend.getVRAMStats();
        const vramEl = document.getElementById('vram-usage');
        if (vramEl) {
          vramEl.textContent = `${(vramStats.totalUsed / 1024 / 1024).toFixed(2)} MB`;
        }
      }

      // Update texture count
      const textureEl = document.getElementById('texture-count');
      if (textureEl) {
        // Count textures loaded for the model (excluding dummy and checkerboard textures)
        const textureCount = this.materialGroups.filter(
          g => g.texture !== this.dummyTexture && g.texture !== this.checkerboardTexture
        ).length;
        textureEl.textContent = textureCount.toString();
      }

      // Update camera state
      if (this.orbitController) {
        const state = this.orbitController.getState();

        const distEl = document.getElementById('camera-distance');
        if (distEl) {
          distEl.textContent = state.distance.toFixed(1);
        }

        const azEl = document.getElementById('camera-azimuth');
        if (azEl) {
          // Convert radians to degrees
          azEl.textContent = `${((state.azimuth * 180 / Math.PI) % 360).toFixed(0)}°`;
        }

        const elevEl = document.getElementById('camera-elevation');
        if (elevEl) {
          // Convert radians to degrees
          elevEl.textContent = `${(state.elevation * 180 / Math.PI).toFixed(0)}°`;
        }

        const targetEl = document.getElementById('camera-target');
        if (targetEl) {
          targetEl.textContent = `${state.target[0].toFixed(1)}, ${state.target[1].toFixed(1)}, ${state.target[2].toFixed(1)}`;
        }
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

    // Clean up event listeners
    if (this.mousedownHandler) {
      this.canvas.removeEventListener('mousedown', this.mousedownHandler);
      this.mousedownHandler = null;
    }
    if (this.mousemoveHandler) {
      this.canvas.removeEventListener('mousemove', this.mousemoveHandler);
      this.mousemoveHandler = null;
    }
    if (this.mouseupHandler) {
      this.canvas.removeEventListener('mouseup', this.mouseupHandler);
      this.mouseupHandler = null;
    }
    if (this.wheelHandler) {
      this.canvas.removeEventListener('wheel', this.wheelHandler);
      this.wheelHandler = null;
    }
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }

    // Dispose retro post-processor
    if (this.retroPostProcessor) {
      this.retroPostProcessor.dispose();
    }

    if (this.backend) {
      this.backend.dispose();
      this.backend = null;
    }
  }

  // Public control methods for UI

  /**
   * Load a model by path (OBJ file) or generate a primitive
   */
  async loadModelByPath(modelPath: string): Promise<void> {
    if (!this.backend) return;

    // Clean up old model buffers
    // Note: WebGPU buffers don't need explicit cleanup, they're garbage collected

    await this.loadModel(modelPath);
    console.log(`Switched to model: ${modelPath}`);
  }

  /**
   * Load a model from a file system path (via IPC)
   * Used for user-selected files from the file picker
   */
  async loadModelFromFile(filePath: string): Promise<void> {
    if (!this.backend) return;

    console.log(`Loading model from file: ${filePath}`);

    // Clean up previous model resources
    this.disposeModelResources();

    // Model bounds for camera positioning
    let modelCenterX = 0, modelCenterY = 2, modelCenterZ = 0;
    let modelSize = 4;

    try {
      // Read the OBJ file via IPC
      const objResult = await window.electronAPI.file.readArbitrary(filePath, 'utf-8');
      if (!objResult.success || !objResult.data) {
        throw new Error(objResult.error || 'Failed to read OBJ file');
      }

      // Get base path for resolving MTL and textures
      const basePath = filePath.substring(0, filePath.lastIndexOf('/') + 1);

      // Create file reader function for IPC
      const readFile = async (path: string): Promise<string | null> => {
        const result = await window.electronAPI.file.readArbitrary(path, 'utf-8');
        return result.success ? result.data || null : null;
      };

      // Parse OBJ with materials
      const modelData = await loadOBJWithMaterialsFromContent(objResult.data, basePath, readFile);
      console.log(`Loaded model from ${filePath}`);
      console.log(`  ${modelData.materialGroups.length} material groups`);
      console.log(`  ${modelData.materials.size} materials defined`);

      // Process model data (similar to loadModel)
      if (modelData.materialGroups.length > 0) {
        let totalVertices = 0;
        let totalTriangles = 0;

        // Calculate bounding box across all material groups
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

        for (const group of modelData.materialGroups) {
          const positions = group.geometry.positions;
          for (let i = 0; i < positions.length; i += 3) {
            minX = Math.min(minX, positions[i]);
            maxX = Math.max(maxX, positions[i]);
            minY = Math.min(minY, positions[i + 1]);
            maxY = Math.max(maxY, positions[i + 1]);
            minZ = Math.min(minZ, positions[i + 2]);
            maxZ = Math.max(maxZ, positions[i + 2]);
          }
        }

        // Calculate center and size
        modelCenterX = (minX + maxX) / 2;
        modelCenterY = (minY + maxY) / 2;
        modelCenterZ = (minZ + maxZ) / 2;
        const sizeX = maxX - minX;
        const sizeY = maxY - minY;
        const sizeZ = maxZ - minZ;
        modelSize = Math.max(sizeX, sizeY, sizeZ);

        console.log(`Model bounds: center=(${modelCenterX.toFixed(2)}, ${modelCenterY.toFixed(2)}, ${modelCenterZ.toFixed(2)}), size=${modelSize.toFixed(2)}`);

        let groupIndex = 0;
        for (const group of modelData.materialGroups) {
          const geometry = group.geometry;
          const indexCount = Math.floor(geometry.indices.length / 3) * 3;
          const vertexCount = geometry.positions.length / 3;

          totalVertices += vertexCount;
          totalTriangles += indexCount / 3;

          // Interleave vertex data
          const interleavedData = this.interleaveVertexData(geometry);

          // Create GPU buffers with unique names (index to handle duplicate material names)
          const vertexBuffer = this.backend.createBuffer(
            `vertices-${groupIndex}-${group.materialName}`,
            'vertex',
            interleavedData,
            'static_draw'
          );
          const indexBuffer = this.backend.createBuffer(
            `indices-${groupIndex}-${group.materialName}`,
            'index',
            geometry.indices,
            'static_draw'
          );
          groupIndex++;

          // Determine index format from actual array type
          const indexFormat = geometry.indices instanceof Uint32Array ? 'uint32' : 'uint16';

          // Load texture for this material
          let texture = this.dummyTexture;
          const materialDef = modelData.materials.get(group.materialName);
          if (materialDef?.texturePath) {
            // Handle absolute Windows paths in MTL files (common in downloaded models)
            let textureFileName = materialDef.texturePath;
            if (textureFileName.match(/^[A-Z]:\\/)) {
              // Extract just the filename from Windows absolute path
              textureFileName = textureFileName.split('\\').pop() || textureFileName;
            }
            const texturePath = basePath + textureFileName;
            const ext = texturePath.toLowerCase().split('.').pop();

            // Skip unsupported texture formats
            if (ext === 'dds' || ext === 'tga') {
              console.warn(`Unsupported texture format: ${materialDef.texturePath}`);
              texture = this.checkerboardTexture; // Use checkerboard for unsupported formats
            } else {
              try {
                texture = await this.loadTextureFromFile(texturePath, `${groupIndex - 1}-${group.materialName}`);
              } catch (error) {
                console.warn(`Failed to load texture ${textureFileName}:`, error);
                texture = this.checkerboardTexture; // Use checkerboard for failed textures
              }
            }
          }

          // Create bind group for this material
          const bindGroup = this.backend.createBindGroup(this.materialBindGroupLayout, {
            bindings: [
              { binding: 0, resource: texture },
              { binding: 1, resource: this.dummySampler },
              { binding: 2, resource: this.materialBuffer },
            ],
          });

          this.materialGroups.push({
            materialName: group.materialName,
            vertexBuffer,
            indexBuffer,
            indexCount,
            indexFormat,
            texture,
            bindGroup,
          });
        }

        this.modelVertexCount = totalVertices;
        this.modelIndexCount = totalTriangles * 3;

        console.log(`Model: ${totalVertices} vertices, ${totalTriangles} triangles in ${this.materialGroups.length} groups`);
      }
    } catch (error) {
      console.warn('Failed to load model from file, using fallback sphere:', error);
      const simpleGeometry = createSphere(2.0, 32, 24);

      this.modelVertexCount = simpleGeometry.positions.length / 3;
      this.modelIndexCount = Math.floor(simpleGeometry.indices.length / 3) * 3;
      this.modelIndexFormat = simpleGeometry.indices instanceof Uint32Array ? 'uint32' : 'uint16';

      const interleavedData = this.interleaveVertexData(simpleGeometry);

      this.modelVertexBuffer = this.backend.createBuffer(
        'model-vertices',
        'vertex',
        interleavedData,
        'static_draw'
      );
      this.modelIndexBuffer = this.backend.createBuffer(
        'model-indices',
        'index',
        simpleGeometry.indices,
        'static_draw'
      );

      console.log(`Model: ${this.modelVertexCount} vertices, ${this.modelIndexCount / 3} triangles`);
    }

    // Update UI with model stats
    this.updateModelStats();

    // Reset camera to view the model properly based on its bounds
    if (this.orbitController) {
      // Set target to model center
      this.targetY = modelCenterY;
      // Distance based on model size (1.5x size for good framing)
      const distance = Math.max(modelSize * 1.5, 5);
      this.orbitController.reset(distance, 0, Math.PI / 6);
      this.orbitController.setTarget(modelCenterX, modelCenterY, modelCenterZ);
    }
  }

  /**
   * Load a texture from a file system path (via IPC)
   */
  private async loadTextureFromFile(filePath: string, name: string): Promise<BackendTextureHandle> {
    if (!this.backend) throw new Error('Backend not initialized');

    const MAX_TEXTURE_SIZE = 256;

    // Read the texture file as base64
    const result = await window.electronAPI.file.readArbitrary(filePath, 'base64');
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to read texture file');
    }

    // Capture backend reference before async operation
    const backend = this.backend;

    // Create image from base64 data
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        if (!backend) {
          reject(new Error('Backend disposed during texture load'));
          return;
        }

        // Resize if needed
        let width = img.width;
        let height = img.height;

        if (width > MAX_TEXTURE_SIZE || height > MAX_TEXTURE_SIZE) {
          const scale = MAX_TEXTURE_SIZE / Math.max(width, height);
          width = Math.floor(width * scale);
          height = Math.floor(height * scale);
        }

        // Create canvas and draw image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);

        // Get pixel data
        const imageData = ctx.getImageData(0, 0, width, height);

        // Create texture with pixel data
        const texture = backend.createTexture(
          `texture-${name}`,
          width,
          height,
          new Uint8Array(imageData.data.buffer),
          { format: 'rgba8unorm' }
        );

        console.log(`Loaded texture: ${name} (${width}x${height})`);
        resolve(texture);
      };

      img.onerror = () => reject(new Error(`Failed to load texture: ${filePath}`));

      // Determine MIME type from extension
      const ext = filePath.toLowerCase().split('.').pop();
      const mimeType = ext === 'png' ? 'image/png' :
                       ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
                       ext === 'bmp' ? 'image/bmp' : 'image/png';

      img.src = `data:${mimeType};base64,${result.data}`;
    });
  }

  /**
   * Enable or disable wireframe rendering
   */
  setWireframe(enabled: boolean): void {
    this.wireframeEnabled = enabled;
    console.log(`Wireframe mode: ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Enable or disable bloom effect
   */
  setBloomEnabled(enabled: boolean): void {
    this.bloomEnabled = enabled;
    // When disabled, set intensity to 0; otherwise use current intensity
    if (this.retroPostProcessor) {
      this.retroPostProcessor.setBloomIntensity(enabled ? this.bloomIntensity : 0);
    }
  }

  /**
   * Set bloom intensity (0.0 - 2.0)
   */
  setBloomIntensity(intensity: number): void {
    this.bloomIntensity = Math.max(0, Math.min(2, intensity));
    if (this.retroPostProcessor && this.bloomEnabled) {
      this.retroPostProcessor.setBloomIntensity(this.bloomIntensity);
    }
  }

  /**
   * Enable or disable CRT effect
   */
  setCRTEnabled(enabled: boolean): void {
    this.crtEnabled = enabled;
    if (this.retroPostProcessor) {
      this.retroPostProcessor.setCRTEnabled(enabled);
    }
  }

  /**
   * Set film grain amount (0.0 - 0.1)
   */
  setGrainAmount(amount: number): void {
    this.grainAmount = Math.max(0, Math.min(0.1, amount));
    if (this.retroPostProcessor) {
      this.retroPostProcessor.setGrainAmount(this.grainAmount);
    }
  }

  /**
   * Set light intensity and update the lighting system
   */
  setLightIntensity(intensity: number): void {
    this.lightIntensity = Math.max(0, Math.min(3, intensity));
    this.updateLight();
  }

  /**
   * Set light direction using spherical coordinates
   * @param azimuth - Horizontal angle in radians (0 = +X, PI/2 = +Z)
   * @param elevation - Vertical angle in radians (0 = horizontal, PI/2 = straight down)
   */
  setLightDirection(azimuth: number, elevation: number): void {
    this.lightAzimuth = azimuth;
    this.lightElevation = elevation;
    this.updateLight();
  }

  private updateLight(): void {
    // Convert spherical to cartesian direction
    // This produces the direction the light is POINTING (toward origin from light source)
    // Azimuth 0 = light from +X, so direction points toward -X
    // Azimuth 90 = light from +Z, so direction points toward -Z
    const dirX = -Math.cos(this.lightElevation) * Math.cos(this.lightAzimuth);
    const dirY = -Math.sin(this.lightElevation);
    const dirZ = -Math.cos(this.lightElevation) * Math.sin(this.lightAzimuth);

    const retroLights: RetroLight[] = [
      {
        type: 'directional',
        position: [0, 10, 0],
        color: [1.0, 0.95, 0.9],
        intensity: this.lightIntensity,
        direction: [dirX, dirY, dirZ],
      },
    ];
    this.retroLighting.setLights(retroLights);
  }
}
