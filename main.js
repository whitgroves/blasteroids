import * as utils from "./utils.js";
import { Game } from "./game.js";

console.log("Game audio used courtesy of freesound.org and the respective artists. \
For detailed attribution, view the README at https://github.com/whitgroves/blasteroids.");

const userEvent = utils.MOBILE ? 'touchend' : 'click';
const handleFullscreen = (event) => {
  if (!document.fullscreenElement) {
    utils.canvas.requestFullscreen()
      .then(() => {if (utils.MOBILE) screen.orientation.lock('landscape')})
      .catch(err => utils.MOBILE ? alert(err) : console.log(err));
    utils.resizeCanvas();
    utils.safeToggleAudio(utils.TITLE_BGM, 'playOnly');
    setTimeout(game.createBgStars, 100); // screen needs time to finish resizing
  }
  utils.canvas.removeEventListener(userEvent, handleFullscreen);
}
utils.canvas.addEventListener(userEvent, handleFullscreen);
addEventListener('fullscreenchange', (event) => {
  if (!document.fullscreenElement) {
    utils.canvas.addEventListener(userEvent, handleFullscreen);
    utils.safeToggleAudio(utils.TITLE_BGM, 'pauseOnly');
    if (game && !game.paused) game.handlePause();
  }
  
});

let game = new Game();