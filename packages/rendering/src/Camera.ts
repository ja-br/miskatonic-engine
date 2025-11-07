/**
 * Camera with perspective projection and view transformation
 */

export class Camera {
  // Position and orientation
  private position: [number, number, number] = [0, 0, 5];
  private target: [number, number, number] = [0, 0, 0];
  private up: [number, number, number] = [0, 1, 0];

  // Projection parameters
  private fov: number = 45; // degrees
  private aspect: number = 1.0;
  private near: number = 0.1;
  private far: number = 100.0;

  // Cached matrices
  private viewMatrix: Float32Array = new Float32Array(16);
  private projectionMatrix: Float32Array = new Float32Array(16);
  private viewProjectionMatrix: Float32Array = new Float32Array(16);
  private dirty: boolean = true;

  constructor(fov: number = 45, aspect: number = 1.0, near: number = 0.1, far: number = 100.0) {
    this.fov = fov;
    this.aspect = aspect;
    this.near = near;
    this.far = far;
    this.updateMatrices();
  }

  /**
   * Set camera position
   */
  setPosition(x: number, y: number, z: number): void {
    this.position = [x, y, z];
    this.dirty = true;
  }

  /**
   * Set camera target (look-at point)
   */
  setTarget(x: number, y: number, z: number): void {
    this.target = [x, y, z];
    this.dirty = true;
  }

  /**
   * Update aspect ratio (e.g., on window resize)
   */
  setAspect(aspect: number): void {
    this.aspect = aspect;
    this.dirty = true;
  }

  /**
   * Get view matrix
   */
  getViewMatrix(): Float32Array {
    if (this.dirty) this.updateMatrices();
    return this.viewMatrix;
  }

  /**
   * Get projection matrix
   */
  getProjectionMatrix(): Float32Array {
    if (this.dirty) this.updateMatrices();
    return this.projectionMatrix;
  }

  /**
   * Get combined view-projection matrix
   */
  getViewProjectionMatrix(): Float32Array {
    if (this.dirty) this.updateMatrices();
    return this.viewProjectionMatrix;
  }

  /**
   * Get camera position
   */
  getPosition(): [number, number, number] {
    return [...this.position];
  }

  /**
   * Update view and projection matrices
   */
  private updateMatrices(): void {
    // Update view matrix (look-at)
    this.lookAt(this.viewMatrix, this.position, this.target, this.up);

    // Update projection matrix (perspective)
    this.perspective(this.projectionMatrix, this.fov, this.aspect, this.near, this.far);

    // Compute view-projection matrix
    this.multiply(this.viewProjectionMatrix, this.projectionMatrix, this.viewMatrix);

    this.dirty = false;
  }

  /**
   * Create look-at view matrix
   */
  private lookAt(out: Float32Array, eye: [number, number, number], center: [number, number, number], up: [number, number, number]): void {
    const eyex = eye[0], eyey = eye[1], eyez = eye[2];
    const centerx = center[0], centery = center[1], centerz = center[2];
    const upx = up[0], upy = up[1], upz = up[2];

    // Forward vector
    let z0 = eyex - centerx;
    let z1 = eyey - centery;
    let z2 = eyez - centerz;
    let len = 1 / Math.sqrt(z0 * z0 + z1 * z1 + z2 * z2);
    z0 *= len;
    z1 *= len;
    z2 *= len;

    // Right vector (cross(up, forward))
    let x0 = upy * z2 - upz * z1;
    let x1 = upz * z0 - upx * z2;
    let x2 = upx * z1 - upy * z0;
    len = Math.sqrt(x0 * x0 + x1 * x1 + x2 * x2);
    if (!len) {
      x0 = 0; x1 = 0; x2 = 0;
    } else {
      len = 1 / len;
      x0 *= len;
      x1 *= len;
      x2 *= len;
    }

    // Up vector (cross(forward, right))
    let y0 = z1 * x2 - z2 * x1;
    let y1 = z2 * x0 - z0 * x2;
    let y2 = z0 * x1 - z1 * x0;

    out[0] = x0;
    out[1] = y0;
    out[2] = z0;
    out[3] = 0;
    out[4] = x1;
    out[5] = y1;
    out[6] = z1;
    out[7] = 0;
    out[8] = x2;
    out[9] = y2;
    out[10] = z2;
    out[11] = 0;
    out[12] = -(x0 * eyex + x1 * eyey + x2 * eyez);
    out[13] = -(y0 * eyex + y1 * eyey + y2 * eyez);
    out[14] = -(z0 * eyex + z1 * eyey + z2 * eyez);
    out[15] = 1;
  }

  /**
   * Create perspective projection matrix
   */
  private perspective(out: Float32Array, fovy: number, aspect: number, near: number, far: number): void {
    const f = 1.0 / Math.tan((fovy * Math.PI) / 180 / 2);
    const nf = 1 / (near - far);

    out[0] = f / aspect;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = f;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[10] = (far + near) * nf;
    out[11] = -1;
    out[12] = 0;
    out[13] = 0;
    out[14] = 2 * far * near * nf;
    out[15] = 0;
  }

  /**
   * Multiply two 4x4 matrices
   */
  private multiply(out: Float32Array, a: Float32Array, b: Float32Array): void {
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
}

/**
 * Orbit camera controller
 * Allows rotating the camera around a target point using mouse input
 */
export class OrbitControls {
  private camera: Camera;
  private canvas: HTMLCanvasElement;
  private radius: number = 5;
  private theta: number = 0; // azimuth angle
  private phi: number = Math.PI / 4; // elevation angle
  private isDragging: boolean = false;
  private lastX: number = 0;
  private lastY: number = 0;

  constructor(camera: Camera, canvas: HTMLCanvasElement) {
    this.camera = camera;
    this.canvas = canvas;
    this.setupEventListeners();
    this.updateCameraPosition();
  }

  private setupEventListeners(): void {
    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.canvas.addEventListener('mouseup', () => this.onMouseUp());
    this.canvas.addEventListener('mouseleave', () => this.onMouseUp());
    this.canvas.addEventListener('wheel', (e) => this.onWheel(e));
  }

  private onMouseDown(e: MouseEvent): void {
    this.isDragging = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.isDragging) return;

    const deltaX = e.clientX - this.lastX;
    const deltaY = e.clientY - this.lastY;

    this.theta -= deltaX * 0.01;
    this.phi -= deltaY * 0.01;

    // Clamp phi to avoid gimbal lock
    this.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this.phi));

    this.updateCameraPosition();

    this.lastX = e.clientX;
    this.lastY = e.clientY;
  }

  private onMouseUp(): void {
    this.isDragging = false;
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    this.radius += e.deltaY * 0.01;
    this.radius = Math.max(1, Math.min(20, this.radius));
    this.updateCameraPosition();
  }

  private updateCameraPosition(): void {
    const x = this.radius * Math.sin(this.phi) * Math.cos(this.theta);
    const y = this.radius * Math.cos(this.phi);
    const z = this.radius * Math.sin(this.phi) * Math.sin(this.theta);

    this.camera.setPosition(x, y, z);
    this.camera.setTarget(0, 0, 0);
  }
}
