import * as utils from "./utils.js";

console.log("Game audio used courtesy of freesound.org and the respective artists. \
For detailed attribution, view the README at https://github.com/whitgroves/blasteroids.");

// load sfx
const TITLE_BGM = new Audio("./sfx/368770__furbyguy__8-bit-bass-lead.wav");
TITLE_BGM.volume = .3;

// attach one-time listener to handle fullscreen resize and then detach itself
const handleFullscreen = (event) => {
  if (!document.fullscreenElement) {
    utils.canvas.requestFullscreen(); //.catch(err => {})
    utils.resizeCanvas();
    utils.safeToggleAudio(TITLE_BGM, 'playOnly');
  }
  utils.canvas.removeEventListener('click', handleFullscreen);
}
utils.canvas.addEventListener('click', handleFullscreen);

// reattach listener if fullscreen is lost
addEventListener('fullscreenchange', (event) => {
  if (!document.fullscreenElement) {
    utils.canvas.addEventListener('click', handleFullscreen);
    utils.safeToggleAudio(TITLE_BGM, 'pauseOnly');
  }
});

// let game = new Game();