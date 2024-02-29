import * as utils from "./utils.js";
import { Game } from "./game.js";

console.log("Game audio used courtesy of freesound.org and the respective artists. \
For detailed attribution, view the README at https://github.com/whitgroves/blasteroids.");

document.getElementById("intro-text").innerText = `${(utils.MOBILE ? "tap" : "click")} below to play — game starts in fullscreen`;

const game = new Game();
const userEvent = utils.MOBILE ? 'touchend' : 'click';

const handleFullscreen = (event) => {
  if (!document.fullscreenElement) {
    utils.canvas.requestFullscreen()
      .then(() => {
        if (utils.MOBILE) screen.orientation.lock('landscape');
        utils.canvas.style.borderWidth = "0px";
      }).catch(err => utils.MOBILE ? alert(err) : console.log(err));
    utils.resizeCanvas();
    if (game.new) utils.safeToggleAudio(utils.TITLE_BGM, 'playOnly');
    setTimeout(game.createBgStars, 100); // screen needs time to finish resizing
  }
  utils.canvas.removeEventListener(userEvent, handleFullscreen);
}
utils.canvas.addEventListener(userEvent, handleFullscreen);

const handleScreenChange = () => {
  if (game.gameOver) {
    utils.safeToggleAudio(utils.GAME_BGM, 'pauseOnly');
    utils.safeToggleAudio(utils.JINGLE_RANK_D, 'pauseOnly');
    utils.safeToggleAudio(utils.JINGLE_RANK_C, 'pauseOnly');
    utils.safeToggleAudio(utils.JINGLE_RANK_B, 'pauseOnly');
    utils.safeToggleAudio(utils.JINGLE_RANK_A, 'pauseOnly');
    utils.safeToggleAudio(utils.JINGLE_RANK_S, 'pauseOnly');
  }
  else if (!game.paused) game.handlePause();
}

addEventListener('fullscreenchange', (event) => {
  if (!document.fullscreenElement) {
    utils.canvas.addEventListener(userEvent, handleFullscreen);
    if (game.new) utils.safeToggleAudio(utils.TITLE_BGM, 'pauseOnly');
    handleScreenChange();
    utils.canvas.style.borderWidth = "1px";
  }
});

screen.orientation.addEventListener('change', (event) => {
  handleScreenChange();
  utils.resizeCanvas();
  game.createBgStars();
});

addEventListener('visibilitychange', () => {
  if (document.visibilityState === "hidden") {
    if (game.new) utils.safeToggleAudio(utils.TITLE_BGM, 'pauseOnly');
    handleScreenChange();
  }
});