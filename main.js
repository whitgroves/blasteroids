import * as utils from "./utils.js";
import { Game } from "./game.js";

console.log("Game audio used courtesy of freesound.org and the respective artists. \
For detailed attribution, view the README at https://github.com/whitgroves/blasteroids.");

const game = new Game();
const userEvent = utils.MOBILE ? 'touchend' : 'click';

const handleFullscreen = (event) => {
  if (!document.fullscreenElement) {
    utils.canvas.requestFullscreen()
      .then(() => {if (utils.MOBILE) screen.orientation.lock('landscape')})
      .catch(err => utils.MOBILE ? alert(err) : console.log(err));
    utils.resizeCanvas();
    if (game.new) utils.safeToggleAudio(utils.TITLE_BGM, 'playOnly');
    setTimeout(game.createBgStars, 100); // screen needs time to finish resizing
  }
  utils.canvas.removeEventListener(userEvent, handleFullscreen);
}
utils.canvas.addEventListener(userEvent, handleFullscreen);

addEventListener('fullscreenchange', (event) => {
  if (!document.fullscreenElement) {
    utils.canvas.addEventListener(userEvent, handleFullscreen);
    utils.safeToggleAudio(utils.TITLE_BGM, 'pauseOnly');
    if (!game.paused && !game.gameOver) game.handlePause();
  }
});

screen.orientation.addEventListener('change', (event) => {
  // if (utils.DEBUG) alert(`ScreenOrientation change: ${event.target.type}, ${event.target.angle}`);
  if (!game.paused && !game.gameOver) game.handlePause();
  utils.resizeCanvas();
  game.createBgStars();
})