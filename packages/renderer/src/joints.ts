/**
 * Joints Demo Entry Point
 */

import { JointsDemo } from './joints-demo';

// Initialize the demo when the page loads
window.addEventListener('DOMContentLoaded', async () => {
  console.log('Initializing Joints Demo...');

  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('Canvas element not found');
    return;
  }

  const demo = new JointsDemo(canvas);

  // Initialize and start the demo
  const success = await demo.initialize();
  if (!success) {
    console.error('Failed to initialize joints demo');
    return;
  }

  demo.start();

  // Setup motor controls
  const motorSpeedSlider = document.getElementById('motor-speed') as HTMLInputElement;
  const motorSpeedValue = document.getElementById('motor-speed-value');
  const motorForceSlider = document.getElementById('motor-force') as HTMLInputElement;
  const motorForceValue = document.getElementById('motor-force-value');

  if (motorSpeedSlider && motorSpeedValue) {
    motorSpeedSlider.addEventListener('input', () => {
      const speed = parseFloat(motorSpeedSlider.value);
      motorSpeedValue.textContent = speed.toFixed(1);
      demo.setMotorSpeed(speed);
    });
  }

  if (motorForceSlider && motorForceValue) {
    motorForceSlider.addEventListener('input', () => {
      const force = parseFloat(motorForceSlider.value);
      motorForceValue.textContent = force.toString();
      demo.setMotorForce(force);
    });
  }

  // Cleanup on window unload
  window.addEventListener('beforeunload', () => {
    demo.dispose();
  });

  console.log('Joints Demo started successfully');
});
