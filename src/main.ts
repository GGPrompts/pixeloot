import { Application } from 'pixi.js';

async function main() {
  const app = new Application();

  await app.init({
    width: 1280,
    height: 720,
    backgroundColor: 0x1a1a2e,
    antialias: false,
    preference: 'webgpu',
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });

  document.body.appendChild(app.canvas);

  app.ticker.add((ticker) => {
    const dt = ticker.deltaTime;
    // game loop here
    void dt;
  });
}

main();
