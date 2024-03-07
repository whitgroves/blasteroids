import * as utils from "./utils.js";
import { Player, Asteroid, Comet, UFO, Upgrade } from "./gameobject.js";

export class Game {

  constructor() {
    this.new = true; // flag for game start text on first arrival
    this.lastTick = 0; // tracks ms since first arrival for deltaTime
    this.scrollPct = 0; // used to interpolate bg scroll based on timeToImpact
    if (utils.MOBILE) {
      this.waitingForDoubleTap = false;
      this.longPress = null;
      window.addEventListener('touchstart', this._handleTouchStart);
      window.addEventListener('touchend', this._handleTouchEnd);
    } else {
      window.addEventListener('keydown', this._handleKeyInput);
      window.addEventListener('click', this._handleClick);
    }
    this.newGame(); // possible bug
    requestAnimationFrame(this.run);
  }

  _handleTouchStart = (event) => {
    this.lastTapTime = Date.now();
    this.lastTap = new utils.Vector2(event.touches[0].clientX, event.touches[0].clientY);
    this.longPress = this.longPress || setTimeout((this.gameOver ? this.newGame : this.handlePause), utils.LTAP_TIMEOUT);
    if (!this.waitingForDoubleTap) {
      this.waitingForDoubleTap = true;
      setTimeout(() => { this.waitingForDoubleTap = false }, utils.DTAP_TIMEOUT);
    } else if (!this.gameOver && this.paused && !this.new) { // recalibrate
      this.player.neutral = null; // neutral pos will reset on resume
      utils.safePlayAudio(utils.PAUSE_SFX); // audio cue
    }
  }

  _handleTouchEnd = (event) => { // long press
    clearTimeout(this.longPress);
    this.longPress = null;
    this.lastTap = null;
    this.lastTapTime = null;
  }

  _handleKeyInput = (event) => {
    if (document.fullscreenElement) {
      if (!this.gameOver && (event.key === "Enter" || (event.key === ' ' && this.paused))) {
        this.handlePause();
      } else if (this.canRestart && (event.key === "Enter" || event.key === ' ')) {
        this.newGame();
      } else if (event.key === 'm') {
        utils.GAME_BGM.muted = utils.GAME_BGM && !utils.GAME_BGM.muted;
      }
    }
  }

  _handleClick = (event) => {
    if (document.fullscreenElement) {
      if (!this.gameOver && this.paused) this.handlePause();
      else if (this.canRestart) this.newGame();
    }
  }

  handlePause = () => {
    let alreadyPaused = this.paused;
    this.paused = !this.paused || !document.fullscreenElement;
    if (this.paused && !alreadyPaused) {
      if (!this.new) { // the very first call should be silent
        utils.safePlayAudio(utils.PAUSE_SFX);
        utils.safeToggleAudio(utils.GAME_BGM, 'pauseOnly');
      }
      clearTimeout(this.hazardTimer);
      this.pauseTime = Date.now();
      this.pauseText = this.createPauseText(); // it has a random message so we generate each time
      this.player.deregisterInputs();
    } else if (document.fullscreenElement) {
      this.lastTick += (Date.now() - this.pauseTime);
      if (this.new) {
        utils.safeToggleAudio(utils.TITLE_BGM, 'pauseOnly');
        this.hazardTimer = setTimeout(this.spawnHazard, Math.max(0, this.timeToImpact));
        this.new = false;
      } else {
        this.spawnHazard();
      }
      utils.safePlayAudio(utils.PAUSE_SFX);
      utils.safeToggleAudio(utils.GAME_BGM, 'playOnly');
      this.player.registerInputs();
    }
  }

  register = (gameObj) => {
    this.gameObjects.set(++this.nextObjectId, gameObj);
    return this.nextObjectId;
  }

  deregister = (objId) => {
    this.cleanupIds.push(objId);
  }

  cleanup = () => {
    this.cleanupIds.forEach((objId) => { this.gameObjects.delete(objId) });
    this.cleanupIds = [];
  }

  newGame = () => {
    if (this.jingle && !this.jingle.paused) utils.safeToggleAudio(this.jingle); // stop rank jingle on early reset
    this.canRestart = false;
    utils.resizeCanvas(); // covering all bases
    this.deltaTime = 0;
    this.paused = false;
    this.pauseTime = null;
    this.gameOver = false;
    this.gameOverText = null;
    this.timeToImpact = this.getStartingTimeToImpact(); // must precede score reset
    this.score = utils.DEBUG ? 60 : 0;
    this.shots = 0;
    this.hits = 0;
    this.rank = null;
    this.jingle = null; 
    this.gameObjects = new Map(); // clear stray asteroids before player spawns
    this.nextObjectId = -1; // will increment to 0 on first registration
    this.cleanupIds = [];
    this.player = new Player(this);
    this.upgradeInPlay = false;
    if (!this.bgStars) this.createBgStars();
    if (this.new) this.handlePause(); 
    else {
      if (utils.GAME_BGM.volume === 0) utils.safePlayAudio(utils.GAME_BGM);
      else utils.safeToggleAudio(utils.GAME_BGM, 'playOnly');
      utils.GAME_BGM.volume = utils.GAME_BGM_VOL; // reset volume from fade out
      this.hazardTimer = setTimeout(this.spawnHazard, this.timeToImpact);
      this.player.registerInputs();
    }
  }

  getStartingTimeToImpact = () => {
    return this.new ? 2000 : Math.max(utils.HAZARD_MIN_MS, 2000-this.score); // higher score = faster start
  }

  createBgStars = () => {
    this.bgStars = [];
    this.bgStars2 = [];
    this.bgStars3 = [];
    for (let i = 0; i < 1000; i++) {
      //this.bgStars.push(
      let star = new utils.Vector2(utils.randomVal(-utils.canvas.width, utils.canvas.width*2),
                                   utils.randomVal(-utils.canvas.height, utils.canvas.height*2)); //);
      let layer = utils.randomChoice([this.bgStars, this.bgStars2, this.bgStars3]);
      layer.push(star);
    }
  }

  updateScrollPct = () => {
    if (!this.gameOver) {
      let targetPct = utils.HAZARD_MIN_MS / this.timeToImpact;
      if (targetPct > this.scrollPct) this.scrollPct += utils.BG_SCROLL_ACC;
    } else {
      let targetPct = utils.HAZARD_MIN_MS / this.getStartingTimeToImpact();
      if (this.scrollPct > targetPct) this.scrollPct -= utils.BG_SCROLL_ACC;
    }
  }

  spawnHazard = () => { // spawns a new hazard then queues the next one on a decreasing timer
    if (!this.gameOver) {
      if (utils.DEBUG) console.log('spawning hazard; TTI:', this.timeToImpact);
      let spawnClass = null;
      if (!this.upgradeInPlay && this.player.weapon.level < utils.MAX_WEAPON_LVL 
          && Math.floor(this.score * 0.0133) >= this.player.weapon.level) { // check every 75 points (* 0.0133)
        spawnClass = Upgrade;
        this.upgradeInPlay = true;
      } else if (this.score > 300) {
        spawnClass = utils.randomChoice([Asteroid, Asteroid, Comet, UFO, UFO, UFO]);
      } else if (this.score > 200) {
        spawnClass = utils.randomChoice([Asteroid, Asteroid, Comet, UFO]);
      } else if (this.score > 150) {
        spawnClass = utils.randomChoice([Asteroid, Asteroid, Asteroid, Comet, Comet]);
      } else if (this.score > 100) {
        spawnClass = utils.randomChoice([Asteroid, Asteroid, Asteroid, Comet]);
      } else if (this.score > 50) {
        spawnClass = utils.randomChoice([Asteroid, Asteroid, Asteroid, Asteroid, Asteroid, Comet]);
      } else {
        spawnClass = Asteroid;
      }
      new spawnClass(this, utils.randomSpawn());
      this.timeToImpact = Math.max(utils.HAZARD_MIN_MS, this.timeToImpact-Math.max(25, this.score));
      this.hazardTimer = setTimeout(this.spawnHazard, this.timeToImpact);
    }
  }

  checkHazardCollision = (collisionObj) => {
    for (const k of this.gameObjects.keys()) {
      let gameObj = this.gameObjects.get(k);
      if ('isHazard' in gameObj && 
          gameObj.objId !== collisionObj.objId &&
          Math.abs(collisionObj.loc.x-gameObj.loc.x) < gameObj.getRadius() && 
          Math.abs(collisionObj.loc.y-gameObj.loc.y) < gameObj.getRadius()) {
            if ((gameObj.parentId || collisionObj.parentId) && 
                (gameObj.parentId === collisionObj.parentId ||
                 gameObj.parentId === collisionObj.objId || 
                 gameObj.objId === collisionObj.parentId)) return null;
            if (gameObj.isUpgrade && collisionObj.isHazard) return null;
        if (!gameObj.isUpgrade) {
          collisionObj.canDestroy = true;
          collisionObj.destroy();
        }
        gameObj.canDestroy = true;
        gameObj.destroy();
        return gameObj;
      }
    }
    return null;
  }

  createPauseText = () => {
    this.pauseText = [
      this.new ? 'BLASTEROIDS' : 'GAME PAUSED',
      (utils.MOBILE ? 'TILT' : 'SPACE') + ' TO BOOST',
      (utils.MOBILE ? 'TAP ' : 'CLICK') + ' TO SHOOT',
      (utils.MOBILE ? 'HOLD' : 'ENTER') + ' TO PAUSE',
      utils.DEBUG ? utils.BUILD
                  : utils.randomChoice(['GOOD LUCK', 'GODSPEED', 'STAY SHARP', 'HAVE FUN', 'PUNCH IT', 'GET READY'])
    ]
  }

  rankPlayer = () => {
    let pacifist = (this.shots === 0);
    let sharpshooter = (this.hits >= this.shots) && !pacifist;
    // D rank
    this.rank = 'D';
    let commentPool = ['STAY IN SCHOOL', 'SKILL ISSUE', 'JUST SAY NO', 'DO A BARREL ROLL'];
    if (pacifist && this.score >= 10) commentPool = ['I BELIEVE IN YOU', "MIX IT UP A LIL BIT"];
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
      'THANKS FOR PLAYING',
      'SCORE: '+this.score,
      'ACC  : '+(this.shots > 0 ? (100*this.hits/this.shots).toFixed(1)+'%' : this.score >= 30 ? '∞' : 'N/A'),
      'RANK : '+this.rank,
      utils.randomChoice(commentPool), //comment,
      (utils.MOBILE ? 'HOLD DOWN' : 'ANY INPUT') + ' TO RETRY'
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

  _updateStarPoints = (point, moveX, scroll, parallax) => {
    if (moveX) { point.x -= this.player.vel.x * utils.PARALLAX_SCALE; }
    // if (moveY) { point.y -= this.player.vel.y * utils.PARALLAX; }
    // point.y += Math.min(utils.BG_SCROLL_MAX, Math.max(utils.BG_SCROLL, (this.score*0.25*utils.PARALLAX))) * utils.getScale();
    point.y += scroll * parallax * utils.getScale();
    if (point.y > utils.canvas.height*2) {
      point.y = (utils.randomVal(0, 1) * utils.BG_RES)-utils.canvas.height;
      point.x = utils.randomVal(-utils.canvas.width, utils.canvas.width*2);
    }
  }

  render = () => {
    utils.resizeCanvas(); // done each frame in case the window is resized
    utils.ctx.clearRect(0, 0, utils.canvas.width, utils.canvas.height);
    if (this.bgStars) {
      if (!this.paused) { // couldn't use _inBounds() since check is per-axis
        let moveX = 0 < this.player.loc.x && this.player.loc.x < utils.canvas.width;
        // let moveY = 0 < this.player.loc.y && this.player.loc.y < utils.canvas.height;
        this.updateScrollPct();
        let scroll = utils.BG_SCROLL_MAX * this.scrollPct;
        // this.bgStars.forEach(point => { 
        //   if (moveX) { point.x -= this.player.vel.x * utils.PARALLAX; }
        //   // if (moveY) { point.y -= this.player.vel.y * utils.PARALLAX; }
        //   // point.y += Math.min(utils.BG_SCROLL_MAX, Math.max(utils.BG_SCROLL, (this.score*0.25*utils.PARALLAX))) * utils.getScale();
        //   point.y += scroll * utils.getScale();
        //   if (point.y > utils.canvas.height*2) {
        //     point.y = (utils.randomVal(0, 1) * utils.BG_RES)-utils.canvas.height;
        //     point.x = utils.randomVal(-utils.canvas.width, utils.canvas.width*2);
        //   }
        // });
        this.bgStars.forEach(point => this._updateStarPoints(point, moveX, scroll, 1));
        this.bgStars2.forEach(point => this._updateStarPoints(point, moveX, scroll, 0.8));
        this.bgStars3.forEach(point => this._updateStarPoints(point, moveX, scroll, 0.5));
      }
      utils.dotPoints(this.bgStars, utils.LINE_COLOR);
      utils.dotPoints(this.bgStars2, utils.fadeColor(utils.LINE_COLOR, 0.8));
      utils.dotPoints(this.bgStars3, utils.fadeColor(utils.LINE_COLOR, 0.5));
    }
    this.gameObjects.forEach((gameObj) => { gameObj.render() });
    let padding = utils.PADDING * utils.getScale() * (utils.MOBILE ? 3 : 1);
    let fontSize = utils.FONT_SIZE * utils.getScale();
    if (!this.new && !this.gameOver) {
      utils.displayText(`SCORE`, padding, padding+fontSize);
      utils.displayText(this.score, padding, padding+fontSize*2);
    }
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
        this.jingle.onended = (event) => { 
          if (this.gameOver && document.fullscreenElement) utils.safeToggleAudio(utils.GAME_BGM);
          this.canRestart = true;
          this.jingle = null;
        };
        this.jingle.onpause = (event) => { if (!this.canRestart) this.canRestart = true } // edge case when fullscreen lost during game over
        utils.safeToggleAudio(utils.GAME_BGM); // pause as late as possible to minimize audio gap
        utils.safePlayAudio(this.jingle);
      }
      if (utils.GAME_BGM.volume > 0.005) { if (this.canRestart) utils.GAME_BGM.volume -= 0.0007; } // fade out
      else { 
        utils.GAME_BGM.volume = 0;
        if (!utils.GAME_BGM.paused) utils.safeToggleAudio(utils.GAME_BGM, 'pauseOnly'); // after full fade out, pause flag is used to restart bgm
      }
      utils.displayTextBox(this.gameOverText, utils.canvas.width * 0.5, utils.canvas.height * 0.5);
    }
    if (utils.DEBUG && this.player) {
      if (utils.MOBILE) {
        utils.displayText('player.tilt.x:'+this.player.tilt.x.toFixed(2), padding, utils.canvas.height-fontSize*6);
        utils.displayText('player.tilt.y:'+this.player.tilt.y.toFixed(2), padding, utils.canvas.height-fontSize*5);
      }
      utils.displayText('player.vel.x:'+this.player.vel.x.toFixed(1), padding, utils.canvas.height-fontSize*4);
      utils.displayText('player.vel.y:'+this.player.vel.y.toFixed(1), padding, utils.canvas.height-fontSize*3);
      utils.displayText('player.loc.x:'+this.player.loc.x.toFixed(0), padding, utils.canvas.height-fontSize*2);
      utils.displayText('player.loc.y:'+this.player.loc.y.toFixed(0), padding, utils.canvas.height-fontSize); 
    }
    if (document.fullscreenElement && this.longPress) {
      let timePressed = Date.now() - this.lastTapTime;
      if (timePressed > 100 && timePressed < utils.LTAP_TIMEOUT) {
        let pressPct = timePressed/utils.LTAP_TIMEOUT;
        let ringColor = utils.fadeColor(utils.LINE_COLOR, pressPct/2);
        utils.traceRing(this.lastTap.x, this.lastTap.y, 70, ringColor, pressPct);
      }
    }
  }

  run = (timestamp) => { // https://isaacsukin.com/news/2015/01/detailed-explanation-javascript-game-loops-and-timing
    try {
      if (!this.paused) {
        if (this.jingle && this.jingle.paused && !this.jingle.ended && document.fullscreenElement) utils.safeToggleAudio(this.jingle, 'playOnly'); // edge case
        if (!this.gameOver && !document.hasFocus()) {
          if (utils.DEBUG) console.log('lost focus');
          this.handlePause();
        } else {
          this.deltaTime += timestamp - this.lastTick;
          this.lastTick = timestamp;
          var updatesThisLoop = 0;
          while (this.deltaTime >= utils.TIME_STEP) {
            this.update();
            this.deltaTime -= utils.TIME_STEP;
            if (++updatesThisLoop > 100) { // if updates are taking too long, panic and bail
              console.log('...at the disco');
              this.deltaTime = 0;
              break;
            }
          }
        }
      } else if (this.new) { // resolves bug where player would start at a corner/edge instead of mid-screen
        this.player.loc.x = utils.playerSpawnX();
        this.player.loc.y = utils.playerSpawnY();
        if (utils.MOBILE) this.player.tilt = this.player.neutral.copy();
      }
      this.cleanup();
      this.render();
    } catch (e) {
      if (utils.DEBUG) alert(e);
    } finally {
      requestAnimationFrame(this.run);
    }
  }

}