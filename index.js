import * as utils from "./utils.js";
import { Game } from "./game.js";

console.log("Game audio used courtesy of freesound.org and the respective artists. \
For detailed attribution, view the README at https://github.com/whitgroves/blasteroids.");

document.getElementById("intro-text").innerText = `↓ ${(utils.MOBILE ? "tap" : "click")} to play ↓`;
document.getElementById("tagline").innerHTML = utils.randomChoice([
  `now with ${utils.randomInt(0, 255)}% more rng`,
  `the best thing since ${utils.randomChoice(["avocado toast", "taco tuesday", "energy bars", "pizza on a bagel", "hand sanitizer"])}`,
  utils.randomChoice([
    `"works on my machine" ¯\\_(ツ)_/¯`,
    `actually garbage`,
    `not affiliated with the 1987 sequel`,
  ])
]); // TODO - load these in from a text file

const game = new Game();
const userEvent = utils.MOBILE ? 'touchend' : 'click';
var wakeLock = null;

const handleFullscreen = (event) => {
  if (!document.fullscreenElement) {
    utils.canvas.requestFullscreen().then(() => {
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

addEventListener('fullscreenchange', async (event) => {
  if (!document.fullscreenElement) {
    utils.canvas.addEventListener(userEvent, handleFullscreen);
    if (game.new) utils.safeToggleAudio(utils.TITLE_BGM, 'pauseOnly');
    handleScreenChange();
    utils.canvas.style.borderWidth = "1px";
    if (wakeLock && !wakeLock.released) wakeLock.release().then(() => { 
      wakeLock = null; 
      // console.log('lock released'); 
    });
  } else if (utils.MOBILE && "wakeLock" in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request();
      // console.log('lock obtained');
    } catch (err) {
      console.log(err);
    }
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