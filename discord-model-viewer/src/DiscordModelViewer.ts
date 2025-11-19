/**
 * Discord Model Viewer - Standalone WebGPU 3D Model Viewer
 *
 * This is a completely standalone viewer with NO external dependencies
 * beyond the Discord SDK. All rendering code is self-contained.
 */

import { loadOBJWithMaterials, createSphere, createCube, type ModelData, type GeometryData } from './OBJLoader';
import * as Mat4 from './math';
import { simpleLambertShader, bloomExtractShader, bloomDownsampleShader, bloomUpsampleShader, compositeShader, crtShader } from './shaders';

export class DiscordModelViewer {
  // WebGPU resources
  private canvas: HTMLCanvasElement;
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private format: GPUTextureFormat = 'bgra8unorm';

  // Depth buffer
  private depthTexture: GPUTexture | null = null;

  // Shaders and pipelines
  private mainPipeline: GPURenderPipeline | null = null;
  private bloomExtractPipeline: GPURenderPipeline | null = null;
  private bloomDownsamplePipeline: GPURenderPipeline | null = null;
  private bloomUpsamplePipeline: GPURenderPipeline | null = null;
  private compositePipeline: GPURenderPipeline | null = null;
  private crtPipeline: GPURenderPipeline | null = null;

  // Bind group layouts
  private cameraBindGroupLayout: GPUBindGroupLayout | null = null;
  private materialBindGroupLayout: GPUBindGroupLayout | null = null;
  private lightBindGroupLayout: GPUBindGroupLayout | null = null;
  private bloomExtractTextureLayout: GPUBindGroupLayout | null = null;
  private bloomExtractUniformLayout: GPUBindGroupLayout | null = null;
  private downsampleTextureLayout: GPUBindGroupLayout | null = null;
  private downsampleUniformLayout: GPUBindGroupLayout | null = null;
  private upsampleTextureLayout: GPUBindGroupLayout | null = null;
  private upsampleUniformLayout: GPUBindGroupLayout | null = null;
  private compositeSceneLayout: GPUBindGroupLayout | null = null;
  private compositeBloomLayout: GPUBindGroupLayout | null = null;
  private compositeLUTLayout: GPUBindGroupLayout | null = null;
  private compositeParamsLayout: GPUBindGroupLayout | null = null;
  private crtTextureLayout: GPUBindGroupLayout | null = null;
  private crtParamsLayout: GPUBindGroupLayout | null = null;

  // Buffers
  private cameraBuffer: GPUBuffer | null = null;
  private materialBuffer: GPUBuffer | null = null;
  private lightBuffer: GPUBuffer | null = null;
  private bloomParamsBuffer: GPUBuffer | null = null;
  private downsampleParamsBuffer: GPUBuffer | null = null;
  private upsampleParamsBuffer: GPUBuffer | null = null;
  private compositeParamsBuffer: GPUBuffer | null = null;
  private crtParamsBuffer: GPUBuffer | null = null;

  // Bind groups
  private cameraBindGroup: GPUBindGroup | null = null;
  private lightBindGroup: GPUBindGroup | null = null;

  // Bloom textures (5-level mip pyramid)
  private bloomExtractTexture: GPUTexture | null = null;
  private bloomMip0Texture: GPUTexture | null = null;
  private bloomMip1Texture: GPUTexture | null = null;
  private bloomMip2Texture: GPUTexture | null = null;
  private bloomMip3Texture: GPUTexture | null = null;
  private bloomMip4Texture: GPUTexture | null = null;
  private compositeTexture: GPUTexture | null = null;

  // Mip pyramid dimensions
  private bloomWidth = 0;
  private bloomHeight = 0;
  private mip0Width = 0;
  private mip0Height = 0;
  private mip1Width = 0;
  private mip1Height = 0;
  private mip2Width = 0;
  private mip2Height = 0;
  private mip3Width = 0;
  private mip3Height = 0;
  private mip4Width = 0;
  private mip4Height = 0;

  // LUT texture (fallback 1x1 white)
  private lutTexture: GPUTexture | null = null;

  // Default resources
  private defaultTexture: GPUTexture | null = null;
  private defaultSampler: GPUSampler | null = null;

  // Scene render target for post-processing
  private sceneTexture: GPUTexture | null = null;
  private sceneTextureView: GPUTextureView | null = null;

  // Model data
  private materialGroups: {
    vertexBuffer: GPUBuffer;
    indexBuffer: GPUBuffer;
    indexCount: number;
    indexFormat: GPUIndexFormat;
    texture: GPUTexture;
    bindGroup: GPUBindGroup;
  }[] = [];

  // Camera state
  private cameraDistance = 30;
  private cameraAzimuth = Math.PI / 4;
  private cameraElevation = Math.PI / 6;
  private targetX = 0;
  private targetY = 8;
  private targetZ = 0;

  // Animation
  private animationId: number | null = null;
  private lastFrameTime = 0;
  private frameCount = 0;
  private lastFpsUpdate = 0;

  // Light state
  private lightAzimuth = Math.PI / 4;
  private lightElevation = Math.PI / 4;
  private lightIntensity = 1.2;

  // Post-process state
  private gamma = 2.2;
  private grainAmount = 0.02;
  private time = 0;
  private bloomThreshold = 0.8;
  private bloomIntensity = 0.3;
  private bloomMipLevels = 5;

  // CRT state
  private crtEnabled = true;
  private crtMasterIntensity = 1.0;
  private crtBrightness = 0.0;
  private crtContrast = 0.0;
  private crtSaturation = 1.0;
  private crtScanlinesStrength = 0.65;
  private crtBeamWidthMin = 0.8;
  private crtBeamWidthMax = 1.0;
  private crtBeamShape = 0.7;
  private crtMaskIntensity = 0.45;
  private crtMaskType = 1.0; // 1 = aperture grille
  private crtCurvatureAmount = 0.10;
  private crtVignetteAmount = 0.35;
  private crtCornerRadius = 0.08;
  private crtColorOverflow = 0.0;

  // Internal render resolution (for CRT scanlines)
  private internalWidth = 640;
  private internalHeight = 480;

  // Model stats
  private modelVertexCount = 0;
  private modelIndexCount = 0;

  // Input handlers
  private mousedownHandler: ((e: MouseEvent) => void) | null = null;
  private mousemoveHandler: ((e: MouseEvent) => void) | null = null;
  private mouseupHandler: (() => void) | null = null;
  private wheelHandler: ((e: WheelEvent) => void) | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private resizeHandler: (() => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  async initialize(): Promise<boolean> {
    try {
      // Check WebGPU support
      if (!navigator.gpu) {
        this.showError('WebGPU is not supported in this browser');
        return false;
      }

      // Request adapter
      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance',
      });
      if (!adapter) {
        this.showError('Failed to get WebGPU adapter');
        return false;
      }

      // Request device
      this.device = await adapter.requestDevice();

      // Get canvas context
      this.context = this.canvas.getContext('webgpu');
      if (!this.context) {
        this.showError('Failed to get WebGPU context');
        return false;
      }

      // Configure context
      this.format = navigator.gpu.getPreferredCanvasFormat();
      this.context.configure({
        device: this.device,
        format: this.format,
        alphaMode: 'opaque',
      });

      // Create resources (must happen before resizeCanvas which needs postProcessBuffer)
      this.createBindGroupLayouts();
      this.createBuffers();
      this.createDefaultResources();
      await this.createPipelines();

      // Now resize canvas and create scene render target
      this.resizeCanvas();
      this.resizeHandler = () => this.resizeCanvas();
      window.addEventListener('resize', this.resizeHandler);

      // Setup controls
      this.setupControls();

      // Load default model
      await this.loadModel('naked-snake');

      // Update light
      this.updateLightBuffer();

      // Hide loading, show viewer
      const loadingEl = document.getElementById('loading');
      if (loadingEl) loadingEl.classList.add('hidden');

      console.log('Discord Model Viewer initialized');
      return true;
    } catch (error) {
      console.error('Initialization failed:', error);
      this.showError(`Initialization failed: ${error}`);
      return false;
    }
  }

  private showError(message: string): void {
    const errorEl = document.getElementById('error-message');
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.remove('hidden');
    }
    const loadingEl = document.getElementById('loading');
    if (loadingEl) loadingEl.classList.add('hidden');
  }

  private resizeCanvas(): void {
    const dpr = window.devicePixelRatio || 1;
    // Ensure dimensions are at least 1 to avoid zero-size texture errors
    const width = Math.max(1, Math.floor(window.innerWidth * dpr));
    const height = Math.max(1, Math.floor(window.innerHeight * dpr));

    this.canvas.width = width;
    this.canvas.height = height;

    // Recreate depth texture at INTERNAL resolution (must match scene texture)
    if (this.device) {
      if (this.depthTexture) this.depthTexture.destroy();
      this.depthTexture = this.device.createTexture({
        size: [this.internalWidth, this.internalHeight],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });

      // Recreate scene render target
      this.createSceneRenderTarget();
    }
  }

  private createBindGroupLayouts(): void {
    if (!this.device) return;

    // Camera (group 0)
    this.cameraBindGroupLayout = this.device.createBindGroupLayout({
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      }],
    });

    // Material (group 1)
    this.materialBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: {} },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      ],
    });

    // Lights (group 2)
    this.lightBindGroupLayout = this.device.createBindGroupLayout({
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'read-only-storage' },
      }],
    });

    // Bloom extract texture (group 0)
    this.bloomExtractTextureLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: {} },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      ],
    });

    // Bloom extract uniform (group 1)
    this.bloomExtractUniformLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      ],
    });

    // Downsample texture (group 0)
    this.downsampleTextureLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: {} },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      ],
    });

    // Downsample uniform (group 1)
    this.downsampleUniformLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      ],
    });

    // Upsample texture (group 0)
    this.upsampleTextureLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: {} },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      ],
    });

    // Upsample uniform (group 1)
    this.upsampleUniformLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      ],
    });

    // Composite scene (group 0)
    this.compositeSceneLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: {} },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      ],
    });

    // Composite bloom (group 1)
    this.compositeBloomLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: {} },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      ],
    });

    // Composite LUT (group 2)
    this.compositeLUTLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: {} },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      ],
    });

    // Composite params (group 3)
    this.compositeParamsLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      ],
    });

    // CRT texture (group 0)
    this.crtTextureLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: {} },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      ],
    });

    // CRT params (group 1)
    this.crtParamsLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      ],
    });
  }

  private createBuffers(): void {
    if (!this.device) return;

    // Camera uniform (mat4 + vec3 + padding = 20 floats)
    this.cameraBuffer = this.device.createBuffer({
      size: 80,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Material uniform (vec4 albedo + vec4 padding = 32 bytes)
    this.materialBuffer = this.device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    // Set default white albedo + padding
    this.device.queue.writeBuffer(this.materialBuffer, 0, new Float32Array([1, 1, 1, 1, 0, 0, 0, 0]));

    // Light buffer (48 bytes per light - position/type, color/intensity, direction/range)
    this.lightBuffer = this.device.createBuffer({
      size: 48, // 1 light * 48 bytes
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    // Bloom params buffer (threshold + padding = 32 bytes minimum for WebGPU)
    this.bloomParamsBuffer = this.device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Downsample params buffer (texelSize vec2 + padding vec2 = 16 bytes, padded to 32 for WebGPU)
    this.downsampleParamsBuffer = this.device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Upsample params buffer (texelSize vec2 + blendFactor f32 + padding f32 = 16 bytes, padded to 32 for WebGPU)
    this.upsampleParamsBuffer = this.device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Composite params buffer (48 bytes - bloomIntensity, grainAmount, gamma, ditherPattern, time + padding)
    this.compositeParamsBuffer = this.device.createBuffer({
      size: 48,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // CRT params buffer (24 floats = 96 bytes)
    this.crtParamsBuffer = this.device.createBuffer({
      size: 96,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Create camera bind group
    this.cameraBindGroup = this.device.createBindGroup({
      layout: this.cameraBindGroupLayout!,
      entries: [{ binding: 0, resource: { buffer: this.cameraBuffer } }],
    });

    // Create light bind group
    this.lightBindGroup = this.device.createBindGroup({
      layout: this.lightBindGroupLayout!,
      entries: [{ binding: 0, resource: { buffer: this.lightBuffer } }],
    });
  }

  private createDefaultResources(): void {
    if (!this.device) return;

    // Default white texture
    this.defaultTexture = this.device.createTexture({
      size: [1, 1],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    this.device.queue.writeTexture(
      { texture: this.defaultTexture },
      new Uint8Array([255, 255, 255, 255]),
      { bytesPerRow: 4 },
      [1, 1]
    );

    // Fallback 1x1 white LUT (identity)
    this.lutTexture = this.device.createTexture({
      size: [1, 1],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    this.device.queue.writeTexture(
      { texture: this.lutTexture },
      new Uint8Array([255, 255, 255, 255]),
      { bytesPerRow: 4 },
      [1, 1]
    );

    // Default sampler
    this.defaultSampler = this.device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
    });
  }

  private async createPipelines(): Promise<void> {
    if (!this.device) return;

    // Main render pipeline
    const mainShaderModule = this.device.createShaderModule({
      code: simpleLambertShader,
    });

    const mainShaderInfo = await mainShaderModule.getCompilationInfo();
    for (const msg of mainShaderInfo.messages) {
      console.error(`Shader ${msg.type}: ${msg.message} at line ${msg.lineNum}`);
      if (msg.type === 'error') {
        throw new Error(`Shader compilation error: ${msg.message}`);
      }
    }

    this.mainPipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [
          this.cameraBindGroupLayout!,
          this.materialBindGroupLayout!,
          this.lightBindGroupLayout!,
        ],
      }),
      vertex: {
        module: mainShaderModule,
        entryPoint: 'vs_main',
        buffers: [{
          arrayStride: 48,
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x3' },
            { shaderLocation: 1, offset: 12, format: 'float32x3' },
            { shaderLocation: 2, offset: 24, format: 'float32x2' },
            { shaderLocation: 3, offset: 32, format: 'float32x4' },
          ],
        }],
      },
      fragment: {
        module: mainShaderModule,
        entryPoint: 'fs_main',
        targets: [{ format: this.format }],
      },
      primitive: { topology: 'triangle-list', cullMode: 'back' },
      depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' },
    });
    console.log('Main pipeline created successfully');

    // Bloom extract pipeline
    const bloomExtractModule = this.device.createShaderModule({ code: bloomExtractShader });
    this.bloomExtractPipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [this.bloomExtractTextureLayout!, this.bloomExtractUniformLayout!],
      }),
      vertex: { module: bloomExtractModule, entryPoint: 'vs_main' },
      fragment: { module: bloomExtractModule, entryPoint: 'fs_main', targets: [{ format: this.format }] },
      primitive: { topology: 'triangle-list' },
    });
    console.log('Bloom extract pipeline created successfully');

    // Bloom downsample pipeline (13-tap filter)
    const bloomDownsampleModule = this.device.createShaderModule({ code: bloomDownsampleShader });
    this.bloomDownsamplePipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [this.downsampleTextureLayout!, this.downsampleUniformLayout!],
      }),
      vertex: { module: bloomDownsampleModule, entryPoint: 'vs_main' },
      fragment: { module: bloomDownsampleModule, entryPoint: 'fs_main', targets: [{ format: this.format }] },
      primitive: { topology: 'triangle-list' },
    });
    console.log('Bloom downsample pipeline created successfully');

    // Bloom upsample pipeline (3x3 tent filter with additive blending)
    const bloomUpsampleModule = this.device.createShaderModule({ code: bloomUpsampleShader });
    this.bloomUpsamplePipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [this.upsampleTextureLayout!, this.upsampleUniformLayout!],
      }),
      vertex: { module: bloomUpsampleModule, entryPoint: 'vs_main' },
      fragment: {
        module: bloomUpsampleModule,
        entryPoint: 'fs_main',
        targets: [{
          format: this.format,
          blend: {
            color: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
          },
        }],
      },
      primitive: { topology: 'triangle-list' },
    });
    console.log('Bloom upsample pipeline created successfully');

    // Composite pipeline (4 bind groups: scene, bloom, LUT, params)
    const compositeModule = this.device.createShaderModule({ code: compositeShader });
    this.compositePipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [this.compositeSceneLayout!, this.compositeBloomLayout!, this.compositeLUTLayout!, this.compositeParamsLayout!],
      }),
      vertex: { module: compositeModule, entryPoint: 'vs_main' },
      fragment: { module: compositeModule, entryPoint: 'fs_main', targets: [{ format: this.format }] },
      primitive: { topology: 'triangle-list' },
    });
    console.log('Composite pipeline created successfully');

    // CRT pipeline
    const crtModule = this.device.createShaderModule({ code: crtShader });
    this.crtPipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [this.crtTextureLayout!, this.crtParamsLayout!],
      }),
      vertex: { module: crtModule, entryPoint: 'vs_main' },
      fragment: { module: crtModule, entryPoint: 'fs_main', targets: [{ format: this.format }] },
      primitive: { topology: 'triangle-list' },
    });
    console.log('CRT pipeline created successfully');
  }

  private createSceneRenderTarget(): void {
    if (!this.device) return;

    // Use internal resolution for scene rendering (CRT will upscale to display)
    const width = this.internalWidth;
    const height = this.internalHeight;

    // Destroy old textures
    if (this.sceneTexture) this.sceneTexture.destroy();
    if (this.bloomExtractTexture) this.bloomExtractTexture.destroy();
    if (this.bloomMip0Texture) this.bloomMip0Texture.destroy();
    if (this.bloomMip1Texture) this.bloomMip1Texture.destroy();
    if (this.bloomMip2Texture) this.bloomMip2Texture.destroy();
    if (this.bloomMip3Texture) this.bloomMip3Texture.destroy();
    if (this.bloomMip4Texture) this.bloomMip4Texture.destroy();
    if (this.compositeTexture) this.compositeTexture.destroy();

    // Scene render target at internal resolution
    this.sceneTexture = this.device.createTexture({
      size: [width, height],
      format: this.format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    this.sceneTextureView = this.sceneTexture.createView();

    // Bloom extract at quarter of internal resolution
    this.bloomWidth = Math.max(64, Math.floor(width / 4));
    this.bloomHeight = Math.max(64, Math.floor(height / 4));

    // Mip pyramid dimensions (each level is half the previous)
    this.mip0Width = Math.max(32, Math.floor(this.bloomWidth / 2));
    this.mip0Height = Math.max(32, Math.floor(this.bloomHeight / 2));
    this.mip1Width = Math.max(16, Math.floor(this.mip0Width / 2));
    this.mip1Height = Math.max(16, Math.floor(this.mip0Height / 2));
    this.mip2Width = Math.max(8, Math.floor(this.mip1Width / 2));
    this.mip2Height = Math.max(8, Math.floor(this.mip1Height / 2));
    this.mip3Width = Math.max(4, Math.floor(this.mip2Width / 2));
    this.mip3Height = Math.max(4, Math.floor(this.mip2Height / 2));
    this.mip4Width = Math.max(2, Math.floor(this.mip3Width / 2));
    this.mip4Height = Math.max(2, Math.floor(this.mip3Height / 2));

    // Bloom extract texture
    this.bloomExtractTexture = this.device.createTexture({
      size: [this.bloomWidth, this.bloomHeight],
      format: this.format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });

    // Mip pyramid textures
    this.bloomMip0Texture = this.device.createTexture({
      size: [this.mip0Width, this.mip0Height],
      format: this.format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });

    this.bloomMip1Texture = this.device.createTexture({
      size: [this.mip1Width, this.mip1Height],
      format: this.format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });

    this.bloomMip2Texture = this.device.createTexture({
      size: [this.mip2Width, this.mip2Height],
      format: this.format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });

    this.bloomMip3Texture = this.device.createTexture({
      size: [this.mip3Width, this.mip3Height],
      format: this.format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });

    this.bloomMip4Texture = this.device.createTexture({
      size: [this.mip4Width, this.mip4Height],
      format: this.format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });

    // Composite texture at internal resolution (for CRT input)
    this.compositeTexture = this.device.createTexture({
      size: [width, height],
      format: this.format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
  }

  async loadModel(modelName: string): Promise<void> {
    if (!this.device) return;

    // Clean up previous model
    for (const group of this.materialGroups) {
      group.vertexBuffer.destroy();
      group.indexBuffer.destroy();
      if (group.texture !== this.defaultTexture) {
        group.texture.destroy();
      }
    }
    this.materialGroups = [];

    console.log(`Loading model: ${modelName}`);

    let modelData: ModelData | null = null;
    let geometry: GeometryData | null = null;

    try {
      if (modelName === 'sphere') {
        geometry = createSphere(2, 32, 24);
      } else if (modelName === 'cube') {
        geometry = createCube(3);
      } else {
        // Accept either full paths (/models/...) or short names
        let path: string;
        if (modelName.startsWith('/models/') || modelName.endsWith('.obj')) {
          path = modelName;
        } else {
          // Legacy short name support
          const modelPaths: Record<string, string> = {
            'naked-snake': '/models/Naked Snake/Naked_Snake.obj',
            'tallgeese': '/models/Tallgeese III/Tallgeese_III.obj',
            'kid-goku': '/models/Kid Goku/Kid_Goku_Budokai_3.obj',
            'hatsune-miku': '/models/Hatsune Miku/Hatsune_Miku.obj',
            'patriot': '/models/patriot/Patriot.obj',
          };
          path = modelPaths[modelName] || modelPaths['naked-snake'];
        }
        modelData = await loadOBJWithMaterials(path);
      }
    } catch (error) {
      console.warn('Failed to load model:', error);
      geometry = createSphere(2, 32, 24);
    }

    // Build GPU resources
    if (modelData && modelData.materialGroups.length > 0) {
      const basePath = this.getBasePath(modelName);
      let totalVertices = 0;
      let totalTriangles = 0;

      for (const group of modelData.materialGroups) {
        const geo = group.geometry;
        const vertexCount = geo.positions.length / 3;
        const indexCount = geo.indices.length;

        totalVertices += vertexCount;
        totalTriangles += indexCount / 3;

        // Interleave vertex data
        const vertexData = this.interleaveVertexData(geo);

        // Create buffers
        const vertexBuffer = this.device.createBuffer({
          size: vertexData.byteLength,
          usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        this.device.queue.writeBuffer(vertexBuffer, 0, vertexData as unknown as ArrayBuffer);

        // Pad index data to 4-byte alignment for WebGPU
        let indexData: ArrayBufferView = geo.indices;
        if (geo.indices.byteLength % 4 !== 0) {
          const paddedLength = Math.ceil(geo.indices.byteLength / 4) * 4;
          const padded = new Uint8Array(paddedLength);
          padded.set(new Uint8Array(geo.indices.buffer, geo.indices.byteOffset, geo.indices.byteLength));
          indexData = padded;
        }
        const indexBuffer = this.device.createBuffer({
          size: indexData.byteLength,
          usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
        });
        this.device.queue.writeBuffer(indexBuffer, 0, indexData as unknown as ArrayBuffer);

        // Load texture
        let texture = this.defaultTexture!;
        const materialDef = modelData.materials.get(group.materialName);
        if (materialDef?.texturePath) {
          try {
            const texturePath = basePath + materialDef.texturePath;
            texture = await this.loadTexture(texturePath);
          } catch (e) {
            console.warn('Failed to load texture:', e);
          }
        }

        // Create material bind group
        const bindGroup = this.device.createBindGroup({
          layout: this.materialBindGroupLayout!,
          entries: [
            { binding: 0, resource: texture.createView() },
            { binding: 1, resource: this.defaultSampler! },
            { binding: 2, resource: { buffer: this.materialBuffer! } },
          ],
        });

        this.materialGroups.push({
          vertexBuffer,
          indexBuffer,
          indexCount,
          indexFormat: geo.indices instanceof Uint32Array ? 'uint32' : 'uint16',
          texture,
          bindGroup,
        });
      }

      this.modelVertexCount = totalVertices;
      this.modelIndexCount = totalTriangles * 3;
    } else if (geometry) {
      // Simple geometry
      const vertexData = this.interleaveVertexData(geometry);

      const vertexBuffer = this.device.createBuffer({
        size: vertexData.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      });
      this.device.queue.writeBuffer(vertexBuffer, 0, vertexData as unknown as ArrayBuffer);

      // Pad index data to 4-byte alignment for WebGPU
      let indexData: ArrayBufferView = geometry.indices;
      if (geometry.indices.byteLength % 4 !== 0) {
        const paddedLength = Math.ceil(geometry.indices.byteLength / 4) * 4;
        const padded = new Uint8Array(paddedLength);
        padded.set(new Uint8Array(geometry.indices.buffer, geometry.indices.byteOffset, geometry.indices.byteLength));
        indexData = padded;
      }
      const indexBuffer = this.device.createBuffer({
        size: indexData.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      });
      this.device.queue.writeBuffer(indexBuffer, 0, indexData as unknown as ArrayBuffer);

      const bindGroup = this.device.createBindGroup({
        layout: this.materialBindGroupLayout!,
        entries: [
          { binding: 0, resource: this.defaultTexture!.createView() },
          { binding: 1, resource: this.defaultSampler! },
          { binding: 2, resource: { buffer: this.materialBuffer! } },
        ],
      });

      this.materialGroups.push({
        vertexBuffer,
        indexBuffer,
        indexCount: geometry.indices.length,
        indexFormat: geometry.indices instanceof Uint32Array ? 'uint32' : 'uint16',
        texture: this.defaultTexture!,
        bindGroup,
      });

      this.modelVertexCount = geometry.positions.length / 3;
      this.modelIndexCount = geometry.indices.length;
    }

    // Update stats display
    this.updateStats();

    // Reset camera
    this.cameraDistance = 30;
    this.cameraAzimuth = Math.PI / 4;
    this.cameraElevation = Math.PI / 6;
    this.targetY = 8;
  }

  private getBasePath(modelName: string): string {
    // If it's a full path, extract the directory
    if (modelName.startsWith('/models/') || modelName.endsWith('.obj')) {
      const lastSlash = modelName.lastIndexOf('/');
      if (lastSlash > 0) {
        return modelName.substring(0, lastSlash + 1);
      }
    }

    // Legacy short name support
    const paths: Record<string, string> = {
      'naked-snake': '/models/Naked Snake/',
      'tallgeese': '/models/Tallgeese III/',
      'kid-goku': '/models/Kid Goku/',
      'hatsune-miku': '/models/Hatsune Miku/',
      'patriot': '/models/patriot/',
    };
    return paths[modelName] || paths['naked-snake'];
  }

  private interleaveVertexData(data: GeometryData): Float32Array {
    const vertexCount = data.positions.length / 3;
    const interleaved = new Float32Array(vertexCount * 12);

    for (let i = 0; i < vertexCount; i++) {
      const offset = i * 12;
      // Position
      interleaved[offset] = data.positions[i * 3];
      interleaved[offset + 1] = data.positions[i * 3 + 1];
      interleaved[offset + 2] = data.positions[i * 3 + 2];
      // Normal
      interleaved[offset + 3] = data.normals[i * 3];
      interleaved[offset + 4] = data.normals[i * 3 + 1];
      interleaved[offset + 5] = data.normals[i * 3 + 2];
      // UV
      interleaved[offset + 6] = data.uvs[i * 2];
      interleaved[offset + 7] = data.uvs[i * 2 + 1];
      // Color (ambient)
      interleaved[offset + 8] = 0.2;
      interleaved[offset + 9] = 0.2;
      interleaved[offset + 10] = 0.2;
      interleaved[offset + 11] = 1.0;
    }

    return interleaved;
  }

  private async loadTexture(url: string): Promise<GPUTexture> {
    if (!this.device) throw new Error('Device not initialized');

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        // Resize to max 256x256
        const maxSize = 256;
        let width = img.width;
        let height = img.height;
        if (width > maxSize || height > maxSize) {
          const scale = maxSize / Math.max(width, height);
          width = Math.floor(width * scale);
          height = Math.floor(height * scale);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);

        const texture = this.device!.createTexture({
          size: [width, height],
          format: 'rgba8unorm',
          usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
        });

        this.device!.queue.writeTexture(
          { texture },
          imageData.data,
          { bytesPerRow: width * 4 },
          [width, height]
        );

        resolve(texture);
      };
      img.onerror = () => reject(new Error(`Failed to load: ${url}`));
      img.src = url;
    });
  }

  private updateLightBuffer(): void {
    if (!this.device || !this.lightBuffer) return;

    // Calculate light direction from spherical coords
    const dirX = -Math.cos(this.lightElevation) * Math.cos(this.lightAzimuth);
    const dirY = -Math.sin(this.lightElevation);
    const dirZ = -Math.cos(this.lightElevation) * Math.sin(this.lightAzimuth);

    // Light struct: position(vec3)+type(u32), color(vec3)+intensity(f32), direction(vec3)+range(f32)
    // = 12 floats per light
    const buffer = new ArrayBuffer(48);
    const floatView = new Float32Array(buffer);
    const uintView = new Uint32Array(buffer);

    // Light 0: directional
    // position (vec3) + type_ (u32)
    floatView[0] = 0;    // position.x
    floatView[1] = 10;   // position.y
    floatView[2] = 0;    // position.z
    uintView[3] = 0;     // type_ = 0 (directional)

    // color (vec3) + intensity (f32)
    floatView[4] = 1.0;  // color.r
    floatView[5] = 0.95; // color.g
    floatView[6] = 0.9;  // color.b
    floatView[7] = this.lightIntensity;

    // direction (vec3) + range (f32)
    floatView[8] = dirX;
    floatView[9] = dirY;
    floatView[10] = dirZ;
    floatView[11] = 100; // range (not used for directional but needs a value)

    this.device.queue.writeBuffer(this.lightBuffer, 0, buffer);
  }

  private updateStats(): void {
    const vertexEl = document.getElementById('vertex-count');
    const triangleEl = document.getElementById('triangle-count');
    const materialEl = document.getElementById('material-count');
    const textureEl = document.getElementById('texture-count');
    const vramEl = document.getElementById('vram-usage');

    if (vertexEl) vertexEl.textContent = this.modelVertexCount.toLocaleString();
    if (triangleEl) triangleEl.textContent = (this.modelIndexCount / 3).toLocaleString();
    if (materialEl) materialEl.textContent = this.materialGroups.length.toString();

    // Count unique textures (excluding default)
    let textureCount = 0;
    for (const group of this.materialGroups) {
      if (group.texture !== this.defaultTexture) {
        textureCount++;
      }
    }
    if (textureEl) textureEl.textContent = textureCount.toString();

    // Estimate VRAM usage (rough estimate)
    // Vertex data: 48 bytes per vertex (12 floats)
    // Index data: 2 bytes per index
    // Textures: approximate at 4MB each
    const vertexBytes = this.modelVertexCount * 48;
    const indexBytes = this.modelIndexCount * 2;
    const textureBytes = textureCount * 4 * 1024 * 1024; // 4MB per texture estimate
    const totalMB = (vertexBytes + indexBytes + textureBytes) / (1024 * 1024);
    if (vramEl) vramEl.textContent = `${totalMB.toFixed(2)} MB`;
  }

  private setupControls(): void {
    let isRotating = false;
    let isPanning = false;
    let lastX = 0;
    let lastY = 0;

    this.mousedownHandler = (e: MouseEvent) => {
      if (e.button === 0) {
        isRotating = true;
        lastX = e.clientX;
        lastY = e.clientY;
      } else if (e.button === 2) {
        isPanning = true;
        lastX = e.clientX;
        lastY = e.clientY;
        e.preventDefault();
      }
    };

    this.mousemoveHandler = (e: MouseEvent) => {
      const deltaX = e.clientX - lastX;
      const deltaY = e.clientY - lastY;

      if (isRotating) {
        this.cameraAzimuth += deltaX * 0.01;
        this.cameraElevation += deltaY * 0.01;
        this.cameraElevation = Math.max(0.1, Math.min(Math.PI - 0.1, this.cameraElevation));
      } else if (isPanning) {
        const panScale = this.cameraDistance * 0.002;
        this.targetX += -deltaX * panScale;
        this.targetY += deltaY * panScale;
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
      this.cameraDistance += e.deltaY * 0.01;
      this.cameraDistance = Math.max(1, Math.min(1000, this.cameraDistance));
    };

    this.keydownHandler = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') {
        this.cameraDistance = 30;
        this.cameraAzimuth = Math.PI / 4;
        this.cameraElevation = Math.PI / 6;
        this.targetX = 0;
        this.targetY = 8;
        this.targetZ = 0;
      } else if (e.key === 'q' || e.key === 'Q') {
        this.targetY += 0.5;
      } else if (e.key === 'e' || e.key === 'E') {
        this.targetY -= 0.5;
      }
    };

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas.addEventListener('mousedown', this.mousedownHandler);
    this.canvas.addEventListener('mousemove', this.mousemoveHandler);
    this.canvas.addEventListener('mouseup', this.mouseupHandler);
    this.canvas.addEventListener('wheel', this.wheelHandler);
    window.addEventListener('keydown', this.keydownHandler);
  }

  start(): void {
    this.lastFrameTime = performance.now();
    this.lastFpsUpdate = this.lastFrameTime;
    this.render();
  }

  private render = (): void => {
    if (!this.device || !this.context) return;

    const now = performance.now();
    const deltaTime = (now - this.lastFrameTime) / 1000;
    this.lastFrameTime = now;
    this.time += deltaTime;

    // Calculate camera position
    const camX = this.targetX + this.cameraDistance * Math.sin(this.cameraElevation) * Math.cos(this.cameraAzimuth);
    const camY = this.targetY + this.cameraDistance * Math.cos(this.cameraElevation);
    const camZ = this.targetZ + this.cameraDistance * Math.sin(this.cameraElevation) * Math.sin(this.cameraAzimuth);

    // Build matrices
    const eye = new Float32Array([camX, camY, camZ]);
    const target = new Float32Array([this.targetX, this.targetY, this.targetZ]);
    const up = new Float32Array([0, 1, 0]);

    const viewMatrix = Mat4.lookAt(eye, target, up);
    // Use internal resolution aspect ratio since scene renders at internal resolution
    const aspect = this.internalWidth / this.internalHeight;
    const projMatrix = Mat4.perspective(Math.PI / 4, aspect, 1, 5000);
    const viewProjMatrix = Mat4.multiply(projMatrix, viewMatrix);

    // Update camera buffer
    const cameraData = new Float32Array(20);
    cameraData.set(viewProjMatrix, 0);
    cameraData[16] = camX;
    cameraData[17] = camY;
    cameraData[18] = camZ;
    this.device.queue.writeBuffer(this.cameraBuffer!, 0, cameraData);

    // Get swapchain texture
    const swapchainTexture = this.context.getCurrentTexture();

    // Command encoder
    const commandEncoder = this.device.createCommandEncoder();

    // Pass 1: Scene render
    const scenePass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: this.sceneTextureView!,
        clearValue: { r: 0.1, g: 0.1, b: 0.15, a: 1 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
      depthStencilAttachment: {
        view: this.depthTexture!.createView(),
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
    });

    scenePass.setPipeline(this.mainPipeline!);
    scenePass.setBindGroup(0, this.cameraBindGroup!);
    scenePass.setBindGroup(2, this.lightBindGroup!);

    for (const group of this.materialGroups) {
      scenePass.setBindGroup(1, group.bindGroup);
      scenePass.setVertexBuffer(0, group.vertexBuffer);
      scenePass.setIndexBuffer(group.indexBuffer, group.indexFormat);
      scenePass.drawIndexed(group.indexCount);
    }
    scenePass.end();

    // Pass 2: Bloom extract
    this.device.queue.writeBuffer(this.bloomParamsBuffer!, 0, new Float32Array([this.bloomThreshold, 0, 0, 0]));
    const bloomExtractBindGroup = this.device.createBindGroup({
      layout: this.bloomExtractTextureLayout!,
      entries: [
        { binding: 0, resource: this.sceneTextureView! },
        { binding: 1, resource: this.defaultSampler! },
      ],
    });
    const bloomExtractUniformBindGroup = this.device.createBindGroup({
      layout: this.bloomExtractUniformLayout!,
      entries: [{ binding: 0, resource: { buffer: this.bloomParamsBuffer! } }],
    });

    const extractPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: this.bloomExtractTexture!.createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });
    extractPass.setPipeline(this.bloomExtractPipeline!);
    extractPass.setBindGroup(0, bloomExtractBindGroup);
    extractPass.setBindGroup(1, bloomExtractUniformBindGroup);
    extractPass.draw(3);
    extractPass.end();

    // =====================
    // DOWNSAMPLE CHAIN (5 levels)
    // =====================

    // Helper function for downsample pass
    const executeDownsample = (
      srcTexture: GPUTexture,
      dstTexture: GPUTexture,
      srcWidth: number,
      srcHeight: number
    ) => {
      // Update downsample params with source texel size
      this.device!.queue.writeBuffer(
        this.downsampleParamsBuffer!,
        0,
        new Float32Array([1.0 / srcWidth, 1.0 / srcHeight, 0, 0])
      );

      const textureBindGroup = this.device!.createBindGroup({
        layout: this.downsampleTextureLayout!,
        entries: [
          { binding: 0, resource: srcTexture.createView() },
          { binding: 1, resource: this.defaultSampler! },
        ],
      });
      const uniformBindGroup = this.device!.createBindGroup({
        layout: this.downsampleUniformLayout!,
        entries: [{ binding: 0, resource: { buffer: this.downsampleParamsBuffer! } }],
      });

      const pass = commandEncoder.beginRenderPass({
        colorAttachments: [{
          view: dstTexture.createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        }],
      });
      pass.setPipeline(this.bloomDownsamplePipeline!);
      pass.setBindGroup(0, textureBindGroup);
      pass.setBindGroup(1, uniformBindGroup);
      pass.draw(3);
      pass.end();
    };

    // Downsample chain with mip level control
    if (this.bloomMipLevels >= 1) {
      executeDownsample(this.bloomExtractTexture!, this.bloomMip0Texture!, this.bloomWidth, this.bloomHeight);
    }
    if (this.bloomMipLevels >= 2) {
      executeDownsample(this.bloomMip0Texture!, this.bloomMip1Texture!, this.mip0Width, this.mip0Height);
    }
    if (this.bloomMipLevels >= 3) {
      executeDownsample(this.bloomMip1Texture!, this.bloomMip2Texture!, this.mip1Width, this.mip1Height);
    }
    if (this.bloomMipLevels >= 4) {
      executeDownsample(this.bloomMip2Texture!, this.bloomMip3Texture!, this.mip2Width, this.mip2Height);
    }
    if (this.bloomMipLevels >= 5) {
      executeDownsample(this.bloomMip3Texture!, this.bloomMip4Texture!, this.mip3Width, this.mip3Height);
    }

    // =====================
    // UPSAMPLE CHAIN (5 levels with additive blending)
    // =====================

    // Helper function for upsample pass (additive blending)
    const executeUpsample = (
      srcTexture: GPUTexture,
      dstTexture: GPUTexture,
      srcWidth: number,
      srcHeight: number,
      blendFactor: number
    ) => {
      // Update upsample params with source texel size and blend factor
      this.device!.queue.writeBuffer(
        this.upsampleParamsBuffer!,
        0,
        new Float32Array([1.0 / srcWidth, 1.0 / srcHeight, blendFactor, 0])
      );

      const textureBindGroup = this.device!.createBindGroup({
        layout: this.upsampleTextureLayout!,
        entries: [
          { binding: 0, resource: srcTexture.createView() },
          { binding: 1, resource: this.defaultSampler! },
        ],
      });
      const uniformBindGroup = this.device!.createBindGroup({
        layout: this.upsampleUniformLayout!,
        entries: [{ binding: 0, resource: { buffer: this.upsampleParamsBuffer! } }],
      });

      const pass = commandEncoder.beginRenderPass({
        colorAttachments: [{
          view: dstTexture.createView(),
          loadOp: 'load', // Load existing content for additive blending
          storeOp: 'store',
        }],
      });
      pass.setPipeline(this.bloomUpsamplePipeline!);
      pass.setBindGroup(0, textureBindGroup);
      pass.setBindGroup(1, uniformBindGroup);
      pass.draw(3);
      pass.end();
    };

    // Upsample chain with mip level control and CORRECT blend factors from reference
    if (this.bloomMipLevels >= 5) {
      executeUpsample(this.bloomMip4Texture!, this.bloomMip3Texture!, this.mip4Width, this.mip4Height, 0.3);
    }
    if (this.bloomMipLevels >= 4) {
      executeUpsample(this.bloomMip3Texture!, this.bloomMip2Texture!, this.mip3Width, this.mip3Height, 0.5);
    }
    if (this.bloomMipLevels >= 3) {
      executeUpsample(this.bloomMip2Texture!, this.bloomMip1Texture!, this.mip2Width, this.mip2Height, 0.6);
    }
    if (this.bloomMipLevels >= 2) {
      executeUpsample(this.bloomMip1Texture!, this.bloomMip0Texture!, this.mip1Width, this.mip1Height, 0.8);
    }
    if (this.bloomMipLevels >= 1) {
      executeUpsample(this.bloomMip0Texture!, this.bloomExtractTexture!, this.mip0Width, this.mip0Height, 1.0);
    }

    // =====================
    // COMPOSITE PASS (4 bind groups: scene, bloom, LUT, params)
    // =====================

    // PostParams: bloomIntensity, grainAmount, gamma, ditherPattern, time, _padding[3]
    const compositeData = new Float32Array(12);
    compositeData[0] = this.bloomIntensity;
    compositeData[1] = this.grainAmount;
    compositeData[2] = this.gamma;
    compositeData[3] = 0; // ditherPattern (as float, will be cast to u32)
    compositeData[4] = this.time;
    // [5-11] = padding
    this.device.queue.writeBuffer(this.compositeParamsBuffer!, 0, compositeData);

    const compositeSceneBindGroup = this.device.createBindGroup({
      layout: this.compositeSceneLayout!,
      entries: [
        { binding: 0, resource: this.sceneTextureView! },
        { binding: 1, resource: this.defaultSampler! },
      ],
    });
    const compositeBloomBindGroup = this.device.createBindGroup({
      layout: this.compositeBloomLayout!,
      entries: [
        { binding: 0, resource: this.bloomExtractTexture!.createView() }, // Final bloom result
        { binding: 1, resource: this.defaultSampler! },
      ],
    });
    const compositeLUTBindGroup = this.device.createBindGroup({
      layout: this.compositeLUTLayout!,
      entries: [
        { binding: 0, resource: this.lutTexture!.createView() },
        { binding: 1, resource: this.defaultSampler! },
      ],
    });
    const compositeParamsBindGroup = this.device.createBindGroup({
      layout: this.compositeParamsLayout!,
      entries: [{ binding: 0, resource: { buffer: this.compositeParamsBuffer! } }],
    });

    const compositeTarget = this.crtEnabled ? this.compositeTexture!.createView() : swapchainTexture.createView();
    const compositePass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: compositeTarget,
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });
    compositePass.setPipeline(this.compositePipeline!);
    compositePass.setBindGroup(0, compositeSceneBindGroup);
    compositePass.setBindGroup(1, compositeBloomBindGroup);
    compositePass.setBindGroup(2, compositeLUTBindGroup);
    compositePass.setBindGroup(3, compositeParamsBindGroup);
    compositePass.draw(3);
    compositePass.end();

    // =====================
    // CRT PASS (if enabled)
    // =====================
    if (this.crtEnabled) {
      // CRT params: 24 floats (96 bytes)
      // [0-1] resolution, [2-3] sourceSize (internal), [4-7] master/brightness/contrast/saturation
      // [8-11] scanlines/beam, [12-15] mask/curvature/vignette, [16-17] corner/overflow, [18-23] padding
      const crtData = new Float32Array(24);
      crtData[0] = this.canvas.width;     // resolution.x
      crtData[1] = this.canvas.height;    // resolution.y
      crtData[2] = this.internalWidth;    // sourceSize.x (internal render resolution)
      crtData[3] = this.internalHeight;   // sourceSize.y (internal render resolution)
      crtData[4] = this.crtMasterIntensity;
      crtData[5] = this.crtBrightness;
      crtData[6] = this.crtContrast;
      crtData[7] = this.crtSaturation;
      crtData[8] = this.crtScanlinesStrength;
      crtData[9] = this.crtBeamWidthMin;
      crtData[10] = this.crtBeamWidthMax;
      crtData[11] = this.crtBeamShape;
      crtData[12] = this.crtMaskIntensity;
      crtData[13] = this.crtMaskType;
      crtData[14] = this.crtCurvatureAmount;
      crtData[15] = this.crtVignetteAmount;
      crtData[16] = this.crtCornerRadius;
      crtData[17] = this.crtColorOverflow;
      // [18-23] = 0 (padding, already initialized to 0)
      this.device.queue.writeBuffer(this.crtParamsBuffer!, 0, crtData);

      const crtTextureBindGroup = this.device.createBindGroup({
        layout: this.crtTextureLayout!,
        entries: [
          { binding: 0, resource: this.compositeTexture!.createView() },
          { binding: 1, resource: this.defaultSampler! },
        ],
      });
      const crtParamsBindGroup = this.device.createBindGroup({
        layout: this.crtParamsLayout!,
        entries: [{ binding: 0, resource: { buffer: this.crtParamsBuffer! } }],
      });

      const crtPass = commandEncoder.beginRenderPass({
        colorAttachments: [{
          view: swapchainTexture.createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        }],
      });
      crtPass.setPipeline(this.crtPipeline!);
      crtPass.setBindGroup(0, crtTextureBindGroup);
      crtPass.setBindGroup(1, crtParamsBindGroup);
      crtPass.draw(3);
      crtPass.end();
    }

    // Submit
    this.device.queue.submit([commandEncoder.finish()]);

    // Update FPS
    this.frameCount++;
    if (now - this.lastFpsUpdate >= 1000) {
      const fps = Math.round(this.frameCount / ((now - this.lastFpsUpdate) / 1000));
      const fpsEl = document.getElementById('fps-counter');
      if (fpsEl) fpsEl.textContent = `${fps}`;

      const distEl = document.getElementById('camera-distance');
      const azEl = document.getElementById('camera-azimuth');
      const elevEl = document.getElementById('camera-elevation');
      const targetEl = document.getElementById('camera-target');
      if (distEl) distEl.textContent = this.cameraDistance.toFixed(1);
      if (azEl) azEl.textContent = `${((this.cameraAzimuth * 180 / Math.PI) % 360).toFixed(0)}°`;
      if (elevEl) elevEl.textContent = `${(this.cameraElevation * 180 / Math.PI).toFixed(0)}°`;
      if (targetEl) targetEl.textContent = `${this.targetX.toFixed(1)}, ${this.targetY.toFixed(1)}, ${this.targetZ.toFixed(1)}`;

      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }

    this.animationId = requestAnimationFrame(this.render);
  };

  stop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
    }
    if (this.mousedownHandler) {
      this.canvas.removeEventListener('mousedown', this.mousedownHandler);
    }
    if (this.mousemoveHandler) {
      this.canvas.removeEventListener('mousemove', this.mousemoveHandler);
    }
    if (this.mouseupHandler) {
      this.canvas.removeEventListener('mouseup', this.mouseupHandler);
    }
    if (this.wheelHandler) {
      this.canvas.removeEventListener('wheel', this.wheelHandler);
    }
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
    }

    // Cleanup GPU resources
    for (const group of this.materialGroups) {
      group.vertexBuffer.destroy();
      group.indexBuffer.destroy();
      if (group.texture !== this.defaultTexture) {
        group.texture.destroy();
      }
    }
  }

  // Public methods for UI controls
  setupKeyboardHandlers(): void {
    // Already set up in setupControls
  }

  setWireframe(_enabled: boolean): void {
    // TODO: implement wireframe mode
  }

  setLightDirection(azimuth: number, elevation: number): void {
    this.lightAzimuth = azimuth;
    this.lightElevation = elevation;
    this.updateLightBuffer();
  }

  setLightIntensity(intensity: number): void {
    this.lightIntensity = intensity;
    this.updateLightBuffer();
  }

  get retroPostProcessor() {
    return {
      setBloomThreshold: (v: number) => { this.bloomThreshold = v; },
      setBloomIntensity: (v: number) => { this.bloomIntensity = v; },
      setBloomMipLevels: (v: number) => { this.bloomMipLevels = Math.max(1, Math.min(5, Math.floor(v))); },
      setGrainAmount: (v: number) => { this.grainAmount = v; },
      setGamma: (v: number) => { this.gamma = v; },
      setCRTEnabled: (v: boolean) => { this.crtEnabled = v; },
      setColorOverflow: (v: number) => { this.crtColorOverflow = v; },
      setScanlinesStrength: (v: number) => { this.crtScanlinesStrength = v; },
      setMaskIntensity: (v: number) => { this.crtMaskIntensity = v; },
      setCurvatureAmount: (v: number) => { this.crtCurvatureAmount = v; },
      setVignetteAmount: (v: number) => { this.crtVignetteAmount = v; },
    };
  }
}
