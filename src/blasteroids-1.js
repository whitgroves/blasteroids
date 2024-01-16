const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');

// constants 
const FPS = 60
const TIME_STEP = 1000 / FPS;
const LINE_COLOR = '#FFF'

const TRIANGLE = [(3 * Math.PI / 2), (Math.PI / 4), (3 * Math.PI / 4)];
const PLAYER_R = 16 // player radius (reminder: this is only HALF the player size)
const PLAYER_V = 12 // player max vel
const T_OFFSET = Math.PI / 2; // theta offset for player rotations; consequence of triangle pointing along y-axis
const PROJ_V = 1; // projectile speed

const OCTAGON = [0, (Math.PI / 4), (Math.PI / 2), (3 * Math.PI / 4), Math.PI, (5 * Math.PI / 4), (3 * Math.PI / 2), (7 * Math.PI / 4)];
const ROCK_R = 32; // asteroid radius
const ROCK_V = 0.3; // asteroid speed

getWindowStyle = (attribute) => { return window.getComputedStyle(document.body).getPropertyValue(attribute).slice(0, -2) }

resizeCanvas = () => { // https://stackoverflow.com/questions/4037212/html-canvas-full-screen
  canvas.width = window.innerWidth - getWindowStyle('margin-left') - getWindowStyle('margin-right'); 
  canvas.height = window.innerHeight - getWindowStyle('margin-bottom') - getWindowStyle('margin-top');
}

tracePoints = (points, enclose=true) => {
  ctx.beginPath();
  ctx.strokeStyle = LINE_COLOR;
  if (enclose) ctx.moveTo(points[points.length-1].x, points[points.length-1].y);
  points.forEach(point => { ctx.lineTo(point.x, point.y) });
  ctx.stroke();
  ctx.closePath();
}

displayText = (text, x, y) => {
  ctx.font = '30px Mono';
  ctx.fillStyle = LINE_COLOR;
  ctx.fillText(text, x, y);
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

class GameObject {
  constructor(game, loc=null, vel=null, radius=1) {
    this.game = game;
    this.loc = loc ? loc.copy() : new Vector2();
    this.vel = vel ? vel.copy() : new Vector2();
    this.objId = this.game.register(this);
    this.radius = radius;
  }
  inBounds = () => { return -this.radius < this.loc.x && this.loc.x < canvas.width+this.radius 
                        && -this.radius < this.loc.y && this.loc.y < canvas.height+this.radius }
  update = () => {} // virtual
  render = () => {} // virtual
  destroy = () => { this.game.deregister(this.objId) }
}

class Projectile extends GameObject {
  constructor(game, loc, theta) { super(game, loc, new Vector2(Math.cos(theta), Math.sin(theta), PROJ_V)) }
  update = () => {
    if (this.inBounds() && !this.game.checkAsteroidCollision(this)) {
      this.loc.add(this.vel.x, this.vel.y, this.game.deltaTime);
    } else {
      this.destroy();
    }
  }
  render = () => { tracePoints([this.loc, new Vector2(this.loc.x-this.vel.x, this.loc.y-this.vel.y)], false) }
}

class Player extends GameObject {
  constructor(game) {
    resizeCanvas(); // ensure player ALWAYS spawns at mid-screen
    super(game, new Vector2(canvas.width/2, canvas.height/2));
    this.accel = 0.02;
    this.frict = 0.02;
    this.theta = 0;
    this.radius = PLAYER_R;
    this.target = null;
    this.boosting = false;
    this.registerInputs();
  }

  // generally, each event sets an update flag, then the response is handled during update()
  // otherwise we'd stall the game doing trig on every mouse move or keypress
  registerInputs = () => {
    document.addEventListener('mousemove', this._acquireTarget);
    document.addEventListener('keydown', this._boostOn);
    document.addEventListener('keyup', this._boostOff);
    document.addEventListener('mousedown', this._fireProjectile);
  }
  deregisterInputs = () => {
    document.removeEventListener('mousemove', this._acquireTarget);
    document.removeEventListener('keydown', this._boostOn);
    document.removeEventListener('keyup', this._boostOff);
    document.removeEventListener('mousedown', this._fireProjectile);
  }
  _acquireTarget = (event) => { this.target = new Vector2(event.x, event.y) }
  _boostOn = (event) => { this.boosting = event.key === ' ' }
  _boostOff = (event) => { this.boosting = !event.key === ' ' }
  _fireProjectile = (event) => { if (event.button === 0) new Projectile(this.game, this.loc, this.theta-T_OFFSET) }

  _safeUpdateVelocity = (v) => {
    v *= (1 - this.frict)
    v = Math.max(-PLAYER_V, Math.min(v, PLAYER_V));            
    if (Math.abs(v) < 0.001) v = 0;
    return v;
  }
  update = () => {
    // rotate towards mouse
    if (this.target) { 
      this.theta = Math.atan2(this.target.y-this.loc.y, this.target.x-this.loc.x) + T_OFFSET;
      this.theta %= 2 * Math.PI; // radians
      this.target = null;
    }
    // apply velocity
    if (this.boosting) this.vel.add(Math.cos(this.theta-T_OFFSET), Math.sin(this.theta-T_OFFSET), this.accel * this.game.deltaTime);
    this.vel.apply(this._safeUpdateVelocity);
    this.loc.x = Math.max(0, Math.min(this.loc.x + this.vel.x, canvas.width));
    this.loc.y = Math.max(0, Math.min(this.loc.y + this.vel.y, canvas.height));
    // collision check
    if (this.game.checkAsteroidCollision(this)) {
      this.game.gameOver = true;
      this.destroy();
      this.deregisterInputs();
    }
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
    this.theta = theta ? theta % 2 * Math.PI : Math.atan2(loc.y-game.player.loc.y, loc.x-game.player.loc.x); // by default, head towards player
    this.vel.set(Math.cos(this.theta), Math.sin(this.theta), ROCK_V);
    this.radius = ROCK_R;
    this.isAsteroid = true; // in reality this can be anything so long as the property exists
  }
  update = () => {
    if (this.inBounds()) {
      this.loc.add(this.vel.x, this.vel.y, -this.game.deltaTime); // scaled negative to move inward on spawn
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
    tracePoints(points);
  }
}

class Game {
  constructor() {
    this.lastTick = 0; // last time run() was executed
    this.deltaTime = 0;
    this.nextObjectId = -1; // will increment to 0 on first registration
    this.cleanupIds = [];
    this.newGame();
    document.addEventListener('keydown', (event) => {
      if (!this.gameOver && event.key === 'Escape'){
        this.paused = !this.paused;
        if (this.paused) {
          cancelAnimationFrame(this.frameReq);
          clearTimeout(this.asteroidTimer);
          this.pauseTime = Date.now();
          displayText('GAME PAUSED', this.player.loc.x, this.player.loc.y);
        }
        else {
          this.lastTick += (Date.now() - this.pauseTime);
          this.spawnAsteroid(0);
          this.frameReq = requestAnimationFrame(this.run);
        } 
      } else if (this.gameOver && event.key === 'Enter') {
        this.newGame();    
      }
    });
    this.frameReq = requestAnimationFrame(this.run);
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
    this.score = 0;
    this.gameObjects = new Map(); // clear stray asteroids before player spawns
    this.player = new Player(this);
    this.timeToImpact = 2500;
    this.spawnAsteroid(0);
  }

  spawnAsteroid = (size) => { // spawns a new asteroid on a decreasing timer
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
        case 0: new Asteroid(this, new Vector2(x, y));
        // case 1: new BigAsteroid(this, loc, theta);
      }
      if (this.timeToImpact > 250) this.timeToImpact -= 25;
      this.asteroidTimer = setTimeout(this.spawnAsteroid, this.timeToImpact, 0);
    }
  }

  checkAsteroidCollision = (collisionObj) => {
    for (const k of this.gameObjects.keys()) {
      let gameObj = this.gameObjects.get(k);
      if ('isAsteroid' in gameObj && Math.abs(collisionObj.loc.x-gameObj.loc.x) < ROCK_R && Math.abs(collisionObj.loc.y-gameObj.loc.y) < ROCK_R) {
        gameObj.destroy();
        this.score++;
        return true;
      }
    }
    return false;
  }

  update = () => { this.gameObjects.forEach((gameObj) => { gameObj.update() }) }

  render = () => {
    resizeCanvas(); // done each frame in case the window is resized
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.gameObjects.forEach((gameObj) => {
      gameObj.render(); 
    });
    displayText(this.score, 10, 40);
    if (this.gameOver) displayText('GAME OVER', this.player.loc.x, this.player.loc.y);
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