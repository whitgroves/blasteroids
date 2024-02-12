import * as utils from "./utils.js";
import { Player, Asteroid, BigAsteroid, Comet, UFO, Upgrade } from "./gameobject.js";

console.log("Game audio used courtesy of freesound.org and the respective artists. \
For detailed attribution, view the README at https://github.com/whitgroves/blasteroids.");

const handleFullscreen = (event) => {
  if (!document.fullscreenElement) {
    utils.canvas.requestFullscreen(); //.catch(err => {})
    utils.resizeCanvas();
    utils.safeToggleAudio(utils.TITLE_BGM, 'playOnly');
    setTimeout(game.createBgStars, 100); // screen needs time to finish resizing
  }
  removeEventListener('click', handleFullscreen);
}
addEventListener('click', handleFullscreen);
addEventListener('fullscreenchange', (event) => {
  if (!document.fullscreenElement) {
    addEventListener('click', handleFullscreen);
    utils.safeToggleAudio(utils.TITLE_BGM, 'pauseOnly');
    if (game && !game.paused) game.handlePause();
  }
});

class Game {
  constructor() {
    // utils.safePlayAudio(utils.TITLE_BGM);
    this.new = true; // flag for game start text on first arrival
    this.lastTick = 0; // tracks ms since first arrival for deltaTime calcs
    if (utils.MOBILE) {
      this.waitingForDoubleTap = false;
      this.longPress = null;
      window.addEventListener('touchstart', this._handleTouchStart);
      window.addEventListener('touchend', this._handleTouchEnd);
    } else {
      window.addEventListener('keydown', this._handleKeyInput);
    }
    this.newGame();
    requestAnimationFrame(this.run);
  }
  _handleTouchStart = (event) => {
    event.preventDefault(); // block resize on double-tap
    if (!this.longPress) this.longPress = setTimeout((this.gameOver ? this.newGame : this.handlePause), utils.LTAP_TIMEOUT);
    if (!this.waitingForDoubleTap) {
      this.waitingForDoubleTap = true;
      setTimeout(() => { this.waitingForDoubleTap = false }, utils.DTAP_TIMEOUT);
    } else if (this.paused) { // recalibrate
      this.player.neutral = null; // neutral pos will reset on resume
      utils.safePlayAudio(utils.PAUSE_SFX); // audio cue
      // if (utils.DEBUG) alert('gyroscope will reset on resume');
    }
  }
  _handleTouchEnd = (event) => { // long press
    event.preventDefault();
    clearTimeout(this.longPress);
    this.longPress = null;
  }
  _handleKeyInput = (event) => {
    if (!this.gameOver && event.key === "Enter") {
       this.handlePause();
    } else if (this.gameOver && event.key === "Enter") {
      this.newGame();
    } else if (event.key === 'm') {
      utils.GAME_BGM.muted = utils.GAME_BGM && !utils.GAME_BGM.muted;
    }
  }
  handlePause = () => {
    this.paused = !this.paused;
    if (this.paused) {
      if (!this.new) { // the very first call should be silent
        utils.safePlayAudio(utils.PAUSE_SFX);
        utils.safeToggleAudio(utils.GAME_BGM);
      }
      clearTimeout(this.hazardTimer);
      this.pauseTime = Date.now();
      this.pauseText = this.createPauseText(); // it has a random message so we generate each time
    }
    else {
      if (this.new) { 
        this.hazardTimer = setTimeout(this.spawnHazard, Math.max(0, this.timeToImpact));
        utils.TITLE_BGM.muted = true; // explicitly muted over toggle because it's short and may not autoplay
      }
      else {
        this.lastTick += (Date.now() - this.pauseTime);
        this.spawnHazard();
      }
      utils.safePlayAudio(utils.PAUSE_SFX);
      utils.safeToggleAudio(utils.GAME_BGM);
      this.new = false;
    }
  }
  register = (gameObj) => {
    this.gameObjects.set(++this.nextObjectId, gameObj);
    return this.nextObjectId;
  }
  deregister = (objId) => { this.cleanupIds.push(objId) }
  cleanup = () => {
    this.cleanupIds.forEach((objId) => { this.gameObjects.delete(objId) });
    this.cleanupIds = [];
  }
  newGame = () => {
    if (this.jingle && !this.jingle.paused) { utils.safeToggleAudio(this.jingle); } // stop rank jingle ASAP on early reset
    utils.resizeCanvas(); // covering all bases
    this.deltaTime = 0;
    this.paused = false;
    this.pauseTime = null;
    this.gameOver = false;
    this.gameOverText = null;
    this.score = 0; //utils.DEBUG ? 250 : 0;
    this.shots = 0;
    this.hits = 0;
    this.rank = null;
    this.jingle = null; 
    this.gameObjects = new Map(); // clear stray asteroids before player spawns
    this.nextObjectId = -1; // will increment to 0 on first registration
    this.cleanupIds = [];
    this.player = new Player(this);
    this.timeToImpact = this.new ? 3000 : 2000;
    this.upgradeInPlay = false;
    this.createBgStars();
    if (this.new) { this.handlePause(); } // start in paused state so new users can see control scheme
    else {
      if (utils.GAME_BGM.paused) { utils.safePlayAudio(utils.GAME_BGM); } // restart after total fade out
      utils.GAME_BGM.volume = utils.GAME_BGM_VOL; // reset volume regardless
      this.hazardTimer = setTimeout(this.spawnHazard, this.timeToImpact);
    }
  }
  createBgStars = () => {
    this.bgStars = [];
    for (let i = 0; i < 1000; i++) { this.bgStars.push(new utils.Vector2(utils.randomVal(-utils.canvas.width, utils.canvas.width*2),
                                                                   utils.randomVal(-utils.canvas.height, utils.canvas.height*2))); }
  }
  spawnHazard = () => { // spawns a new hazard then queues the next one on a decreasing timer
    if (!this.gameOver) {
      if (utils.DEBUG) console.log('spawning hazard');
      let spawnClass = null;
      if (!this.upgradeInPlay && this.player.weapon.level < utils.MAX_WEAPON_LVL 
          && Math.floor(this.score * 0.0133) >= this.player.weapon.level) { // check every 75 points (* 0.0133)
        spawnClass = Upgrade;
        this.upgradeInPlay = true;
      } else if (this.score > 300) {
        spawnClass = utils.randomChoice([Asteroid, BigAsteroid, Comet, UFO, UFO, UFO]);
      } else if (this.score > 200) {
        spawnClass = utils.randomChoice([Asteroid, BigAsteroid, Comet, UFO]);
      } else if (this.score > 150) {
        spawnClass = utils.randomChoice([Asteroid, BigAsteroid, BigAsteroid, Comet, Comet]);
      } else if (this.score > 100) {
        spawnClass = utils.randomChoice([Asteroid, BigAsteroid, BigAsteroid, Comet]);
      } else if (this.score > 50) {
        spawnClass = utils.randomChoice([Asteroid, Asteroid, BigAsteroid, BigAsteroid, BigAsteroid, Comet]);
      } else if (this.score > 3) {
        spawnClass = utils.randomChoice([Asteroid, BigAsteroid]);
      } else {
        spawnClass = Asteroid;
      }
      new spawnClass(this, utils.randomSpawn()); // new utils.Vector2(x, y));
      if (this.timeToImpact > (utils.DEBUG ? 5000 : 1000)) { this.timeToImpact -= 25; }
      this.hazardTimer = setTimeout(this.spawnHazard, this.timeToImpact);
    }
  }
  checkAsteroidCollision = (collisionObj) => {
    for (const k of this.gameObjects.keys()) {
      let gameObj = this.gameObjects.get(k);
      if ('isHazard' in gameObj && Math.abs(collisionObj.loc.x-gameObj.loc.x) < gameObj.getRadius() && Math.abs(collisionObj.loc.y-gameObj.loc.y) < gameObj.getRadius()) {
        if (!gameObj.isUpgrade) collisionObj.destroy();
        gameObj.destroy();
        return true;
      }
    }
    return false;
  }
  createPauseText = () => {
    this.pauseText = [
      this.new ? 'BLASTEROIDS' : 'GAME PAUSED',
      (utils.MOBILE ? 'TILT' : 'SPACE') + ' TO BOOST',
      (utils.MOBILE ? 'TAP' : 'CLICK') + ' TO SHOOT',
      (utils.MOBILE ? 'LONG PRESS' : 'ENTER') + ' TO ' + (this.new ? 'START' : 'RESUME'),
      utils.DEBUG ? utils.BUILD : utils.randomChoice(['GOOD LUCK', 'GODSPEED', 'STAY SHARP', 'HAVE FUN', 'PUNCH IT', 'GET READY'])
    ]
  }
  rankPlayer = () => {
    let sharpshooter = (this.shots > 30 && this.hits >= this.shots * 0.7);
    let pacifist = (this.shots === 0);
    // D rank
    this.rank = 'D';
    let commentPool = ["MIX IT UP A LIL' BIT", 'STAY IN SCHOOL', 'I BELIEVE IN YOU',
                       'SKILL ISSUE', 'TRY HARDER', 'JUST SAY NO'];
    if (pacifist) commentPool = [(utils.MOBILE ? 'TAP' : 'CLICK') + ' TO SHOOT', 'DO A BARREL ROLL'];
    // C rank
    if (sharpshooter && this.score >= 30) {
      this.rank = 'C';
      commentPool = ['HEATING UP', "LET 'EM COOK"];
    }
    if (this.score >= 45) {
      this.rank = 'C';
      commentPool = pacifist ? ['NAILED IT', 'PHONE HOME'] 
                             : ['GOOD HUSTLE', 'NOT BAD', 'GETTING SOMEWHERE', 'MEDIUM WELL'];
    }
    // B rank
    if (sharpshooter && this.score >= 65) {
      this.rank = 'B';
      commentPool = ["NICE SHOOTIN' TEX", 'MORE COFFEE SIR?'];
    }
    if (this.score >= 90) {
      this.rank = 'B';
      commentPool = pacifist ? ['CHOSEN ONE', 'ZEN MODE', 'NAMASTE'] 
                             : ['VERY NICE', 'SOLID', 'RESPECT+', 'WELL DONE'];
    }
    // A (S) rank
    if (sharpshooter && this.score >= 180) {
      this.rank = 'A'; 
      commentPool = ['LOCKED IN', 'EAGLE EYE'];
    }
    if (this.score >= 270) {
      this.rank = 'A';
      commentPool = ['TOP NOTCH', 'EXCELLENT', 'A WINNER IS YOU', 'RARE'];
      if (sharpshooter || pacifist || this.score >= 1080) {
        this.rank = 'S';
        commentPool = pacifist ? ['ENLIGHTENED', 'WE COME IN PEACE', '哲人'] :
                  sharpshooter ? ['HOT SHOT', 'SHOW OFF', 'LEGEND']
                               : ['SEEK HELP', 'CHILL OUT', 'RAW'];
      }
    }
    this.gameOverText = [
      'GAME OVER',
      'SCORE: '+this.score,
      // 'ACC  : '+(this.shots > 0 ? 100*this.hits/this.shots : 0).toFixed(1)+'%',
      'RANK : '+this.rank,
      utils.randomChoice(commentPool), //comment,
      'THANKS FOR PLAYING',
      (utils.MOBILE ? 'LONG PRESS' : 'ENTER') + ' FOR NEW GAME'
    ]
  }
  update = () => { 
    if (!this.paused) { this.gameObjects.forEach((gameObj) => { gameObj.update() }); }
    if (this.gameOver) {
    clearTimeout(this.hazardTimer); // stop spawning new hazards
    if (this.gameObjects.length > 0) { this.gameObjects.forEach(obj => obj.destroy()); }
    // ^ there was a race condition where UFO._fire() could schedule a timeout that resolved after game over.
    // resetting the game too quickly reassigns this.gameObjects to a new Map(), but the old object stays
    // in memory. it never gets called to update or render, but since it keeps a reference to the current game, which
    // in a valid state (not game over and not paused), it can spawn projectiles indefinitely from its last location.
    // Long story long, all gameObjects now are explicitly destroyed on game over to prevent this.
    }
  }
  render = () => {
    utils.resizeCanvas(); // done each frame in case the window is resized
    utils.ctx.clearRect(0, 0, utils.canvas.width, utils.canvas.height);
    if (this.bgStars) {
      if (!this.gameOver && !this.paused) { // couldn't use _inBounds() since check is per-axis
        let moveX = 0 < this.player.loc.x && this.player.loc.x < utils.canvas.width;
        let moveY = 0 < this.player.loc.y && this.player.loc.y < utils.canvas.height;
        this.bgStars.forEach(point => { 
          if (moveX) { point.x -= this.player.vel.x * utils.PARALLAX; }
          if (moveY) { point.y -= this.player.vel.y * utils.PARALLAX; }
        });
      }
      utils.dotPoints(this.bgStars);
    }
    this.gameObjects.forEach((gameObj) => { gameObj.render() });
    let padding = utils.PADDING * utils.getScale() * (utils.MOBILE ? 5 : 1);
    let fontSize = utils.FONT_SIZE * utils.getScale();
    if (!this.new) utils.displayText(this.score, padding, padding + fontSize);
    if (this.paused) {
      if (!this.pauseText) this.createPauseText();
      utils.displayTextBox(this.pauseText, utils.canvas.width * 0.5, utils.canvas.height * 0.5);
    }
    if (this.gameOver) {
      if (!this.gameOverText) { // null text = first pass after game over; creating text will generate rank for sfx
        this.rankPlayer();
        switch(this.rank) {
          case 'D':
            this.jingle = (utils.JINGLE_RANK_D);
            break;
          case 'C':
            this.jingle = (utils.JINGLE_RANK_C);
            break;
          case 'B':
            this.jingle = (utils.JINGLE_RANK_B);
            break;
          case 'A':
            this.jingle = (utils.JINGLE_RANK_A);
            break;
          case 'S':
            this.jingle = (utils.JINGLE_RANK_S);
            break;
        }
        this.jingle.onended = (e) => { if (this.gameOver) { utils.safeToggleAudio(utils.GAME_BGM); } }; // resume bgm when done
        utils.safeToggleAudio(utils.GAME_BGM); // pause as late as possible to minimize audio gap
        utils.safePlayAudio(this.jingle);
      }
      if (utils.GAME_BGM.volume > 0.005) { utils.GAME_BGM.volume -= 0.0002; } // fade out
      else { 
        utils.GAME_BGM.volume = 0;
        utils.safeToggleAudio(utils.GAME_BGM); // after full fade out, pause flag is used to restart bgm
      }
      utils.displayTextBox(this.gameOverText, this.player.loc.x, this.player.loc.y);
    }
    if (utils.DEBUG && this.player.tilt) {
      utils.displayText('x:'+this.player.tilt.x.toFixed(2), padding, utils.canvas.height-fontSize*2);
      utils.displayText('y:'+this.player.tilt.y.toFixed(2), padding, padding + utils.canvas.height-fontSize);
    }
  } 
  run = (timestamp) => { // https://isaacsukin.com/news/2015/01/detailed-explanation-javascript-game-loops-and-timing
    if (!this.paused) {
      this.deltaTime += timestamp - this.lastTick;
      this.lastTick = timestamp;
      var updatesThisLoop = 0;
      while (this.deltaTime >= utils.TIME_STEP) {
        this.update();
        this.deltaTime -= utils.TIME_STEP;
        if (++updatesThisLoop > 251) { // if updates are taking too long, panic and bail
          console.log('...at the disco')
          this.deltaTime = 0;
          break;
        }
      }
    }
        this.cleanup();
    this.render();
    requestAnimationFrame(this.run);
  }
}

let game = new Game();