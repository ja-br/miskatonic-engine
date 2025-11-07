/**
 * Renderer process entry point
 */

import { Demo } from './demo';
import { ipcService } from './ipc/IPCService';

// Extend Window interface for type-safe debugging
declare global {
  interface Window {
    __MISKATONIC_DEBUG__?: {
      ipcService: typeof ipcService;
      demo?: Demo;
    };
  }
}

// Display welcome message
console.log('%cMiskatonic Engine', 'font-size: 24px; font-weight: bold; color: #4CAF50');
console.log('Version: 0.1.0');
console.log('Environment:', process.env.NODE_ENV);

// Initialize 3D demo when DOM is ready
window.addEventListener('DOMContentLoaded', async () => {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('Canvas element not found');
    return;
  }

  const demo = new Demo(canvas);
  const success = await demo.initialize();

  if (success) {
    console.log('3D Demo initialized successfully');
    demo.start();

    // Wire up UI controls
    const minusBtn = document.getElementById('minus-btn');
    const plusBtn = document.getElementById('plus-btn');
    const rollBtn = document.getElementById('roll-btn');
    const diceSetsEl = document.getElementById('dice-sets');

    if (minusBtn) {
      minusBtn.addEventListener('click', () => {
        demo.decrementDiceSets();
        if (diceSetsEl) {
          diceSetsEl.textContent = demo.getDiceSets().toString();
        }
      });
    }

    if (plusBtn) {
      plusBtn.addEventListener('click', () => {
        demo.incrementDiceSets();
        if (diceSetsEl) {
          diceSetsEl.textContent = demo.getDiceSets().toString();
        }
      });
    }

    if (rollBtn) {
      rollBtn.addEventListener('click', () => {
        demo.manualRoll();
      });
    }

    // Make demo available for debugging
    if (process.env.NODE_ENV === 'development') {
      window.__MISKATONIC_DEBUG__ = {
        ipcService,
        demo,
      };
    }
  } else {
    console.error('Failed to initialize 3D demo');
  }
});
