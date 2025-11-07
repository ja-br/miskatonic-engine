import { BrowserWindow } from 'electron';
import { WindowState as IWindowState } from '@miskatonic/shared';

/**
 * Tracks and manages window state
 */
export class WindowState {
  private state: IWindowState;

  constructor(private window: BrowserWindow) {
    this.state = this.getCurrentState();
  }

  /**
   * Update the cached state from current window
   */
  update(): IWindowState {
    this.state = this.getCurrentState();
    return this.state;
  }

  /**
   * Get the current cached state
   */
  get(): IWindowState {
    return { ...this.state };
  }

  /**
   * Get current state directly from window
   */
  private getCurrentState(): IWindowState {
    const bounds = this.window.getBounds();
    return {
      isMaximized: this.window.isMaximized(),
      isMinimized: this.window.isMinimized(),
      isFullscreen: this.window.isFullScreen(),
      bounds: {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
      },
    };
  }
}
