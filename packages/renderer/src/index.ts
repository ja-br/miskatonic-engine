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
    const diceSlider = document.getElementById('dice-slider') as HTMLInputElement;
    const rollBtn = document.getElementById('roll-btn');
    const resetBtn = document.getElementById('reset-btn');
    const diceSetsEl = document.getElementById('dice-sets');

    if (diceSlider) {
      diceSlider.addEventListener('input', () => {
        const sliderValue = parseInt(diceSlider.value, 10);
        // Convert to exponential: 0→1, 1→2, 2→4, 3→8, 4→16, 5→32, 6→64, 7→128
        const diceSets = Math.pow(2, sliderValue);
        demo.setDiceSets(diceSets);
        if (diceSetsEl) {
          diceSetsEl.textContent = diceSets.toString();
        }
      });
    }

    if (rollBtn) {
      rollBtn.addEventListener('click', () => {
        demo.manualRoll();
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        demo.reset();
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
