import * as utils from "./utils.js";
import { Game } from "./game.js";

console.log("Game audio used courtesy of freesound.org and the respective artists. \
For detailed attribution, view the README at https://github.com/whitgroves/blasteroids.");

const handleFullscreen = (event) => {
  if (!document.fullscreenElement) {
    utils.canvas.requestFullscreen(); //.catch(err => {})
    utils.resizeCanvas();
    utils.safeToggleAudio(utils.TITLE_BGM, 'playOnly');
    setTimeout(game.createBgStars, 100); // screen needs time to finish resizing
  }
  utils.canvas.removeEventListener('click', handleFullscreen);
}
utils.canvas.addEventListener('click', handleFullscreen);
addEventListener('fullscreenchange', (event) => {
  if (!document.fullscreenElement) {
    utils.canvas.addEventListener('click', handleFullscreen);
    utils.safeToggleAudio(utils.TITLE_BGM, 'pauseOnly');
    if (game && !game.paused) game.handlePause();
  }
});

let game = new Game();