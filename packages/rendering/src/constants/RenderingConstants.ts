/**
 * Consolidated rendering constants.
 * Replaces 50+ magic numbers scattered throughout codebase.
 *
 * Epic RENDERING-05 Task 5.2
 *
 * @internal - Not for public API use
 * @packageDocumentation
 */

// ============================================================================
// Buffer Configuration
// ============================================================================

/** WebGPU uniform buffer alignment requirement (bytes) */
export const UNIFORM_BUFFER_ALIGNMENT = 256;

/** Default size for uniform buffer pool */
export const DEFAULT_UNIFORM_POOL_SIZE = 8192;

/** Maximum size for a single uniform buffer (64KB) */
export const MAX_UNIFORM_BUFFER_SIZE = 65536;

/** Minimum buffer size for pooling (256 bytes) */
export const MIN_POOLED_BUFFER_SIZE = 256;

/** Maximum buffer size for pooling (16MB) */
export const MAX_POOLED_BUFFER_SIZE = 16 * 1024 * 1024;

// ============================================================================
// Memory Management
// ============================================================================

/** Default VRAM budget for integrated GPUs (MB) */
export const DEFAULT_VRAM_BUDGET_MB = 256;

/** Default VRAM budget for discrete GPUs (MB) */
export const DISCRETE_VRAM_BUDGET_MB = 2048;

/** Bind group cache size (number of entries) */
export const BIND_GROUP_CACHE_SIZE = 1000;

/** Pipeline cache size (number of entries) */
export const PIPELINE_CACHE_SIZE = 500;

/** Shader cache size (number of entries) */
export const SHADER_CACHE_SIZE = 200;

/** Number of frames to keep unused buffers before cleanup */
export const BUFFER_CLEANUP_FRAME_THRESHOLD = 300;

// ============================================================================
// Instance Rendering
// ============================================================================

/** Power-of-2 bucket sizes for instance buffers */
export const INSTANCE_BUFFER_BUCKETS = [64, 128, 256, 512, 1024, 2048, 4096] as const;

/** Minimum instances to trigger instanced rendering (production) */
export const MIN_INSTANCE_THRESHOLD = 10;

/** Minimum instances for demos (lower for testing) */
export const MIN_INSTANCE_THRESHOLD_DEMO = 2;

/** Maximum instances per draw call */
export const MAX_INSTANCES_PER_DRAW = 1000;

/** Instance buffer alignment (bytes) */
export const INSTANCE_BUFFER_ALIGNMENT = 256;

// ============================================================================
// Shader Configuration
// ============================================================================

/** Default vertex shader entry point */
export const DEFAULT_VERTEX_ENTRY = 'vs_main';

/** Default fragment shader entry point */
export const DEFAULT_FRAGMENT_ENTRY = 'fs_main';

/** Default compute shader entry point */
export const DEFAULT_COMPUTE_ENTRY = 'compute_main';

/** Maximum shader source size (1MB) - security limit */
export const MAX_SHADER_SOURCE_SIZE = 1024 * 1024;

/** Maximum bind group index (WebGPU spec limit) */
export const MAX_BIND_GROUP_INDEX = 3;

/** Maximum binding index per group (WebGPU spec limit) */
export const MAX_BINDING_INDEX = 15;

// ============================================================================
// Performance Targets
// ============================================================================

/** Target frame time for 60 FPS (milliseconds) */
export const TARGET_FRAME_TIME_MS = 16.67;

/** Critical frame time threshold (30 FPS) */
export const CRITICAL_FRAME_TIME_MS = 33.33;

/** Maximum draw calls per frame (performance target) */
export const MAX_DRAW_CALLS_PER_FRAME = 1000;

/** Maximum draw calls per frame (critical limit) */
export const CRITICAL_MAX_DRAW_CALLS = 2000;

/** Target bind group cache hit rate (95%) */
export const TARGET_CACHE_HIT_RATE = 0.95;

/** Minimum acceptable cache hit rate (80%) */
export const MIN_CACHE_HIT_RATE = 0.80;

/** Target buffer pool reuse rate */
export const TARGET_POOL_REUSE_RATE = 0.90;

// ============================================================================
// Render Queue Configuration
// ============================================================================

/** Initial capacity for opaque queue */
export const OPAQUE_QUEUE_INITIAL_CAPACITY = 1000;

/** Initial capacity for transparent queue */
export const TRANSPARENT_QUEUE_INITIAL_CAPACITY = 100;

/** Depth sorting precision (bits for depth in sort key) */
export const DEPTH_SORT_PRECISION_BITS = 20;

/** Material hash bits in sort key */
export const MATERIAL_HASH_BITS = 12;

// ============================================================================
// Shadow Mapping
// ============================================================================

/** Shadow cascade count options */
export const SHADOW_CASCADE_COUNTS = [2, 3, 4] as const;

/** Default shadow cascade split lambda (logarithmic distribution) */
export const SHADOW_CASCADE_SPLIT_LAMBDA = 0.5;

/** Shadow map resolution options */
export const SHADOW_MAP_RESOLUTIONS = [512, 1024, 2048, 4096] as const;

/** Default shadow map resolution */
export const DEFAULT_SHADOW_MAP_RESOLUTION = 1024;

/** Default shadow bias for depth comparison */
export const DEFAULT_SHADOW_BIAS = 0.005;

/** Shadow map border size (pixels) */
export const SHADOW_MAP_BORDER = 2;

// ============================================================================
// Texture Configuration
// ============================================================================

/** Maximum texture dimension (WebGPU limit) */
export const MAX_TEXTURE_DIMENSION = 8192;

/** Maximum mip levels for textures */
export const MAX_TEXTURE_MIP_LEVELS = 14;

/** Default texture format for color targets */
export const DEFAULT_COLOR_FORMAT: GPUTextureFormat = 'bgra8unorm';

/** Default depth format */
export const DEFAULT_DEPTH_FORMAT: GPUTextureFormat = 'depth24plus';

/** Texture atlas default size */
export const DEFAULT_ATLAS_SIZE = 2048;

/** Texture atlas padding (pixels) */
export const ATLAS_PADDING = 2;

// ============================================================================
// Light Culling
// ============================================================================

/** Tile size for light culling (pixels) */
export const LIGHT_CULLING_TILE_SIZE = 16;

/** Maximum lights per tile */
export const MAX_LIGHTS_PER_TILE = 256;

/** Light index buffer size */
export const LIGHT_INDEX_BUFFER_SIZE = 1024 * 1024; // 1MB

// ============================================================================
// Device Recovery
// ============================================================================

/** Maximum recovery attempts before giving up */
export const MAX_RECOVERY_ATTEMPTS = 3;

/** Time to wait between recovery attempts (ms) */
export const RECOVERY_ATTEMPT_DELAY_MS = 1000;

/** Timeout for device lost detection (ms) */
export const DEVICE_LOSS_TIMEOUT_MS = 5000;

// ============================================================================
// Hash & Cache
// ============================================================================

/** FNV-1a prime constant (32-bit) */
export const FNV_PRIME = 0x01000193;

/** FNV-1a offset basis (32-bit) */
export const FNV_OFFSET_BASIS = 0x811c9dc5;

/** Cache key separator */
export const CACHE_KEY_SEPARATOR = '_';

// ============================================================================
// Validation & Debugging
// ============================================================================

/** Enable validation in development */
export const ENABLE_VALIDATION = process.env.NODE_ENV !== 'production';

/** Enable GPU timing queries */
export const ENABLE_GPU_TIMING = true;

/** Enable verbose logging */
export const ENABLE_VERBOSE_LOGGING = process.env.DEBUG === 'rendering';

/** Maximum errors to log before silencing */
export const MAX_ERROR_LOG_COUNT = 100;

// ============================================================================
// Resource Limits
// ============================================================================

/** Maximum number of bind groups */
export const MAX_BIND_GROUPS = 4;

/** Maximum bindings per bind group */
export const MAX_BINDINGS_PER_GROUP = 16;

/** Maximum vertex attributes */
export const MAX_VERTEX_ATTRIBUTES = 16;

/** Maximum vertex buffers */
export const MAX_VERTEX_BUFFERS = 8;

/** Maximum color attachments */
export const MAX_COLOR_ATTACHMENTS = 8;

// ============================================================================
// Batch Sizes
// ============================================================================

/** Default batch size for draw calls */
export const DEFAULT_BATCH_SIZE = 100;

/** Maximum batch size before forced flush */
export const MAX_BATCH_SIZE = 1000;

/** Batch merge distance threshold (world units) */
export const BATCH_MERGE_DISTANCE = 10.0;

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Shadow cascade count type
 */
export type ShadowCascadeCount = typeof SHADOW_CASCADE_COUNTS[number];

/**
 * Shadow map resolution type
 */
export type ShadowMapResolution = typeof SHADOW_MAP_RESOLUTIONS[number];

/**
 * Instance buffer bucket size type
 */
export type InstanceBufferBucket = typeof INSTANCE_BUFFER_BUCKETS[number];
