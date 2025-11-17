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

    // Bloom parameter sliders
    const bloomThresholdSlider = document.getElementById('bloom-threshold-slider') as HTMLInputElement;
    const bloomThresholdValue = document.getElementById('bloom-threshold-value');
    if (bloomThresholdSlider) {
      bloomThresholdSlider.addEventListener('input', () => {
        const value = parseInt(bloomThresholdSlider.value, 10) / 100; // 0-100 to 0.0-1.0
        demo.retroPostProcessor.setBloomThreshold(value);
        if (bloomThresholdValue) {
          bloomThresholdValue.textContent = value.toFixed(2);
        }
      });
    }

    const bloomIntensitySlider = document.getElementById('bloom-intensity-slider') as HTMLInputElement;
    const bloomIntensityValue = document.getElementById('bloom-intensity-value');
    if (bloomIntensitySlider) {
      bloomIntensitySlider.addEventListener('input', () => {
        const value = parseInt(bloomIntensitySlider.value, 10) / 100; // 0-200 to 0.0-2.0
        demo.retroPostProcessor.setBloomIntensity(value);
        if (bloomIntensityValue) {
          bloomIntensityValue.textContent = value.toFixed(2);
        }
      });
    }

    const grainAmountSlider = document.getElementById('grain-amount-slider') as HTMLInputElement;
    const grainAmountValue = document.getElementById('grain-amount-value');
    if (grainAmountSlider) {
      grainAmountSlider.addEventListener('input', () => {
        const value = parseInt(grainAmountSlider.value, 10) / 1000; // 0-100 to 0.0-0.1
        demo.retroPostProcessor.setGrainAmount(value);
        if (grainAmountValue) {
          grainAmountValue.textContent = value.toFixed(3);
        }
      });
    }

    const gammaSlider = document.getElementById('gamma-slider') as HTMLInputElement;
    const gammaValue = document.getElementById('gamma-value');
    if (gammaSlider) {
      gammaSlider.addEventListener('input', () => {
        const value = parseInt(gammaSlider.value, 10) / 10; // 10-30 to 1.0-3.0
        demo.retroPostProcessor.setGamma(value);
        if (gammaValue) {
          gammaValue.textContent = value.toFixed(1);
        }
      });
    }

    const bloomMipLevelsSlider = document.getElementById('bloom-mip-levels-slider') as HTMLInputElement;
    const bloomMipLevelsValue = document.getElementById('bloom-mip-levels-value');
    if (bloomMipLevelsSlider) {
      bloomMipLevelsSlider.addEventListener('input', () => {
        const value = parseInt(bloomMipLevelsSlider.value, 10); // 1-5
        demo.retroPostProcessor.setBloomMipLevels(value);
        if (bloomMipLevelsValue) {
          bloomMipLevelsValue.textContent = value.toString();
        }
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
