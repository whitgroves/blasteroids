export const canvas = document.getElementById('game-content');
export const ctx = canvas.getContext('2d');

export const DEBUG = false; //JSON.parse(document.getElementById('debugFlag').text).isDebug;
export const BUILD = '2024.02.11';

// const USER_CONFIG = document.cookie.split(";");
// const safeGetSetting = (settingName) => {
//   let setting = USER_CONFIG.find((configSetting) => configSetting.startsWith(settingName));
//   return setting ? setting.split("=")[1] : "";
// }
// let newUser = (safeGetSetting("new_user") !== "false");

// mobile settings
export const MOBILE = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent); // https://stackoverflow.com/a/29509267/3178898
export const DTAP_TIMEOUT = 300;
export const LTAP_TIMEOUT = 500; // how long to wait for a long press
export const TILT_THRESH = 3;

let lastOrientation = screen.orientation.type;
if (MOBILE) {
  if (DEBUG) {addEventListener('error', (e) => { alert('Error: Ln: '+e.lineno+', Col: '+e.colno+': '+e.message); }); }
  // screen.orientation.lock('landscape');
  // document.body.requestFullscreen(); // fails if not called by UI element or orientation change // https://stackoverflow.com/q/62561844/3178898
}

// game settings
export const FPS = 60
export const TIME_STEP = 1000 / FPS;
// export const START_KEY = 'Enter';
export const SHAPE_FILL = '#000';
export const LINE_COLOR = '#FFF';
export const FONT_SIZE = MOBILE ? 45 : 30;
export const FONT_FAM = 'monospace';
export const PADDING = 10;
export const XSCALE_F = MOBILE ? 0.318 : 0.3225; // helps scale text box to font size
export const YSXALE_F = MOBILE ? 0.645 : 0.7143; // don't ask me why, it just works
export const PARALLAX = 0.3333                   // ratio for parallax effect
export const PAUSE_SFX = document.getElementById('pauseSfx');
PAUSE_SFX.volume = .4;
export const TITLE_BGM = document.getElementById('titleBgm');
TITLE_BGM.volume = .3;
export const GAME_BGM = document.getElementById('gameBgm');
export const GAME_BGM_VOL = .3; // used to restore default after bgm fade on game over
GAME_BGM.volume = GAME_BGM_VOL;
export const JINGLE_RANK_D = document.getElementById('rankSfx_D');
JINGLE_RANK_D.volume = .7;
export const JINGLE_RANK_C = document.getElementById('rankSfx_C');
JINGLE_RANK_C.volume = .5;
export const JINGLE_RANK_B = document.getElementById('rankSfx_B');
JINGLE_RANK_B.volume = .5;
export const JINGLE_RANK_A = document.getElementById('rankSfx_A');
JINGLE_RANK_A.volume = .4;
export const JINGLE_RANK_S = document.getElementById('rankSfx_S');
JINGLE_RANK_S.volume = .3;

// player
export const TRIANGLE = [0, (3 * Math.PI / 4), (5 * Math.PI / 4)];
export const PLAYER_R = MOBILE ? 20 : 16;     // radius
export const PLAYER_V = MOBILE ? 15 : 12;     // max vel
export const PLAYER_A = MOBILE ? 0.06 : 0.02; // acceleration
export const PLAYER_F = 0.02;                 // friction
export const PLAYER_C = '#AAA'                // player (and player projectile) color

// player weapon
export const MAX_WEAPON_LVL = 4;
export const OFFSET_RATIO = PLAYER_R * 0.35; // it just works
export const WEAPON_SFX = document.getElementById('weaponSfx');
WEAPON_SFX.volume = 0.25; // base audio is relatively loud

// projectile
export const PROJ_V = 1;  // velocity
export const PROJ_L = 10; // length

// hazard
export const BOOM_SFX_0 = document.getElementById('boomSfx_0');
BOOM_SFX_0.volume = 0.2;
export const BOOM_SFX_1 = document.getElementById('boomSfx_1');
BOOM_SFX_1.volume = 0.2;
export const BOOM_SFX_2 = document.getElementById('boomSfx_2');
BOOM_SFX_2.volume = 0.4;

// asteroid 
export const OCTAGON = [0, (Math.PI / 4), (Math.PI / 2), (3 * Math.PI / 4), Math.PI, (5 * Math.PI / 4), (3 * Math.PI / 2), (7 * Math.PI / 4)];
export const ROCK_R = PLAYER_R * 2;
export const ROCK_V = 0.3;
export const ROCK_C = '#FFF'

// big asteroid
export const BIGROCK_R = ROCK_R * 2

// upgrade
export const HEXAGON = [(Math.PI / 6), (Math.PI / 2), (5 * Math.PI / 6), (7 * Math.PI / 6), (3 * Math.PI / 2), (11 * Math.PI / 6)];
export const UPGRADE_R = PLAYER_R * 2.5
export const UPGRADE_V = 0.2;
export const UPGRADE_C = '#0F0';
export const UPGRADE_SFX_0 = document.getElementById('upgradeSfx_0');
export const UPGRADE_SFX_1 = document.getElementById('upgradeSfx_1');
UPGRADE_SFX_1.volume = .2;

// comet
export const PENTAGON = [0, (2 * Math.PI / 5), (4 * Math.PI / 5), (6 * Math.PI / 5), (8 * Math.PI / 5)];
export const COMET_C = '#FD0';
export const COMET_R = ROCK_R * 0.5;
export const COMET_V = ROCK_V * 2;
export const COMET_TA = 0.012; // per-frame turn amount (radians)
export const COMET_SFX_0 = document.getElementById('cometSfx_0');
COMET_SFX_0.volume = .5;
export const COMET_SFX_1 = document.getElementById('cometSfx_1');
COMET_SFX_1.volume = .3;

// ufo
export const UFO_R = PLAYER_R * 1.5;
export const UFO_V = ROCK_V * 0.67;
export const UFO_C = '#F00';
export const DIAMOND = [0, (2 * Math.PI / 3), (5 * Math.PI / 6), (7 * Math.PI / 6), (4 * Math.PI / 3)];
export const UFO_SFX_0 = document.getElementById('ufoSfx_0');
export const UFO_SFX_1 = document.getElementById('ufoSfx_1');
UFO_SFX_1.volume = .5;

// display
export const getScale = () => { return !MOBILE ? 1 : lastOrientation == 'portrait-primary' ? 0.8 : 0.35 }
export const getLineWidth = () => { return (!MOBILE ? 2 : lastOrientation == 'portrait-primary' ? 3 : 2.5) }
export const getWindowStyle = (attribute) => { return window.getComputedStyle(document.body).getPropertyValue(attribute).slice(0, -2) } // returns ~"30px" hence the slice
export const resizeCanvas = () => { // https://stackoverflow.com/questions/4037212/html-canvas-full-screen
  canvas.width = window.innerWidth - getWindowStyle('margin-left') - getWindowStyle('margin-right'); 
  canvas.height = window.innerHeight - getWindowStyle('margin-bottom') - getWindowStyle('margin-top');
}
export const tracePoints = (points, enclose=true, color=LINE_COLOR, fill=SHAPE_FILL) => { // points is an array of Vector2 (see below)
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = getLineWidth(); // lineWidth = 2 + ctx.fill() creates the psuedo-shading effect
  ctx.fillStyle = fill;
  if (enclose) ctx.moveTo(points[points.length-1].x, points[points.length-1].y);
  points.forEach(point => { ctx.lineTo(point.x, point.y) });
  ctx.stroke();
  ctx.fill();
  ctx.closePath();
}
export const dotPoints = (points, color=LINE_COLOR) => { // points is an array of Vector2 (see below)
  ctx.beginPath();
  ctx.fillStyle = color;
  points.forEach(point => { ctx.fillRect(point.x, point.y, getLineWidth(), getLineWidth()) }); // https://stackoverflow.com/a/7813282/3178898
  ctx.fill();
  ctx.closePath();
}
export const displayText = (text, x, y, color=LINE_COLOR) => {
  ctx.font = FONT_SIZE * getScale()+'px '+FONT_FAM;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}
export const displayTextBox = (textLines, x, y) => {
  let lineLengths = textLines.map((text) => text.length);
  let xscale = Math.max(...lineLengths) * FONT_SIZE * XSCALE_F * getScale();
  let yscale = textLines.length * FONT_SIZE * YSXALE_F * getScale();
  x = Math.max(xscale, Math.min(x, canvas.width-xscale-PADDING)); // keep box in-bounds
  y = Math.max(yscale, Math.min(y, canvas.height-yscale-PADDING));
  let xLeft = x - xscale;
  let xRight = x + xscale;
  let yTop = y - yscale;
  let yBottom = y + yscale;
  let box = [new Vector2(xLeft, yTop), new Vector2(xRight, yTop), new Vector2(xRight, yBottom), new Vector2(xLeft, yBottom)];
  ctx.fillStyle = '#000';
  ctx.fillRect(xLeft, yTop, xscale * 2, yscale * 2);
  tracePoints(box);
  for (let i = 0; i < textLines.length; i++) {
    displayText(textLines[i], xLeft+PADDING * getScale(), yTop+(FONT_SIZE+PADDING)*(i+1) * getScale());
  }
}
export const getColorChannels = (color) => { // "#FFF" -> "FF", "FF", "FF" -> [256, 256, 256]
  let _r = parseInt(color[1]+color[1], 16); 
  let _g = parseInt(color[2]+color[2], 16);
  let _b = parseInt(color[3]+color[3], 16);
  return [_r, _g, _b];
}
export const fadeColor = (color, alpha) => {
  return '#' + getColorChannels(color).map(channel => Math.floor(alpha * channel).toString(16))
                                      .map(channel => ('0' + channel).slice(-2)) // single-digit values overflow the final hex
                                      .reduce((a, b) => a + b);
}

// sfx
export const safePlayAudio = (audio) => {
  if (audio) { // make sure file is actually loaded first
    audio.pause(); // https://stackoverflow.com/q/14834520
    audio.currentTime = 0;
    audio.play(); // TODO: tie this into the fullscreen popup
  }
}
export const safeToggleAudio = (audio, mode='auto') => {
  if (audio) {
    if (audio.paused && mode !== 'pauseOnly') { 
      if (audio.ended) audio.currentTime = 0;
      audio.play();
    }
    else if (mode !== 'playOnly') { audio.pause() }
  }
}

// rng
export const randomChoice = (choices) => { return choices[Math.floor(Math.random() * choices.length)] }
export const randomVal = (min, max) => { return Math.random() * (max - min) + min } // output range is [min, max)
// randomInt = (min, max) => { return Math.floor(randomVal(Math.ceil(min), Math.floor(max + 1))) } // output range is [min, max]
export const randomSpawn = () => { // generates a random spawn point on the edge of the screen
  let x = null;
  let y = null;
  if (randomChoice([true, false])) { 
    x = randomChoice([0, canvas.width]);
    y = randomVal(0, canvas.height);
  } else {
    x = randomVal(0, canvas.width);
    y = randomChoice([0, canvas.height]);
  }
  return new Vector2(x, y);
}

export class Vector2 { // I know libraries for this exist but sometimes you want a scoop of vanilla
  constructor(x=0, y=0, scale=1) {
    this.set(x, y, scale);
  }
  set = (x, y, scale=1) => {
    this.x = x * scale;
    this.y = y * scale;
  }
  add = (x, y, scale=1) => {
    this.x += x * scale;
    this.y += y * scale;
  }
  apply = (func) => {
    this.x = func(this.x);
    this.y = func(this.y);
  }
  copy = (scale=1) => { return new Vector2(this.x, this.y, scale) } // TIL JS is sometimes pass by reference
}