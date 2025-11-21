/**
 * Discord Model Viewer - Main Entry Point
 *
 * Initializes the Discord Embedded App SDK and starts the model viewer.
 */

import { DiscordSDK } from '@discord/embedded-app-sdk';
import { DiscordModelViewer } from './DiscordModelViewer';

// Discord application client ID - replace with your actual client ID
const DISCORD_CLIENT_ID = '1431397918707028060';

let discordSdk: DiscordSDK | null = null;
let viewer: DiscordModelViewer | null = null;

async function setupDiscordSdk(): Promise<void> {
  const loadingEl = document.getElementById('loading');

  // Check if we're running inside Discord (frame_id will be in URL params)
  const urlParams = new URLSearchParams(window.location.search);
  if (!urlParams.has('frame_id')) {
    console.log('Running in standalone mode (not inside Discord)');
    if (loadingEl) {
      loadingEl.innerHTML = '<div class="spinner"></div><div>Initializing viewer...</div>';
    }
    return;
  }

  try {
    // Initialize Discord SDK
    discordSdk = new DiscordSDK(DISCORD_CLIENT_ID);

    if (loadingEl) {
      loadingEl.innerHTML = '<div class="spinner"></div><div>Connecting to Discord...</div>';
    }

    // Wait for SDK to be ready
    await discordSdk.ready();

    if (loadingEl) {
      loadingEl.innerHTML = '<div class="spinner"></div><div>Authenticating...</div>';
    }

    // Authorize with Discord
    const { code } = await discordSdk.commands.authorize({
      client_id: DISCORD_CLIENT_ID,
      response_type: 'code',
      state: '',
      prompt: 'none',
      scope: [
        'identify',
        'guilds',
      ],
    });

    // Exchange code for access token (you'll need a backend for this)
    // For now, we'll skip OAuth and just run the viewer
    console.log('Discord authorization code:', code);

    if (loadingEl) {
      loadingEl.innerHTML = '<div class="spinner"></div><div>Initializing viewer...</div>';
    }
  } catch (error) {
    console.warn('Discord SDK initialization failed:', error);
    // Continue without Discord SDK for local development
    if (loadingEl) {
      loadingEl.innerHTML = '<div class="spinner"></div><div>Initializing viewer (standalone mode)...</div>';
    }
  }
}

async function initViewer(): Promise<void> {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  if (!canvas) {
    showError('Canvas element not found');
    return;
  }

  viewer = new DiscordModelViewer(canvas);

  const success = await viewer.initialize();
  if (!success) {
    return; // Error already shown by viewer
  }

  // Set up keyboard handlers
  viewer.setupKeyboardHandlers();

  // Set up UI controls
  setupControls();

  // Start rendering
  viewer.start();
  console.log('Discord Model Viewer started');
}

function setupControls(): void {
  if (!viewer) return;

  // Model selection
  const modelSelect = document.getElementById('model-select') as HTMLSelectElement;
  if (modelSelect) {
    modelSelect.addEventListener('change', async (e) => {
      const target = e.target as HTMLSelectElement;
      await viewer!.loadModel(target.value);
    });
  }

  // Wireframe toggle
  const wireframeToggle = document.getElementById('wireframe-toggle') as HTMLInputElement;
  if (wireframeToggle) {
    wireframeToggle.addEventListener('change', () => {
      viewer!.setWireframe(wireframeToggle.checked);
    });
  }

  // Light direction sliders
  const lightAzimuthSlider = document.getElementById('light-azimuth-slider') as HTMLInputElement;
  const lightAzimuthValue = document.getElementById('light-azimuth-value');
  const lightElevationSlider = document.getElementById('light-elevation-slider') as HTMLInputElement;
  const lightElevationValue = document.getElementById('light-elevation-value');

  const updateLightDirection = () => {
    const azimuthDeg = lightAzimuthSlider ? parseInt(lightAzimuthSlider.value, 10) : 45;
    const elevationDeg = lightElevationSlider ? parseInt(lightElevationSlider.value, 10) : 45;
    const azimuthRad = (azimuthDeg * Math.PI) / 180;
    const elevationRad = (elevationDeg * Math.PI) / 180;
    viewer!.setLightDirection(azimuthRad, elevationRad);
  };

  if (lightAzimuthSlider) {
    lightAzimuthSlider.addEventListener('input', () => {
      const value = parseInt(lightAzimuthSlider.value, 10);
      if (lightAzimuthValue) {
        lightAzimuthValue.textContent = `${value}°`;
      }
      updateLightDirection();
    });
  }

  if (lightElevationSlider) {
    lightElevationSlider.addEventListener('input', () => {
      const value = parseInt(lightElevationSlider.value, 10);
      if (lightElevationValue) {
        lightElevationValue.textContent = `${value}°`;
      }
      updateLightDirection();
    });
  }

  // Light intensity slider
  const lightIntensitySlider = document.getElementById('light-intensity-slider') as HTMLInputElement;
  const lightIntensityValue = document.getElementById('light-intensity-value');
  if (lightIntensitySlider) {
    lightIntensitySlider.addEventListener('input', () => {
      const value = parseInt(lightIntensitySlider.value, 10) / 100;
      viewer!.setLightIntensity(value);
      if (lightIntensityValue) {
        lightIntensityValue.textContent = value.toFixed(1);
      }
    });
  }

  // Bloom parameter sliders
  const bloomThresholdSlider = document.getElementById('bloom-threshold-slider') as HTMLInputElement;
  const bloomThresholdValue = document.getElementById('bloom-threshold-value');
  if (bloomThresholdSlider) {
    bloomThresholdSlider.addEventListener('input', () => {
      const value = parseInt(bloomThresholdSlider.value, 10) / 100;
      viewer!.retroPostProcessor.setBloomThreshold(value);
      if (bloomThresholdValue) {
        bloomThresholdValue.textContent = value.toFixed(2);
      }
    });
  }

  const bloomIntensitySlider = document.getElementById('bloom-intensity-slider') as HTMLInputElement;
  const bloomIntensityValue = document.getElementById('bloom-intensity-value');
  if (bloomIntensitySlider) {
    bloomIntensitySlider.addEventListener('input', () => {
      const value = parseInt(bloomIntensitySlider.value, 10) / 100;
      viewer!.retroPostProcessor.setBloomIntensity(value);
      if (bloomIntensityValue) {
        bloomIntensityValue.textContent = value.toFixed(2);
      }
    });
  }

  // Bloom mip levels slider
  const bloomMipLevelsSlider = document.getElementById('bloom-mip-levels-slider') as HTMLInputElement;
  const bloomMipLevelsValue = document.getElementById('bloom-mip-levels-value');
  if (bloomMipLevelsSlider) {
    bloomMipLevelsSlider.addEventListener('input', () => {
      const value = parseInt(bloomMipLevelsSlider.value, 10);
      viewer!.retroPostProcessor.setBloomMipLevels(value);
      if (bloomMipLevelsValue) {
        bloomMipLevelsValue.textContent = value.toString();
      }
    });
  }

  const grainAmountSlider = document.getElementById('grain-amount-slider') as HTMLInputElement;
  const grainAmountValue = document.getElementById('grain-amount-value');
  if (grainAmountSlider) {
    grainAmountSlider.addEventListener('input', () => {
      const value = parseInt(grainAmountSlider.value, 10) / 1000;
      viewer!.retroPostProcessor.setGrainAmount(value);
      if (grainAmountValue) {
        grainAmountValue.textContent = value.toFixed(3);
      }
    });
  }

  const gammaSlider = document.getElementById('gamma-slider') as HTMLInputElement;
  const gammaValue = document.getElementById('gamma-value');
  if (gammaSlider) {
    gammaSlider.addEventListener('input', () => {
      const value = parseInt(gammaSlider.value, 10) / 10;
      viewer!.retroPostProcessor.setGamma(value);
      if (gammaValue) {
        gammaValue.textContent = value.toFixed(1);
      }
    });
  }

  // CRT toggle
  const crtEnabledToggle = document.getElementById('crt-enabled-toggle') as HTMLInputElement;
  if (crtEnabledToggle) {
    crtEnabledToggle.addEventListener('change', () => {
      viewer!.retroPostProcessor.setCRTEnabled(crtEnabledToggle.checked);
    });
  }

  // CRT parameter sliders
  const colorOverflowSlider = document.getElementById('color-overflow-slider') as HTMLInputElement;
  const colorOverflowValue = document.getElementById('color-overflow-value');
  if (colorOverflowSlider) {
    colorOverflowSlider.addEventListener('input', () => {
      const value = parseInt(colorOverflowSlider.value, 10) / 100;
      viewer!.retroPostProcessor.setColorOverflow(value);
      if (colorOverflowValue) {
        colorOverflowValue.textContent = value.toFixed(2);
      }
    });
  }

  const scanlinesSlider = document.getElementById('scanlines-slider') as HTMLInputElement;
  const scanlinesValue = document.getElementById('scanlines-value');
  if (scanlinesSlider) {
    scanlinesSlider.addEventListener('input', () => {
      const value = parseInt(scanlinesSlider.value, 10) / 100;
      viewer!.retroPostProcessor.setScanlinesStrength(value);
      if (scanlinesValue) {
        scanlinesValue.textContent = value.toFixed(2);
      }
    });
  }

  const maskIntensitySlider = document.getElementById('mask-intensity-slider') as HTMLInputElement;
  const maskIntensityValue = document.getElementById('mask-intensity-value');
  if (maskIntensitySlider) {
    maskIntensitySlider.addEventListener('input', () => {
      const value = parseInt(maskIntensitySlider.value, 10) / 100;
      viewer!.retroPostProcessor.setMaskIntensity(value);
      if (maskIntensityValue) {
        maskIntensityValue.textContent = value.toFixed(2);
      }
    });
  }

  const curvatureSlider = document.getElementById('curvature-slider') as HTMLInputElement;
  const curvatureValue = document.getElementById('curvature-value');
  if (curvatureSlider) {
    curvatureSlider.addEventListener('input', () => {
      const value = parseInt(curvatureSlider.value, 10) / 100;
      viewer!.retroPostProcessor.setCurvatureAmount(value);
      if (curvatureValue) {
        curvatureValue.textContent = value.toFixed(2);
      }
    });
  }

  const vignetteSlider = document.getElementById('vignette-slider') as HTMLInputElement;
  const vignetteValue = document.getElementById('vignette-value');
  if (vignetteSlider) {
    vignetteSlider.addEventListener('input', () => {
      const value = parseInt(vignetteSlider.value, 10) / 100;
      viewer!.retroPostProcessor.setVignetteAmount(value);
      if (vignetteValue) {
        vignetteValue.textContent = value.toFixed(2);
      }
    });
  }
}

function showError(message: string): void {
  const errorEl = document.getElementById('error-message');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
  }
  const loadingEl = document.getElementById('loading');
  if (loadingEl) {
    loadingEl.classList.add('hidden');
  }
}

// Main initialization
async function main(): Promise<void> {
  // Try to set up Discord SDK (will fail gracefully in development)
  await setupDiscordSdk();

  // Initialize and start the viewer
  await initViewer();
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (viewer) {
    viewer.stop();
  }
});
