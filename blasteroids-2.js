const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');

const DEBUG = false; // the one and only
const DEBUG_ID = 'TBD'; // changing this on each push makes it easier to tell if s3 is serving a cached version or not
 
// mobile settings
const MOBILE = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent); // https://stackoverflow.com/a/29509267/3178898
const DTAP_TIMEOUT = 250; // timeout for double-tap
const TILT_THRESH = 0.45; // minimum tilt to move the player

// game settings
const FPS = 60
const TIME_STEP = 1000 / FPS;
const LINE_COLOR = '#FFF';
const LINE_WIDTH = MOBILE ? 3 : 2;
const FONT_SIZE = MOBILE ? 45 : 30;
const FONT_FAM = 'monospace';
const PADDING = 10;
const XSCALE_F = MOBILE ? 0.318 : 0.3225; // helps scale text box to font size
const YSXALE_F = MOBILE ? 0.645 : 0.7143; // don't ask me why, it just works

// player config
const TRIANGLE = [(3 * Math.PI / 2), (Math.PI / 4), (3 * Math.PI / 4)];
const PLAYER_R = MOBILE ? 20 : 16; // player radius (reminder: this is only HALF the player size)
const PLAYER_V = 12; // player max vel
const PLAYER_A = MOBILE ? 0.05 : 0.02; // default player acceleration
const PLAYER_F = 0.02; // player friction
const T_OFFSET = Math.PI / 2; // theta offset for player rotations; consequence of triangle pointing along y-axis
const PROJ_V = 1; // projectile speed
const PROJ_L = 10; // projectile length

// asteroid config
const OCTAGON = [0, (Math.PI / 4), (Math.PI / 2), (3 * Math.PI / 4), Math.PI, (5 * Math.PI / 4), (3 * Math.PI / 2), (7 * Math.PI / 4)];
const ROCK_R = PLAYER_R * 2; // asteroid radius is always 2x the player
const ROCK_V = 0.3; // asteroid speed

getWindowStyle = (attribute) => { return window.getComputedStyle(document.body).getPropertyValue(attribute).slice(0, -2) } // returns ~"30px" hence the slice

resizeCanvas = () => { // https://stackoverflow.com/questions/4037212/html-canvas-full-screen
  canvas.width = window.innerWidth - getWindowStyle('margin-left') - getWindowStyle('margin-right'); 
  canvas.height = window.innerHeight - getWindowStyle('margin-bottom') - getWindowStyle('margin-top');
}

tracePoints = (points, enclose=true) => { // points is an array of Vector2 (see below)
  ctx.beginPath();
  ctx.strokeStyle = LINE_COLOR;
  ctx.lineWidth = LINE_WIDTH;
  if (enclose) ctx.moveTo(points[points.length-1].x, points[points.length-1].y);
  points.forEach(point => { ctx.lineTo(point.x, point.y) });
  ctx.stroke();
  ctx.closePath();
}

displayText = (text, x, y, color=LINE_COLOR) => {
  ctx.font = FONT_SIZE+'px '+FONT_FAM;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

displayTextBox = (textLines, x, y) => {
  lineLengths = textLines.map((text) => text.length);
  let xscale = Math.max(...lineLengths) * FONT_SIZE * XSCALE_F;
  let yscale = textLines.length * FONT_SIZE * YSXALE_F;
  x = Math.max(xscale, Math.min(x, canvas.width-xscale-PADDING)); // keep box in-bounds
  y = Math.max(yscale, Math.min(y, canvas.height-yscale-PADDING));
  let xLeft = x - xscale;
  let xRight = x + xscale;
  let yTop = y - yscale;
  let yBottom = y + yscale;
  box = [new Vector2(xLeft, yTop), new Vector2(xRight, yTop), new Vector2(xRight, yBottom), new Vector2(xLeft, yBottom)];
  ctx.fillStyle = '#000';
  ctx.fillRect(xLeft, yTop, xscale * 2, yscale * 2);
  tracePoints(box);
  for (let i = 0; i < textLines.length; i++) {
    displayText(textLines[i], xLeft+PADDING, yTop+(FONT_SIZE+PADDING)*(i+1));
  }
}

randomChoice = (choices) => { // https://stackoverflow.com/q/9071573/3178898
  let i = Math.floor(Math.random() * choices.length);
  return choices[i];
}

randomVal = (max, min) => { return Math.random() * (max - min) + min }

class Vector2 { // I know libraries for this exist but sometimes you want a scoop of vanilla
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
  copy = () => { return new Vector2(this.x, this.y) } // TIL JS is sometimes pass by reference
}

class GameObject {PADDING
  constructor(game, loc=null, vel=null, radius=1) {
    this.game = game;
    this.loc = loc ? loc.copy() : new Vector2();
    this.vel = vel ? vel.copy() : new Vector2();
    this.objId = this.game.register(this);
    this.radius = radius;
  }
  inBounds = () => { return -this.radius <= this.loc.x && this.loc.x <= canvas.width+this.radius 
                        && -this.radius <= this.loc.y && this.loc.y <= canvas.height+this.radius }
  _onDestroy = () => {} // virtual
  destroy = () => { this._onDestroy(); this.game.deregister(this.objId); }
  update = () => {} // virtual
  render = () => {} // virtual
}

class Projectile extends GameObject {
  constructor(game, loc, theta) { super(game, loc, new Vector2(Math.cos(theta), Math.sin(theta), PROJ_V)) }
  update = () => {
    let hit = this.game.checkAsteroidCollision(this);
    if (!hit && this.inBounds()) {
      this.loc.add(this.vel.x, this.vel.y, this.game.deltaTime);
    } else {
      if (hit) this.game.money++;
      this.destroy();
    }
  }
  render = () => { tracePoints([this.loc, new Vector2(this.loc.x-this.vel.x*PROJ_L, this.loc.y-this.vel.y*PROJ_L)], false) }
}

class Player extends GameObject {
  constructor(game) {
    resizeCanvas(); // ensure player ALWAYS spawns at mid-screen
    super(game, new Vector2(canvas.width/2, canvas.height/2));
    this.accel = PLAYER_A;
    this.frict = PLAYER_F;
    this.theta = 0;
    this.radius = PLAYER_R;
    this.target = null;
    this.firing = false;
    this.boosting = false;
    this.tilt = new Vector2(); // track device tilt on mobile to trigger movement
    this.neutral = MOBILE ? new Vector2(0, 22) : null; // default neutral tilt is (0, 22) since first update can come in as (0, 0)
    this.registerInputs();
  }
  // generally, each event sets an update flag, then the response is handled during update()
  // otherwise we'd stall the game doing trig on every mouse move or keypress
  registerInputs = () => {
    if (MOBILE) {
      window.addEventListener('touchstart', this._onTouchStart);
      window.addEventListener('deviceorientation', this._onDeviceOrientation);
    } else {
      window.addEventListener('mousemove', this._onMouseMove);
      window.addEventListener('mousedown', this._onMouseDown);
      window.addEventListener('keydown', this._onKeyDown);
      window.addEventListener('keyup', this._onKeyUp);
    }
  }
  deregisterInputs = () => {
    if (MOBILE) { 
      window.removeEventListener('touchstart', this._onTouchStart);
      window.removeEventListener('deviceorientation', this._onDeviceOrientation);
    } else {
      window.removeEventListener('mousemove', this._onMouseMove);
      window.removeEventListener('mousedown', this._onMouseDown);
      window.removeEventListener('keydown', this._onKeyDown);
      window.removeEventListener('keyup', this._onKeyUp);
    }
  }
  _onTouchStart = (event) => {
    this.target = new Vector2(event.touches[0].clientX, event.touches[0].clientY);
    this.firing = true;
  }
  _onDeviceOrientation = (event) => {
    this.tilt = new Vector2(event.gamma, event.beta);
    if (!this.neutral) this.neutral = this.tilt.copy(); // remember starting position if one isn't set
  }
  _onMouseMove = (event) => { this.target = new Vector2(event.x, event.y) }
  _onMouseDown = (event) => { if (event.button === 0) this.firing = true }
  _onKeyDown = (event) => { this.boosting = event.key === ' ' }
  _onKeyUp = (event) => { this.boosting = !event.key === ' ' }
  _onDestroy = () => {
    this.game.gameOver = true;
    this.deregisterInputs();
  }
  _isTilted = () => { return this.neutral && Math.abs(this.tilt.x-this.neutral.x) > TILT_THRESH | Math.abs(this.tilt.y-this.neutral.y) > TILT_THRESH}
  _safeUpdateVelocity = (v) => {
    v *= (1 - this.frict)
    v = Math.max(-PLAYER_V, Math.min(v, PLAYER_V));            
    if (Math.abs(v) < 0.001) v = 0;
    return v;
  }
  update = () => {
    // rotate towards target
    if (this.target) { 
      this.theta = Math.atan2(this.target.y-this.loc.y, this.target.x-this.loc.x) + T_OFFSET;
      setTimeout(() => this.target = null, TIME_STEP * 30); // stay on target for the next 30 frames so shots land
    } else if (this._isTilted()) {
      this.theta = Math.atan2(this.tilt.y-this.neutral.y, this.tilt.x-this.neutral.x) + T_OFFSET;
    }
    this.theta %= 2 * Math.PI; // radians
    // fire projectile
    if (this.firing) {
      new Projectile(this.game, this.loc, this.theta-T_OFFSET);
      this.firing = false;
    }
    // apply velocity    
    if (MOBILE && this._isTilted()) {
      this.vel.add(this.tilt.x-this.neutral.x, this.tilt.y-this.neutral.y, this.accel * this.game.deltaTime * 0.0111); // scale by 1/90 to normalize raw tilt data
      // https://developer.mozilla.org/en-US/docs/Web/API/Device_orientation_events/Orientation_and_motion_data_explained
    } 
    if (!MOBILE && this.boosting) this.vel.add(Math.cos(this.theta-T_OFFSET), Math.sin(this.theta-T_OFFSET), this.accel * this.game.deltaTime);
    this.vel.apply(this._safeUpdateVelocity);
    this.loc.x = Math.max(0, Math.min(this.loc.x + this.vel.x, canvas.width));
    this.loc.y = Math.max(0, Math.min(this.loc.y + this.vel.y, canvas.height));
    // collision check
    if (this.game.checkAsteroidCollision(this)) this.destroy();
  }
  render = () => {
    var points = [];
    TRIANGLE.forEach(point => {
      var x = this.loc.x + this.radius * Math.cos(point + this.theta);
      var y = this.loc.y + this.radius * Math.sin(point + this.theta);
      points.push(new Vector2(x, y));
    });
    tracePoints(points);
  }
}

class Asteroid extends GameObject {
  constructor(game, loc, theta=null) {
    super(game, loc);
    this.theta = theta ? theta % (2 * Math.PI) : Math.atan2(game.player.loc.y-loc.y, game.player.loc.x-loc.x); // by default, head towards player
    this.vel.set(Math.cos(this.theta), Math.sin(this.theta), ROCK_V);
    this.radius = ROCK_R;
    this.isAsteroid = true; // in reality this can be anything so long as the property exists
  }
  _onDestroy = () => { if (!this.game.gameOver) this.game.score++ }
  update = () => {
    if (this.inBounds()) {
      this.loc.add(this.vel.x, this.vel.y, this.game.deltaTime); // scaled negative to move inward on spawn
    } else {
      this.destroy();
    }
  }
  render = () => {
    var points = [];
    OCTAGON.forEach(point => {
      var x = this.loc.x + this.radius * Math.cos(point + this.theta);
      var y = this.loc.y + this.radius * Math.sin(point + this.theta);
      points.push(new Vector2(x, y));
    });
    if (DEBUG) points.push(this.loc.copy());
    tracePoints(points);
  }
}

class BigAsteroid extends Asteroid {
  constructor(game, loc, theta=null) {
    super(game, loc, theta);
    this.radius *= 2;
  }
  _onDestroy = () => {
    if (!this.game.gameOver) this.game.score += 3;
    new Asteroid(this.game, this.loc.copy(), this.theta + Math.PI / randomChoice([4, 5, 6])); // splits into 2 asteroids before destroying itself
    new Asteroid(this.game, this.loc.copy(), this.theta - Math.PI / randomChoice([4, 5, 6])); // asteroids have same angle +/- 45-60 degrees
  }
}

class Game {
  constructor() {
    // timer
    this.lastTick = 0; // last time run() was executed
    this.deltaTime = 0;
    // object management
    this.nextObjectId = -1; // will increment to 0 on first registration
    this.cleanupIds = [];
    // inputs
    if (MOBILE) {
      this.waitingForDoubleTap = false;
      window.addEventListener('touchstart', this._handleTouchInput);
    } else {
      window.addEventListener('keydown', this._handleKeyInput);
    }
    // start game
    this.newGame();
    this.frameReq = requestAnimationFrame(this.run);
  }
  _handleTouchInput = (event) => {
    event.preventDefault(); // block resize on double-tap
    if (!this.waitingForDoubleTap) {
      this.waitingForDoubleTap = true;
      setTimeout(() => { this.waitingForDoubleTap = false }, DTAP_TIMEOUT);
    } else {
      if (this.gameOver) this.newGame(); // double-tap to restart
      else this._handlePause(); // un/pause on double-tap
    }
  }
  _handleKeyInput = (event) => {
    if (!this.gameOver && event.key === 'Escape'){
       this._handlePause();
    } else if (this.gameOver && event.key === 'Escape') {
      this.newGame();
    }
  }
  _handlePause = () => {
    this.paused = !this.paused;
    if (this.paused) {
      cancelAnimationFrame(this.frameReq);
      clearTimeout(this.asteroidTimer);
      this.pauseTime = Date.now();
      let pauseText = [
        'YOU ARE HERE',
        (MOBILE ? 'TILT' : 'SPACE') + ' TO MOVE',
        (MOBILE ? 'TAP' : 'CLICK') + ' TO SHOOT',
        (MOBILE ? 'DOUBLE TAP' : 'ESC') + ' TO RESUME',
        DEBUG ? DEBUG_ID : randomChoice(['GOOD LUCK', 'GODSPEED', 'STAY SHARP', 'HAVE FUN', "SHAKE N' BAKE", 'GET READY', 'YOURS TRULY,'])
      ]
      displayTextBox(pauseText, this.player.loc.x, this.player.loc.y);
    }
    else {
      if (MOBILE) this.player.neutral = null; // player will auto-update the neutral position on resume
      this.lastTick += (Date.now() - this.pauseTime);
      this.spawnAsteroid(0);
      this.frameReq = requestAnimationFrame(this.run);
    }
  }
  openMenu = () => {

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
    this.paused = false;
    this.pauseTime = null;
    this.gameOver = false;
    this.gameOverText = null;
    this.score = 0;
    this.money = 0;
    this.gameObjects = new Map(); // clear stray asteroids before player spawns
    this.player = new Player(this);
    this.timeToImpact = DEBUG ? 5000 : 2500;
    this.asteroidTimer = setTimeout(this.spawnAsteroid, this.timeToImpact);
  }
  spawnAsteroid = (size=0) => { // spawns a new asteroid then queues the next one on a decreasing timer
    if (!this.gameOver) {
      let x = null;
      let y = null;
      if (randomChoice([true, false])) { 
        x = randomChoice([0, canvas.width]);
        y = randomVal(0, canvas.height);
      } else {
        x = randomVal(0, canvas.width);
        y = randomChoice([0, canvas.height]);
      }
      switch (size) {
        case 0:
          new Asteroid(this, new Vector2(x, y));
          break;
        case 1:
          new BigAsteroid(this, new Vector2(x, y));
          break;
      }
      if (this.timeToImpact > (DEBUG ? 5000 : 1000)) this.timeToImpact -= 25;
      this.asteroidTimer = setTimeout(this.spawnAsteroid, this.timeToImpact, (this.score > 3 ? randomChoice([0, 1]) : 0));
    }
  }
  checkAsteroidCollision = (collisionObj) => {
    for (const k of this.gameObjects.keys()) {
      let gameObj = this.gameObjects.get(k);
      if ('isAsteroid' in gameObj && Math.abs(collisionObj.loc.x-gameObj.loc.x) < gameObj.radius && Math.abs(collisionObj.loc.y-gameObj.loc.y) < gameObj.radius) {
        gameObj.destroy();
        return true;
      }
    }
    return false;
  }
  update = () => { this.gameObjects.forEach((gameObj) => { gameObj.update() }) }
  render = () => {
    resizeCanvas(); // done each frame in case the window is resized
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.gameObjects.forEach((gameObj) => { gameObj.render() });
    displayText(' '+this.score, PADDING, PADDING + FONT_SIZE);
    displayText('$'+this.money, PADDING, 2 * (PADDING + FONT_SIZE), '#0F0');
    if (this.gameOver){
      if (!this.gameOverText) {
        let rank = 'D';
        let comment = randomChoice(["MIX IT UP A LIL' BIT", 'STAY IN SCHOOL', 'I BELIEVE IN YOU', 'SKILL ISSUE', 'TRY HARDER']);
        let sharpshooter = (this.score >= 25 && this.money >= this.score * 0.6); // TODO: update how this is measured
        let broke = (this.money === 0);
        if (this.score >= 120) {
          if (sharpshooter || this.broke || this.score >= 300) {
            rank = 'S';
            comment = broke ? 'ENLIGHTENED, YOU ARE' : randomChoice(['UNBELIEVABLE', 'INHUMAN', 'SEEK HELP', 'RAW']);
          }
          else {
            rank = 'A';
            comment = this.score >= 180 // A+
              ? randomChoice(['TOP NOTCH', 'EXCELLENT', 'SHOW OFF', 'RARE']) 
              : randomChoice(['GOOD JOB', 'MISSION ACCOMPLISHED', 'WELL DONE']);
          }
        } else {
          if (this.score >= 70) {
            rank = 'B';
            comment = randomChoice(['PRETTY GOOD', 'RESPECTABLE', 'SOLID', 'MEDIUM WELL']);
          } else if (this.score >= 30) {
            rank = 'C';
            comment = randomChoice(['NOT BAD', 'GETTING SOMEWHERE', 'GOING PLACES', 'HEATING UP']);
          }
          if (sharpshooter) comment = randomChoice(["NICE SHOOTIN' TEX", 'LOCKED IN', 'EAGLE EYE']);
          if (broke) comment = randomChoice(['WAS THAT ON PURPOSE?', 'USE PAPER NEXT TIME', 'I HOPE YOU LIKE RAMEN']);
        }
        this.gameOverText = [
          'GAME OVER',
          'SCORE: '+this.score,
          'MONEY: '+this.money,
          'RANK : '+rank,
          comment,
          (MOBILE ? 'DOUBLE TAP' : 'PRESS ESC') + ' FOR NEW GAME'
        ]
      }
      displayTextBox(this.gameOverText, this.player.loc.x, this.player.loc.y);
    }
    if (DEBUG && this.player.neutral) {
      displayText('x:'+this.player.neutral.x, PADDING, canvas.height-FONT_SIZE*2);
      displayText('y:'+this.player.neutral.y, PADDING, PADDING + canvas.height-FONT_SIZE);
    }
  } 
  run = (timestamp) => { // https://isaacsukin.com/news/2015/01/detailed-explanation-javascript-game-loops-and-timing
    if (!this.paused) {
      this.deltaTime += timestamp - this.lastTick;
      this.lastTick = timestamp;
      var updatesThisLoop = 0;
      while (this.deltaTime >= TIME_STEP) {
        this.update();
        this.deltaTime -= TIME_STEP;
        if (++updatesThisLoop > 251) { // if updates are taking too long, panic and bail
          console.log('...at the disco')
          this.deltaTime = 0;
          break;
        }
      }
      this.render();
      this.cleanup();
    }
    this.frameReq = requestAnimationFrame(this.run);
  }
}

var game = new Game();