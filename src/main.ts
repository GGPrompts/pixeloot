import { boot } from './Game';

boot().then((game) => {
  console.log(
    `[pixeloot] renderer ready — ${game.app.renderer.width}x${game.app.renderer.height}`,
  );
});
