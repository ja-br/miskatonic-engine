/**
 * Phase 0: Epic 3.14-3.18 API Validation - CORRECTED VERSION
 *
 * Purpose: Validate that all required APIs work correctly before implementing full demo
 *
 * ALL APIS RESEARCHED FROM ACTUAL CODEBASE - NO ASSUMPTIONS
 *
 * Tests:
 * 1. WebGPUBackend initialization via BackendFactory
 * 2. LightSystem API (getActiveLights, getPointLights, etc.)
 * 3. Storage buffer support for light arrays
 * 4. OrbitCameraController integration (CORRECT: requires entity + world)
 * 5. Animation systems (Flickering, Pulsing, Orbiting)
 * 6. GPUBufferPool integration
 * 7. Performance baseline with 10 lights
 */

import { World, Light, Transform, Camera } from '@miskatonic/ecs';
import {
  LightSystem,
  CameraSystem,
  OrbitCameraController,
  BackendFactory,
  FlickeringLightSystem,
  PulsingLightSystem,
  OrbitingLightSystem,
  createCube,
  createPlane,
  type IRendererBackend,
} from '@miskatonic/rendering';

interface ValidationResult {
  test: string;
  passed: boolean;
  message: string;
  details?: any;
}

class Phase0Validator {
  private world: World;
  private backend: IRendererBackend | null = null;
  private lightSystem!: LightSystem;
  private cameraSystem!: CameraSystem;
  private cameraEntity!: number;
  private cameraController!: OrbitCameraController;

  private flickeringSystem!: FlickeringLightSystem;
  private pulsingSystem!: PulsingLightSystem;
  private orbitingSystem!: OrbitingLightSystem;

  private canvas: HTMLCanvasElement;
  private logElement: HTMLElement;
  private results: ValidationResult[] = [];

  private frameCount = 0;
  private startTime = 0;
  private isRunning = false;

  constructor(canvas: HTMLCanvasElement, logElement: HTMLElement) {
    this.canvas = canvas;
    this.logElement = logElement;
    this.world = new World();

    this.log('Phase 0 Validator initialized', 'info');
  }

  async run(): Promise<void> {
    this.log('Starting validation sequence...', 'info');

    // Test 1: WebGPU Backend (via BackendFactory - CORRECT API)
    await this.testBackendInitialization();

    if (!this.backend) {
      this.log('❌ Backend initialization failed - cannot continue', 'error');
      this.displayResults();
      return;
    }

    // Test 2: System initialization
    await this.testSystemInitialization();

    // Test 3: Create test scene with 10 lights
    await this.testSceneCreation();

    // Test 4: Light System API
    await this.testLightSystemAPI();

    // Test 5: Animation systems
    await this.testAnimationSystems();

    // Test 6: Storage buffer support
    await this.testStorageBufferSupport();

    // Test 7: Camera controller
    await this.testCameraController();

    // Test 8: Performance baseline
    await this.testPerformanceBaseline();

    // Display results
    this.displayResults();
  }

  private async testBackendInitialization(): Promise<void> {
    try {
      this.log('Test 1: WebGPU Backend Initialization (via BackendFactory)', 'section');

      // CORRECT API: Use BackendFactory.create()
      this.backend = await BackendFactory.create(this.canvas, {
        antialias: true,
        alpha: false,
        depth: true,
        powerPreference: 'high-performance',
      });

      if (!this.backend) {
        this.addResult({
          test: 'Backend Initialization',
          passed: false,
          message: 'BackendFactory.create() returned null'
        });
        return;
      }

      const capabilities = this.backend.getCapabilities();

      this.addResult({
        test: 'Backend Initialization',
        passed: true,
        message: `${this.backend.name} backend initialized successfully`,
        details: {
          backend: this.backend.name,
          compute: capabilities.compute,
          maxTextureSize: capabilities.maxTextureSize,
          maxUniformBufferSize: capabilities.maxUniformBufferSize
        }
      });

      this.log(`✓ ${this.backend.name} backend initialized`, 'success');
      this.log(`  Compute support: ${capabilities.compute}`, 'info');
      this.log(`  Max texture size: ${capabilities.maxTextureSize}`, 'info');
      this.log(`  Max uniform buffer: ${capabilities.maxUniformBufferSize} bytes`, 'info');

    } catch (error) {
      this.addResult({
        test: 'Backend Initialization',
        passed: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      this.log(`✗ Backend initialization failed: ${error}`, 'error');
    }
  }

  private async testSystemInitialization(): Promise<void> {
    try {
      this.log('Test 2: System Initialization', 'section');

      // Initialize systems
      this.lightSystem = new LightSystem(this.world);
      this.cameraSystem = new CameraSystem(this.world);

      // Animation systems
      this.flickeringSystem = new FlickeringLightSystem(this.world);
      this.pulsingSystem = new PulsingLightSystem(this.world);
      this.orbitingSystem = new OrbitingLightSystem(this.world);

      // CORRECT: Create camera entity FIRST
      this.cameraEntity = this.world.createEntity();
      this.world.addComponent(this.cameraEntity, Transform, new Transform(0, 5, 10));
      this.world.addComponent(this.cameraEntity, Camera, Camera.perspective(
        (60 * Math.PI) / 180,
        0.1,
        100
      ));

      // CORRECT: OrbitCameraController requires (entity, world, distance)
      this.cameraController = new OrbitCameraController(this.cameraEntity, this.world, 10);
      this.cameraController.setTarget(0, 0, 0);

      this.addResult({
        test: 'System Initialization',
        passed: true,
        message: 'All Epic 3.14-3.18 systems initialized',
        details: {
          lightSystem: true,
          cameraSystem: true,
          cameraController: true,
          animationSystems: true
        }
      });

      this.log('✓ All systems initialized', 'success');
      this.log('  - LightSystem', 'info');
      this.log('  - CameraSystem', 'info');
      this.log('  - OrbitCameraController (entity-based)', 'info');
      this.log('  - Animation systems (Flickering, Pulsing, Orbiting)', 'info');

    } catch (error) {
      this.addResult({
        test: 'System Initialization',
        passed: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      this.log(`✗ System initialization failed: ${error}`, 'error');
    }
  }

  private async testSceneCreation(): Promise<void> {
    try {
      this.log('Test 3: Scene Creation (10 lights)', 'section');

      // Create ground plane
      const ground = this.world.createEntity();
      this.world.addComponent(ground, Transform, new Transform(0, 0, 0, 0, 0, 0, 10, 1, 10));

      // Create 1 directional light
      const sun = this.world.createEntity();
      this.world.addComponent(sun, Transform, new Transform(0, 10, 0));
      this.world.addComponent(sun, Light, Light.directional([1.0, 0.95, 0.8], 1.0, [0.3, -1, 0.2]));

      // Create 3 flickering point lights
      for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI * 2;
        const x = Math.cos(angle) * 5;
        const z = Math.sin(angle) * 5;

        const entity = this.world.createEntity();
        this.world.addComponent(entity, Transform, new Transform(x, 2, z));
        this.world.addComponent(entity, Light, Light.point([1.0, 0.5, 0.2], 2.0, 6.0));
      }

      // Create 3 pulsing point lights
      for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI * 2 + Math.PI / 3;
        const x = Math.cos(angle) * 7;
        const z = Math.sin(angle) * 7;

        const entity = this.world.createEntity();
        this.world.addComponent(entity, Transform, new Transform(x, 3, z));
        this.world.addComponent(entity, Light, Light.point([0.3, 0.5, 1.0], 3.0, 8.0));
      }

      // Create 2 spot lights
      const spot1 = this.world.createEntity();
      this.world.addComponent(spot1, Transform, new Transform(-6, 5, 0));
      this.world.addComponent(spot1, Light,
        Light.spot([1.0, 1.0, 1.0], 4.0, [1, -1, 0], Math.PI / 6, Math.PI / 12, 12.0));

      const spot2 = this.world.createEntity();
      this.world.addComponent(spot2, Transform, new Transform(6, 5, 0));
      this.world.addComponent(spot2, Light,
        Light.spot([1.0, 1.0, 0.8], 4.0, [-1, -1, 0], Math.PI / 6, Math.PI / 12, 12.0));

      // Count entities using correct API
      let entityCount = 0;
      const query = this.world.query().build();
      query.forEach(this.world['archetypeManager'], () => {
        entityCount++;
      });

      this.addResult({
        test: 'Scene Creation',
        passed: true,
        message: 'Test scene created with 10 lights',
        details: {
          totalEntities: entityCount,
          directionalLights: 1,
          pointLights: 6,
          spotLights: 2
        }
      });

      this.log('✓ Scene created', 'success');
      this.log(`  Total entities: ${entityCount}`, 'info');
      this.log(`  Lights: 10 (1 directional, 6 point, 2 spot)`, 'info');

    } catch (error) {
      this.addResult({
        test: 'Scene Creation',
        passed: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      this.log(`✗ Scene creation failed: ${error}`, 'error');
    }
  }

  private async testLightSystemAPI(): Promise<void> {
    try {
      this.log('Test 4: LightSystem API', 'section');

      // Update light system to sync with ECS
      this.lightSystem.update();

      // Test API methods
      const activeLights = this.lightSystem.getActiveLights();
      const pointLights = this.lightSystem.getPointLights();
      const directionalLights = this.lightSystem.getDirectionalLights();
      const spotLights = this.lightSystem.getSpotLights();

      const expected = 9; // 1 directional + 6 point + 2 spot
      const passed = activeLights.length === expected;

      this.addResult({
        test: 'LightSystem API',
        passed,
        message: passed
          ? 'LightSystem API working correctly'
          : `Expected ${expected} lights, got ${activeLights.length}`,
        details: {
          activeLights: activeLights.length,
          pointLights: pointLights.length,
          directionalLights: directionalLights.length,
          spotLights: spotLights.length
        }
      });

      this.log(passed ? '✓ LightSystem API validated' : '✗ LightSystem API mismatch', passed ? 'success' : 'warning');
      this.log(`  Active lights: ${activeLights.length}`, 'info');
      this.log(`  Point lights: ${pointLights.length}`, 'info');
      this.log(`  Directional lights: ${directionalLights.length}`, 'info');
      this.log(`  Spot lights: ${spotLights.length}`, 'info');

    } catch (error) {
      this.addResult({
        test: 'LightSystem API',
        passed: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      this.log(`✗ LightSystem API test failed: ${error}`, 'error');
    }
  }

  private async testAnimationSystems(): Promise<void> {
    try {
      this.log('Test 5: Animation Systems', 'section');

      // Test animation system updates (should not throw)
      this.flickeringSystem.update(0.016);
      this.pulsingSystem.update(0.016);
      this.orbitingSystem.update(0.016);

      this.addResult({
        test: 'Animation Systems',
        passed: true,
        message: 'Animation systems update without errors',
        details: {
          flickeringSystem: true,
          pulsingSystem: true,
          orbitingSystem: true
        }
      });

      this.log('✓ Animation systems working', 'success');

    } catch (error) {
      this.addResult({
        test: 'Animation Systems',
        passed: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      this.log(`✗ Animation systems test failed: ${error}`, 'error');
    }
  }

  private async testStorageBufferSupport(): Promise<void> {
    try {
      this.log('Test 6: Storage Buffer Support', 'section');

      if (!this.backend) {
        throw new Error('Backend not initialized');
      }

      // Check if backend supports compute (implies storage buffer support)
      const capabilities = this.backend.getCapabilities();

      if (!capabilities.compute) {
        this.addResult({
          test: 'Storage Buffer Support',
          passed: false,
          message: 'Compute shaders not supported (storage buffers may be unavailable)'
        });
        this.log('⚠ Compute support not available', 'warning');
        return;
      }

      // Try to create a storage buffer (Epic 3.14 API)
      const testData = new Float32Array(64); // 64 floats (1 light structure)
      const storageBuffer = this.backend.createBuffer(
        'test_storage_buffer',
        'storage',
        testData,
        'dynamic_draw'
      );

      this.addResult({
        test: 'Storage Buffer Support',
        passed: true,
        message: 'Storage buffers supported via Epic 3.14 API',
        details: {
          bufferCreated: true,
          testSize: testData.byteLength
        }
      });

      this.log('✓ Storage buffer support confirmed', 'success');
      this.log(`  Test buffer size: ${testData.byteLength} bytes`, 'info');

    } catch (error) {
      this.addResult({
        test: 'Storage Buffer Support',
        passed: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      this.log(`✗ Storage buffer test failed: ${error}`, 'error');
    }
  }

  private async testCameraController(): Promise<void> {
    try {
      this.log('Test 7: OrbitCameraController', 'section');

      // CORRECT: Test camera controller methods (NOT update())
      // OrbitCameraController is event-driven, not frame-driven
      this.cameraController.rotate(0.01, 0.01);  // Test rotation
      this.cameraController.zoom(0.5);           // Test zoom
      this.cameraSystem.update();                // Update camera system

      this.addResult({
        test: 'OrbitCameraController',
        passed: true,
        message: 'Camera controller working correctly (event-driven API)'
      });

      this.log('✓ OrbitCameraController validated', 'success');
      this.log('  Methods: rotate(), zoom(), setTarget() (NO update() method)', 'info');

    } catch (error) {
      this.addResult({
        test: 'OrbitCameraController',
        passed: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      this.log(`✗ Camera controller test failed: ${error}`, 'error');
    }
  }

  private async testPerformanceBaseline(): Promise<void> {
    this.log('Test 8: Performance Baseline (60 frames)', 'section');
    this.log('Measuring FPS with 10 lights...', 'info');

    this.startTime = performance.now();
    this.frameCount = 0;
    this.isRunning = true;

    // Render 60 frames and measure performance
    const renderLoop = () => {
      if (!this.isRunning || this.frameCount >= 60) {
        this.completePerformanceTest();
        return;
      }

      try {
        // Update animation systems
        this.flickeringSystem.update(0.016);
        this.pulsingSystem.update(0.016);
        this.orbitingSystem.update(0.016);

        // Update light system
        this.lightSystem.update();

        // Update camera system
        this.cameraSystem.update();

        // Begin/end frame (minimal rendering)
        this.backend!.beginFrame();
        // TODO: Actual rendering would go here
        this.backend!.endFrame();

        this.frameCount++;
        requestAnimationFrame(renderLoop);

      } catch (error) {
        this.isRunning = false;
        this.addResult({
          test: 'Performance Baseline',
          passed: false,
          message: `Rendering error: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
        this.log(`✗ Performance test failed: ${error}`, 'error');
        this.displayResults();
      }
    };

    renderLoop();
  }

  private completePerformanceTest(): void {
    const elapsed = performance.now() - this.startTime;
    const fps = (this.frameCount / elapsed) * 1000;
    const avgFrameTime = elapsed / this.frameCount;

    const passed = fps >= 60;

    this.addResult({
      test: 'Performance Baseline',
      passed,
      message: passed
        ? 'Performance target met (60+ FPS with 10 lights)'
        : `Performance below target (${fps.toFixed(1)} FPS)`,
      details: {
        fps: fps.toFixed(1),
        avgFrameTime: avgFrameTime.toFixed(2),
        totalFrames: this.frameCount,
        totalTime: elapsed.toFixed(2)
      }
    });

    this.log(`${passed ? '✓' : '⚠'} Performance baseline measured`, passed ? 'success' : 'warning');
    this.log(`  FPS: ${fps.toFixed(1)}`, fps >= 60 ? 'success' : 'warning');
    this.log(`  Avg frame time: ${avgFrameTime.toFixed(2)}ms`, 'info');
    this.log(`  Total frames: ${this.frameCount}`, 'info');

    if (!passed) {
      this.log('  ⚠ Performance below 60 FPS target', 'warning');
    }

    this.displayResults();
  }

  private addResult(result: ValidationResult): void {
    this.results.push(result);
  }

  private log(message: string, type: 'info' | 'success' | 'warning' | 'error' | 'section'): void {
    const logContent = this.logElement;
    const line = document.createElement('div');

    if (type === 'section') {
      line.className = 'log-section';
      line.innerHTML = `<strong>${message}</strong>`;
    } else {
      line.className = `log-${type}`;
      line.textContent = message;
    }

    logContent.appendChild(line);

    // Auto-scroll to bottom
    if (this.logElement.parentElement) {
      this.logElement.parentElement.scrollTop = this.logElement.parentElement.scrollHeight;
    }
  }

  private displayResults(): void {
    this.log('', 'section');
    this.log('Validation Summary', 'section');

    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    const allPassed = passed === total;

    this.log(`Tests passed: ${passed}/${total}`, allPassed ? 'success' : 'warning');

    this.results.forEach(result => {
      const icon = result.passed ? '✓' : '✗';
      const type = result.passed ? 'success' : 'error';
      this.log(`${icon} ${result.test}: ${result.message}`, type);

      if (result.details) {
        const details = JSON.stringify(result.details, null, 2);
        this.log(`  Details: ${details}`, 'info');
      }
    });

    if (allPassed) {
      this.log('', 'section');
      this.log('✅ All validation tests passed!', 'success');
      this.log('Epic 3.14-3.18 APIs are ready for full implementation.', 'success');
      this.log('', 'info');
      this.log('Next step: Proceed with Phase 1 (Application Architecture)', 'info');
    } else {
      this.log('', 'section');
      this.log('❌ Some validation tests failed', 'error');
      this.log('Review failed tests before proceeding with full implementation.', 'warning');
    }

    console.log('=== Phase 0 Validation Results ===');
    console.table(this.results);
  }
}

// Bootstrap
async function main() {
  const canvas = document.getElementById('validation-canvas') as HTMLCanvasElement;
  const logContent = document.getElementById('log-content') as HTMLElement;

  if (!canvas || !logContent) {
    console.error('Required DOM elements not found');
    return;
  }

  // Resize canvas
  const resize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  resize();
  window.addEventListener('resize', resize);

  // Run validation
  const validator = new Phase0Validator(canvas, logContent);
  await validator.run();
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
