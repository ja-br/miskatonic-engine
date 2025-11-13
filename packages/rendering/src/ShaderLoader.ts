/**
 * ShaderLoader - Epic 3.9
 *
 * Loads shader source files with include resolution and preprocessing.
 *
 * Features:
 * - Async file loading (filesystem/URLs)
 * - Include directive resolution (#include)
 * - Circular dependency detection
 * - Source caching
 * - Variant generation (feature defines)
 *
 * Performance Targets:
 * - Include resolution: <1ms
 * - Variant generation: <10ms
 * - Hot-reload: <100ms
 */

/**
 * Shader source with metadata
 */
export interface ShaderSourceFile {
  path: string; // File path or URL
  source: string; // Raw source code
  includes: string[]; // List of included files
  type: 'vertex' | 'fragment' | 'common'; // Shader type
}

/**
 * Shader feature defines for variant generation
 */
export interface ShaderFeatures {
  lit?: boolean; // Lighting enabled
  skinned?: boolean; // Skeletal animation
  textured?: boolean; // Texture sampling
  normalMapped?: boolean; // Normal mapping
  instanced?: boolean; // Instance rendering
  alphaTested?: boolean; // Alpha testing
  transparent?: boolean; // Alpha blending
  [key: string]: boolean | undefined; // Custom features
}

/**
 * Shader loader configuration
 */
export interface ShaderLoaderConfig {
  basePath?: string; // Base path for shader files (default: 'src/shaders/')
  watchFiles?: boolean; // Enable file watching for hot-reload (default: false)
  cacheEnabled?: boolean; // Enable source caching (default: true)
  maxFileSize?: number; // Maximum file size in bytes (default: 1MB)
  maxIncludeDepth?: number; // Maximum include recursion depth (default: 10)
  maxCacheSize?: number; // Maximum number of cached files (default: 100)
}

/**
 * Loaded shader variant with resolved includes and defines
 */
export interface LoadedShader {
  vertexSource: string; // Preprocessed vertex shader source
  fragmentSource: string; // Preprocessed fragment shader source
  features: ShaderFeatures; // Applied features
  dependencies: string[]; // All included files (for hot-reload)
}

/**
 * ShaderLoader - Loads and preprocesses shader source files
 */
export class ShaderLoader {
  private basePath: string;
  private watchFiles: boolean;
  private cacheEnabled: boolean;
  private maxFileSize: number;
  private maxIncludeDepth: number;
  private maxCacheSize: number;

  // Source cache: path -> source
  private sourceCache = new Map<string, string>();

  // Loading promises to prevent race conditions
  private loadingPromises = new Map<string, Promise<string>>();

  // Watcher callback for hot-reload
  private watchCallback?: (path: string) => void;

  constructor(config: ShaderLoaderConfig = {}) {
    this.basePath = this.normalizePath(config.basePath ?? 'src/shaders/');
    this.watchFiles = config.watchFiles ?? false;
    this.cacheEnabled = config.cacheEnabled ?? true;
    this.maxFileSize = config.maxFileSize ?? 1024 * 1024; // 1MB default
    this.maxIncludeDepth = config.maxIncludeDepth ?? 10;
    this.maxCacheSize = config.maxCacheSize ?? 100;
  }

  /**
   * Load shader with variant generation
   *
   * @param vertexPath - Path to vertex shader
   * @param fragmentPath - Path to fragment shader
   * @param features - Feature defines for variant generation
   * @returns Loaded shader with preprocessed source
   */
  async load(
    vertexPath: string,
    fragmentPath: string,
    features: ShaderFeatures = {}
  ): Promise<LoadedShader> {
    const dependencies: string[] = [];

    // Load and preprocess vertex shader
    const vertexSource = await this.loadAndPreprocess(vertexPath, features, dependencies);

    // Load and preprocess fragment shader
    const fragmentSource = await this.loadAndPreprocess(fragmentPath, features, dependencies);

    return {
      vertexSource,
      fragmentSource,
      features,
      dependencies: Array.from(new Set(dependencies)), // Remove duplicates
    };
  }

  /**
   * Load shader source from file or URL
   *
   * @param path - File path or URL
   * @returns Raw shader source
   */
  async loadSource(path: string): Promise<string> {
    // Check cache first
    if (this.cacheEnabled) {
      const cached = this.sourceCache.get(path);
      if (cached !== undefined) {
        return cached;
      }
    }

    // Check for in-flight loading to prevent race conditions
    const inFlight = this.loadingPromises.get(path);
    if (inFlight) {
      return inFlight;
    }

    // Create loading promise
    const loadPromise = this.loadSourceInternal(path);
    this.loadingPromises.set(path, loadPromise);

    try {
      const source = await loadPromise;

      // Validate file size
      if (source.length > this.maxFileSize) {
        throw new Error(
          `Shader file too large: ${path} (${source.length} bytes, max ${this.maxFileSize})`
        );
      }

      // Cache source with LRU eviction
      if (this.cacheEnabled) {
        // Evict oldest if at capacity
        if (this.sourceCache.size >= this.maxCacheSize) {
          const firstKey = this.sourceCache.keys().next().value;
          this.sourceCache.delete(firstKey);
        }
        this.sourceCache.set(path, source);
      }

      return source;
    } finally {
      this.loadingPromises.delete(path);
    }
  }

  /**
   * Internal method to load source from file or URL
   */
  private async loadSourceInternal(path: string): Promise<string> {
    // Determine if path is URL or filesystem
    const isUrl = path.startsWith('http://') || path.startsWith('https://');

    if (isUrl) {
      // Load from URL
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(`Failed to load shader from URL: ${path} (${response.status})`);
      }
      return await response.text();
    } else {
      // Check if we're in Node.js environment
      if (typeof process === 'undefined' || !process.versions?.node) {
        throw new Error(
          `Cannot load shader from filesystem in browser: ${path}. Use URLs or bundle shaders.`
        );
      }

      // Load from filesystem (Node.js environment)
      try {
        const fs = await import('fs/promises');
        const fullPath = this.resolvePath(path);
        return await fs.readFile(fullPath, 'utf-8');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to load shader from file: ${path} - ${message}`);
      }
    }
  }

  /**
   * Load and preprocess shader with includes and defines
   *
   * @param path - Shader file path
   * @param features - Feature defines
   * @param dependencies - Output array of all included files
   * @returns Preprocessed shader source
   */
  private async loadAndPreprocess(
    path: string,
    features: ShaderFeatures,
    dependencies: string[]
  ): Promise<string> {
    // Track this file as a dependency
    dependencies.push(path);

    // Load raw source
    const source = await this.loadSource(path);

    // Resolve includes
    const withIncludes = await this.resolveIncludes(source, path, dependencies);

    // Apply feature defines
    const withDefines = this.applyDefines(withIncludes, features);

    return withDefines;
  }

  /**
   * Resolve #include directives
   *
   * Format: #include "path/to/file.glsl"
   *
   * Uses "include guards" - same file can be included multiple times but content only inlined once
   *
   * @param source - Shader source with includes
   * @param currentPath - Current file path (for relative includes)
   * @param dependencies - Output array of included files
   * @param depth - Current recursion depth (for limit checking)
   * @param processedIncludes - Set of already-processed includes (include guards)
   * @param recursionStack - Stack for circular dependency detection
   * @returns Source with includes resolved
   */
  private async resolveIncludes(
    source: string,
    currentPath: string,
    dependencies: string[],
    depth: number = 0,
    processedIncludes: Set<string> = new Set(),
    recursionStack: Set<string> = new Set()
  ): Promise<string> {
    // Check include depth limit
    if (depth > this.maxIncludeDepth) {
      throw new Error(
        `Maximum include depth exceeded (${this.maxIncludeDepth}). Possible circular dependency at: ${currentPath}`
      );
    }

    // Detect circular dependency in current call stack
    if (recursionStack.has(currentPath)) {
      throw new Error(
        `Circular include dependency detected: ${Array.from(recursionStack).join(' -> ')} -> ${currentPath}`
      );
    }

    recursionStack.add(currentPath);

    // Match #include "path" or #include <path>, but NOT in comments
    // Remove single-line comments first to avoid false matches
    const sourceWithoutComments = source.replace(/\/\/.*$/gm, '');
    const includeRegex = /#include\s+["<]([^">]+)[">]/g;

    // Find all includes
    const matches = Array.from(sourceWithoutComments.matchAll(includeRegex));

    if (matches.length === 0) {
      recursionStack.delete(currentPath);
      return source; // No includes, return as-is
    }

    // Process includes sequentially (maintain order)
    let result = source;

    for (const match of matches) {
      const includePath = match[1];
      const includeDirective = match[0];

      // Resolve relative path
      const resolvedPath = this.resolveIncludePath(includePath, currentPath);

      // Track dependency
      dependencies.push(resolvedPath);

      // Check if already processed (include guard)
      if (processedIncludes.has(resolvedPath)) {
        // Remove the include directive but don't inline content again
        result = result.replace(includeDirective, '// (already included: ' + resolvedPath + ')');
        continue;
      }

      // Mark as processed
      processedIncludes.add(resolvedPath);

      // Load included file
      const includedSource = await this.loadSource(resolvedPath);

      // Recursively resolve includes in the included file
      const processedInclude = await this.resolveIncludes(
        includedSource,
        resolvedPath,
        dependencies,
        depth + 1,
        processedIncludes,
        new Set(recursionStack) // Copy for this branch
      );

      // Replace include directive with processed content
      result = result.replace(includeDirective, processedInclude);
    }

    recursionStack.delete(currentPath);
    return result;
  }

  /**
   * Apply feature defines to shader source
   *
   * Generates #define directives based on features
   *
   * @param source - Shader source
   * @param features - Feature defines
   * @returns Source with defines prepended
   */
  private applyDefines(source: string, features: ShaderFeatures): string {
    const defines: string[] = [];

    // Generate #define for each enabled feature
    for (const [key, value] of Object.entries(features)) {
      if (value === true) {
        // Convert camelCase to UPPER_SNAKE_CASE
        const defineName = key.replace(/([A-Z])/g, '_$1').toUpperCase();
        defines.push(`#define ${defineName}`);
      }
    }

    if (defines.length === 0) {
      return source; // No defines, return as-is
    }

    // Prepend defines after #version directive
    const versionRegex = /^(#version\s+\d+\s+\w+)/m;
    const versionMatch = source.match(versionRegex);

    if (versionMatch) {
      // Insert defines after #version
      const versionLine = versionMatch[0];
      const defineBlock = '\n// Feature defines\n' + defines.join('\n') + '\n';
      return source.replace(versionRegex, versionLine + defineBlock);
    } else {
      // No #version, prepend defines at top
      const defineBlock = '// Feature defines\n' + defines.join('\n') + '\n\n';
      return defineBlock + source;
    }
  }

  /**
   * Resolve include path relative to current file
   *
   * @param includePath - Include path from directive
   * @param currentPath - Current file path
   * @returns Resolved absolute or relative path
   */
  private resolveIncludePath(includePath: string, currentPath: string): string {
    // If include path is absolute or URL, use as-is
    if (
      includePath.startsWith('/') ||
      includePath.startsWith('http://') ||
      includePath.startsWith('https://')
    ) {
      return includePath;
    }

    // If include starts with "common/", resolve relative to base shader directory
    // Otherwise, resolve relative to current file's directory
    if (includePath.startsWith('common/')) {
      return includePath;
    }

    // Resolve relative to current file's directory
    const currentDir = currentPath.substring(0, currentPath.lastIndexOf('/'));
    return currentDir ? `${currentDir}/${includePath}` : includePath;
  }

  /**
   * Normalize path to prevent traversal attacks
   *
   * @param path - Path to normalize
   * @returns Normalized path
   */
  private normalizePath(path: string): string {
    // Check if path starts with /
    const isAbsolute = path.startsWith('/');

    // Resolve . and .. segments
    const parts = path.split('/').filter(Boolean);
    const normalized: string[] = [];

    for (const part of parts) {
      if (part === '..') {
        normalized.pop();
      } else if (part !== '.') {
        normalized.push(part);
      }
    }

    let result = normalized.join('/');

    // Restore leading slash for absolute paths
    if (isAbsolute && !result.startsWith('/')) {
      result = '/' + result;
    }

    // Ensure trailing slash for directory paths
    if (path.endsWith('/') && !result.endsWith('/')) {
      result += '/';
    }

    return result;
  }

  /**
   * Resolve full path with base path and security validation
   *
   * @param path - Relative or absolute path
   * @returns Full path
   */
  private resolvePath(path: string): string {
    // Normalize the input path to prevent traversal
    const normalized = this.normalizePath(path);

    // Check for path traversal attempts
    if (normalized.includes('..')) {
      throw new Error(`Invalid path (path traversal detected): ${path}`);
    }

    // If absolute path, validate it's within allowed directory
    if (normalized.startsWith('/')) {
      // For absolute paths, ensure they're within a reasonable scope
      // (This is a safeguard - in production you'd want stricter controls)
      return normalized;
    }

    // Combine with base path
    const fullPath = `${this.basePath}${normalized}`;
    const normalizedFull = this.normalizePath(fullPath);

    // Ensure the resolved path is still within basePath
    if (!normalizedFull.startsWith(this.basePath)) {
      throw new Error(
        `Path escapes base directory: ${path} (resolved to ${normalizedFull}, base is ${this.basePath})`
      );
    }

    return normalizedFull;
  }

  /**
   * Clear source cache
   */
  clearCache(): void {
    this.sourceCache.clear();
  }

  /**
   * Enable file watching for hot-reload
   *
   * @param callback - Callback when file changes
   */
  async enableHotReload(callback: (path: string) => void): Promise<void> {
    if (!this.watchFiles) {
      this.watchFiles = true;
    }

    this.watchCallback = callback;

    // Setup file watcher (Node.js only)
    const chokidar = await import('chokidar');

    const watcher = chokidar.watch(`${this.basePath}**/*.{glsl,wgsl}`, {
      persistent: true,
      ignoreInitial: true,
    });

    watcher.on('change', (path: string) => {
      // Clear cache for changed file
      this.sourceCache.delete(path);

      // Notify callback
      if (this.watchCallback) {
        this.watchCallback(path);
      }
    });
  }

  /**
   * Generate cache key for shader variant
   *
   * @param vertexPath - Vertex shader path
   * @param fragmentPath - Fragment shader path
   * @param features - Feature defines
   * @returns Unique cache key
   */
  static generateCacheKey(
    vertexPath: string,
    fragmentPath: string,
    features: ShaderFeatures
  ): string {
    // Sort features for consistent key generation
    const sortedFeatures = Object.keys(features)
      .sort()
      .filter((key) => features[key] === true)
      .join(',');

    return `${vertexPath}:${fragmentPath}:${sortedFeatures}`;
  }
}
