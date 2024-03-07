import * as utils from "./utils.js";
import { Game } from "./game.js";

console.log("Game audio used courtesy of freesound.org and the respective artists. \
For detailed attribution, view the README at https://github.com/whitgroves/blasteroids.");

if (utils.DEBUG) {
  const arrival = Date.now();
  const expected = 2;
  var loaded = 0;
  const onFileLoaded = () => {
    loaded += 1;
    if (loaded >= expected) document.getElementById("intro-text").innerHTML = `↓ ${(utils.MOBILE ? "tap" : "click")} to play ↓`;
  }
  const onAudioEvent = (event) => { 
    if (utils.DEBUG) console.log(`AudioFile: ${event.target.id} | ` + 
                                 `WaitTime: ${((Date.now()-arrival)/1000).toFixed(3)}s | ` + 
                                 `Event: ${event.type} | ` +
                                 `NetworkState: ${event.target.networkState} | ` + 
                                 `ReadyState: ${event.target.readyState} | ` + 
                                 `BufferEnd: ${(event.target.duration ? event.target.buffered.end(0) : "NaN")}\n`);
    if (event.type === 'canplaythrough' && event.target.duration > (event.target.buffered.end(0) + 10)) onFileLoaded();
  }
  const debugAudio = (audioElement) => {
    if (!audioElement.duration || audioElement.duration > (audioElement.buffered.end(0) + 10)) { // 10s leeway
      audioElement.addEventListener("loadstart", onAudioEvent);
      audioElement.addEventListener("progress", onAudioEvent);
      audioElement.addEventListener("waiting", onAudioEvent);
      audioElement.addEventListener("stalled", onAudioEvent);
      audioElement.addEventListener("suspend", onAudioEvent);
      audioElement.addEventListener("canplay", onAudioEvent);
      audioElement.addEventListener("canplaythrough", onAudioEvent);
      audioElement.addEventListener("error", onAudioEvent);
      audioElement.addEventListener("emptied", onAudioEvent); // triggered on .load()
      if (audioElement.networkState < 2)  audioElement.load(); // force load for progress check; otherwise browser may wait
      else console.log(`${audioElement.id} already loading... | Audio Duration: ${audioElement.duration.toFixed(2)}s`);
    } else {
      console.log(`${audioElement.id} was pre-loaded | Audio Duration ${audioElement.duration.toFixed(2)}s`);
      onFileLoaded();
    }
  }
  debugAudio(utils.TITLE_BGM);
  debugAudio(utils.GAME_BGM);
}

document.getElementById("tagline").innerHTML = utils.randomChoice([
  `now with ${utils.randomInt(0, 255)}% more rng`,
  `the best thing since ${utils.randomChoice(["avocado toast", "taco tuesday", "energy bars", "pizza on a bagel", "microdosing",
                                              "hand sanitizer", "stuffed crust", "doomscrolling", "free nights and weekends"])}`,
  utils.randomChoice([
    `"works on my machine" ¯\\_(ツ)_/¯`,
    `actually garbage`,
    `not affiliated with the 1987 sequel`,
    `a byproduct of coffee and unemployment`,
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
      if (utils.DEBUG) console.log('lock released'); 
    });
  } else if (utils.MOBILE && "wakeLock" in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request();
      if (utils.DEBUG) console.log('lock obtained');
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