const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');

const DEBUG = JSON.parse(document.getElementById('debugFlag').text).isDebug;
const BUILD = '2023.12.26.0'; // makes it easier to check for cached version on mobile

// mobile settings
const MOBILE = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent); // https://stackoverflow.com/a/29509267/3178898
const DTAP_TIMEOUT = 300;
const LTAP_TIMEOUT = 500; // how long to wait for a long press
const TILT_THRESH = 3;

let lastOrientation = screen.orientation.type;
if (MOBILE && DEBUG) alert(lastOrientation);

// game settings
const FPS = 60
const TIME_STEP = 1000 / FPS;
const SHAPE_FILL = '#000';
const LINE_COLOR = '#FFF';
const FONT_SIZE = MOBILE ? 45 : 30;
const FONT_FAM = 'monospace';
const PADDING = 10;
const XSCALE_F = MOBILE ? 0.318 : 0.3225; // helps scale text box to font size
const YSXALE_F = MOBILE ? 0.645 : 0.7143; // don't ask me why, it just works
const PARALLAX = 0.3333                   // ratio for parallax effect

// player
const TRIANGLE = [0, (3 * Math.PI / 4), (5 * Math.PI / 4)];
const PLAYER_R = MOBILE ? 20 : 16;     // radius
const PLAYER_V = MOBILE ? 15 : 12;     // max vel
const PLAYER_A = MOBILE ? 0.06 : 0.02; // acceleration
const PLAYER_F = 0.02;                 // friction
const PLAYER_C = '#AAA'                // player (and player projectile) color

// player weapon
const MAX_WEAPON_LVL = 4;
const OFFSET_RATIO = PLAYER_R * 0.35; // it just works

// projectile
const PROJ_V = 1;  // velocity
const PROJ_L = 10; // length

// upgrade
const HEXAGON = [(Math.PI / 6), (Math.PI / 2), (5 * Math.PI / 6), (7 * Math.PI / 6), (3 * Math.PI / 2), (11 * Math.PI / 6)];
const UPGRADE_R = PLAYER_R * 2.5
const UPGRADE_V = 0.2;
const UPGRADE_C = '#0F0';

// asteroid 
const OCTAGON = [0, (Math.PI / 4), (Math.PI / 2), (3 * Math.PI / 4), Math.PI, (5 * Math.PI / 4), (3 * Math.PI / 2), (7 * Math.PI / 4)];
const ROCK_R = PLAYER_R * 2;
const ROCK_V = 0.3;
const ROCK_C = '#FFF'

// big asteroid
const BIGROCK_R = ROCK_R * 2

// comet
const PENTAGON = [0, (2 * Math.PI / 5), (4 * Math.PI / 5), (6 * Math.PI / 5), (8 * Math.PI / 5)];
const COMET_C = '#FD0';
const COMET_R = ROCK_R * 0.7;
const COMET_V = ROCK_V * 1.6;
const COMET_TA = 0.009; // per-frame turn amount (radians)

// ufo
const UFO_R = PLAYER_R * 1.5;
const UFO_V = ROCK_V * 0.8;
const UFO_C = '#F00';
// const DIAMOND = [0, (2 * Math.PI / 3), (5 * Math.PI / 6), (7 * Math.PI / 6), (4 * Math.PI / 3)];

// display
getScale = () => { return !MOBILE ? 1 : lastOrientation == 'portrait-primary' ? 0.8 : 0.35 }
getLineWidth = () => { return (!MOBILE ? 2 : lastOrientation == 'portrait-primary' ? 3 : 2.5) }
getWindowStyle = (attribute) => { return window.getComputedStyle(document.body).getPropertyValue(attribute).slice(0, -2) } // returns ~"30px" hence the slice
resizeCanvas = () => { // https://stackoverflow.com/questions/4037212/html-canvas-full-screen
  canvas.width = window.innerWidth - getWindowStyle('margin-left') - getWindowStyle('margin-right'); 
  canvas.height = window.innerHeight - getWindowStyle('margin-bottom') - getWindowStyle('margin-top');
}
tracePoints = (points, enclose=true, color=LINE_COLOR, fill=SHAPE_FILL) => { // points is an array of Vector2 (see below)
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
dotPoints = (points, color=LINE_COLOR) => { // points is an array of Vector2 (see below)
  ctx.beginPath();
  ctx.fillStyle = color;
  points.forEach(point => { ctx.fillRect(point.x, point.y, getLineWidth(), getLineWidth()) }); // https://stackoverflow.com/a/7813282/3178898
  ctx.fill();
  ctx.closePath();
}
displayText = (text, x, y, color=LINE_COLOR) => {
  ctx.font = FONT_SIZE * getScale()+'px '+FONT_FAM;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}
displayTextBox = (textLines, x, y) => {
  lineLengths = textLines.map((text) => text.length);
  let xscale = Math.max(...lineLengths) * FONT_SIZE * XSCALE_F * getScale();
  let yscale = textLines.length * FONT_SIZE * YSXALE_F * getScale();
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
    displayText(textLines[i], xLeft+PADDING * getScale(), yTop+(FONT_SIZE+PADDING)*(i+1) * getScale());
  }
}
getColorChannels = (color) => { // "#FFF" -> "FF", "FF", "FF" -> [256, 256, 256]
  let _r = parseInt(color[1]+color[1], 16); 
  let _g = parseInt(color[2]+color[2], 16);
  let _b = parseInt(color[3]+color[3], 16);
  return [_r, _g, _b];
}
fadeColor = (color, alpha) => {
  return '#' + getColorChannels(color).map(channel => Math.floor(alpha * channel).toString(16))
                                      .map(channel => ('0' + channel).slice(-2)) // single-digit values overflow the final hex
                                      .reduce((a, b) => a + b);
}

// rng
randomChoice = (choices) => { return choices[Math.floor(Math.random() * choices.length)] }
randomVal = (min, max) => { return Math.random() * (max - min) + min } // output range is [min, max)
// randomInt = (min, max) => { return Math.floor(randomVal(Math.ceil(min), Math.floor(max + 1))) } // output range is [min, max]
randomSpawn = () => { // generates a random spawn point on the edge of the screen
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
  copy = (scale=1) => { return new Vector2(this.x, this.y, scale) } // TIL JS is sometimes pass by reference
}

class GameObject {
  constructor(game, loc=null, vel=null, radius=1, theta=0) {
    this.game = game;
    this.loc = loc ? loc.copy() : new Vector2();
    this.vel = vel ? vel.copy() : new Vector2();
    this.objId = this.game.register(this);
    this._radius = radius;
    this.theta = theta;
    this.destroyed = false;
  }
  getRadius = () => { return getScale() * this._radius } // wrapper to rescale on landscape-mobile
  inBounds = () => { return -this.getRadius() <= this.loc.x && this.loc.x <= canvas.width+this.getRadius() 
                         && -this.getRadius() <= this.loc.y && this.loc.y <= canvas.height+this.getRadius() }
  _points = (shape) => { 
    var points = [];
    shape.forEach(point => {
      var x = this.loc.x + this.getRadius() * Math.cos(point + this.theta);
      var y = this.loc.y + this.getRadius() * Math.sin(point + this.theta);
      points.push(new Vector2(x, y));
    });
    return points;
  }
  _onDestroy = () => {} // virtual, wraps destruction logic
  _onDestroyAnimate = () => {} // virtual, wraps destruction animations
  destroy = () => {
    if (!this.destroyed) { // prevent calls on the same frame from activating twice
      this.destroyed = true;
      this._onDestroy();
      if (this.inBounds()) { this._onDestroyAnimate(); }
      this.game.deregister(this.objId); // stop updating/rendering and queue for cleanup
    }
  }
  _onUpdate = () => {} // virtual, wraps update() 
  update = () => {
    this._onUpdate();
    if (this.inBounds()) { 
      this.loc.add(this.vel.x, this.vel.y, this.game.deltaTime * getScale());
    }
    else { this.destroy(); } 
  }
  render = () => {} // virtual
}

class Projectile extends GameObject {
  constructor(game, loc, theta) { super(game, loc, new Vector2(Math.cos(theta), Math.sin(theta), PROJ_V), 0, theta) }
  update = () => {
    let hit = this.game.checkAsteroidCollision(this);
    if (!hit && this.inBounds()) {
      this.loc.add(this.vel.x, this.vel.y, this.game.deltaTime * getScale());
    } else {
      if (hit) this.game.hits++;
      this.destroy();
    }
  }
  render = () => { tracePoints([this.loc, new Vector2(this.loc.x-this.vel.x*PROJ_L, this.loc.y-this.vel.y*PROJ_L)], false, PLAYER_C) }
}

class PlayerWeapon {
  constructor(level=1) { this.level = level }
  fire(game, loc, theta) {
    switch (this.level) {
      case 4:
        let xo4 = Math.sin(theta) * OFFSET_RATIO * getScale();
        let yo4 = Math.cos(theta) * OFFSET_RATIO * getScale();
        let cone4 = 0.03125; // 1 / 32
        let cone4_sm = 0.0078125; // 1 / 128
        new Projectile(game, new Vector2(loc.x-xo4*3, loc.y+yo4*3), theta+(Math.PI*cone4));
        new Projectile(game, new Vector2(loc.x-xo4, loc.y+yo4), theta+(Math.PI*cone4_sm));
        new Projectile(game, new Vector2(loc.x+xo4, loc.y-yo4), theta-(Math.PI*cone4_sm));
        new Projectile(game, new Vector2(loc.x+xo4*3, loc.y-yo4*3), theta-(Math.PI*cone4));
        break;
      case 3:
        let cone3 = 0.0625; // 1/16
        new Projectile(game, loc, theta);
        new Projectile(game, loc, theta+(Math.PI*cone3));
        new Projectile(game, loc, theta-(Math.PI*cone3));
        break;
      case 2:
        let xo2 = Math.sin(theta) * OFFSET_RATIO * getScale();
        let yo2 = Math.cos(theta) * OFFSET_RATIO * getScale();
        new Projectile(game, new Vector2(loc.x-xo2, loc.y+yo2), theta);
        new Projectile(game, new Vector2(loc.x+xo2, loc.y-yo2), theta);
        break;
      default:
        new Projectile(game, loc, theta);
    }
   }
}

class Player extends GameObject {
  constructor(game) {
    resizeCanvas(); // ensure player ALWAYS spawns at mid-screen
    super(game, new Vector2(canvas.width*0.5, canvas.height*0.5));
    this.accel = PLAYER_A;
    this.frict = PLAYER_F;
    this.theta = -Math.PI * 0.5 // 0;
    this._radius = PLAYER_R;
    this.target = null;
    this.firing = false;
    this.boosting = false;
    this.tilt = new Vector2(); // track device tilt on mobile to trigger movement 
    this.neutral = MOBILE ? new Vector2(0, 22) : null; // neutral position for tilt movement
    this.registerInputs(); // TODO: move so it's managed entirely within Game (priority -1)
    this.weapon = new PlayerWeapon();
    this.color = PLAYER_C;
    new ParticleTrailAnimation(game, this, null, 8, () => { return this.boosting || this._isTilted() });
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
    event.preventDefault();
    this.target = new Vector2(event.touches[0].clientX, event.touches[0].clientY);
    this.firing = true;
  }
  _onDeviceOrientation = (event) => {
    let beta = Math.max(-90, Math.min(event.beta, 90)); // [-180, 180) -> clamp to [-90, 90)
    let gamma = event.gamma; // [-90, 90)
    let screenOrientation = screen.orientation.type;
    let x = 0;
    let y = 0;
    switch (screenOrientation) {
      case 'portrait-primary':
        x = gamma;
        y = beta;
        break;
      case 'landscape-primary':
        x = beta;
        y = -gamma;
        break;
      case 'landscape-secondary':
        x = -beta;
        y = gamma;
        break;
    }
    this.tilt = new Vector2(x, y);
    if (!this.neutral) this.neutral = this.tilt.copy(); // remember neutral position if one isn't set
    if (lastOrientation != screenOrientation) {
      lastOrientation = screenOrientation;
      if (!this.game.paused) this.game.handlePause(); // if the orientation changed, pause the game
      resizeCanvas();                                 // adjust for new dims
      this.game.createBgStars();                      // stars need to be redrawn because of new dims
      if (DEBUG) alert('x:'+canvas.width+' y:'+canvas.height);
    }
  }
  _onMouseMove = (event) => { this.target = new Vector2(event.x, event.y) }
  _onMouseDown = (event) => { if (event.button === 0) this.firing = true }
  _onKeyDown = (event) => { this.boosting = event.key === ' ' }
  _onKeyUp = (event) => { this.boosting = !event.key === ' ' }
  _onDestroy = () => {
    this.game.gameOver = true;
    this.deregisterInputs();
    new ExplosionAnimation(this.game, this.loc.copy(), this.color, 400*getScale());
  }
  _isTilted = () => { return this.neutral && Math.abs(this.tilt.x-this.neutral.x) > TILT_THRESH | Math.abs(this.tilt.y-this.neutral.y) > TILT_THRESH}
  _safeUpdateVelocity = (v) => {
    v *= (1 - this.frict);
    v = Math.max(-PLAYER_V, Math.min(v, PLAYER_V));            
    if (Math.abs(v) < 0.001) v = 0;
    return v;
  }
  update = () => {
    // rotate towards target
    if (this.target) { 
      this.theta = Math.atan2(this.target.y-this.loc.y, this.target.x-this.loc.x);
      setTimeout(() => this.target = null, 1000); // stay on target for 1s so shots land more consistently
    } else if (this._isTilted()) {
      this.theta = Math.atan2(this.tilt.y-this.neutral.y, this.tilt.x-this.neutral.x);
    }
    this.theta %= 2 * Math.PI; // radians
    // fire projectile
    if (this.firing) {
      this.weapon.fire(this.game, this.loc.copy(), this.theta);
      this.firing = false;
      this.game.shots++;
    }
    // apply velocity    
    if (MOBILE && this._isTilted()) { // https://developer.mozilla.org/en-US/docs/Web/API/Device_orientation_events/Orientation_and_motion_data_explained
      this.vel.add(this.tilt.x-this.neutral.x, this.tilt.y-this.neutral.y, this.accel * this.game.deltaTime * 0.0111 * getScale()); // scale by 1/90 to normalize raw tilt input
    } 
    if (!MOBILE && this.boosting) this.vel.add(Math.cos(this.theta), Math.sin(this.theta), this.accel * this.game.deltaTime);
    this.vel.apply(this._safeUpdateVelocity);
    this.loc.x = Math.max(0, Math.min(this.loc.x + this.vel.x, canvas.width));
    this.loc.y = Math.max(0, Math.min(this.loc.y + this.vel.y, canvas.height));
    this.game.checkAsteroidCollision(this); // collision check
  }
  render = () => { tracePoints(this._points(TRIANGLE), true, this.color, this.color); } // TODO: change color based on upgrade level
}

class Hazard extends GameObject {
  constructor(game, loc, vscale, theta, radius, shape, color, value) {
    theta = theta || Math.atan2(game.player.loc.y-loc.y, game.player.loc.x-loc.x);
    super(game, loc, new Vector2(Math.cos(theta), Math.sin(theta), vscale), radius, theta);
    this.shape = shape;
    this.color = color;
    this.value = value;
    this.isHazard = true; // collision filter
  }
  _onDestroyAnimate = () => { new ExplosionAnimation(this.game, this.loc, this.color, this.getRadius()); } // default
  _onDestroyHazard = () => {} // virtual, re-wraps destruction logic
  _onDestroy = () => {
    this._onDestroyHazard(); // called before score update so subclass can change its value if conditions are met
    if (!this.game.gameOver) { this.game.score += this.value; }
  }
  render = () => { tracePoints(this._points(this.shape), this.shape, this.color); } // null shape => no fill
}

class Asteroid extends Hazard {
  constructor(game, loc, theta=null, vscale=null, radius=null, shape=null, color=null, value=null) {
    vscale = vscale || ROCK_V;
    radius = radius || ROCK_R;
    shape = shape || OCTAGON;
    color = color || ROCK_C;
    value = value || 1;
    super(game, loc, vscale, theta, radius, shape, color, value);
    this.shape = this.shape.map(x => x += randomVal(-1, 1) * (shape.length**-1)); // +/- 1/N
  }
}

class BigAsteroid extends Asteroid {
  constructor(game, loc) {
    super(game, loc, null, null, BIGROCK_R, null, null, 3);
  }
  _onDestroyHazard = () => { // spawn 2 asteroids in a 120 degree cone
    if (this.inBounds()) {
      new Asteroid(this.game, this.loc.copy(), this.theta + Math.PI * randomVal(0.1667, 0.25));
      new Asteroid(this.game, this.loc.copy(), this.theta - Math.PI * randomVal(0.1667, 0.25)); 
      if (this.game.score > 25 && randomChoice([true, false])) { // 3rd can spawn after a specific score is reached
        new Asteroid(this.game, this.loc.copy(), this.theta + Math.PI * randomVal(-0.1667, 0.1667));
      }
    }
  }
}

class Upgrade extends Hazard { // not really a hazard but behavior is 90% the same
  constructor(game, loc) {
    super(game, loc, UPGRADE_V, null, UPGRADE_R, HEXAGON, UPGRADE_C, 0);
    this.isUpgrade = true; // flag so collision doesn't kill the player
  }
  _onDestroy = () => {
    if (this.game.player.weapon.level < MAX_WEAPON_LVL) { // when hit, skips to the highest available level
      this.game.player.weapon.level = Math.min(MAX_WEAPON_LVL, Math.floor(this.game.score * 0.0133) + 1);
    }
    setTimeout(() => { this.game.upgradeInPlay = false }, randomVal(5000, 10000)); // if missed, wait 5-10s to respawn
  }
  _onDestroyAnimate = () => { new ImpactRingAnimation(this.game, this.loc, this.color, this.getRadius() * 5)}
}

class Comet extends Asteroid {
  constructor(game, loc) {
    super(game, loc, null, COMET_V, COMET_R, PENTAGON, COMET_C, 2); //, null, null, PENTAGON, COMET_V, 2);
    this._turnAmt = randomVal(-COMET_TA, COMET_TA); // follows a random arc
    new ParticleTrailAnimation(game, this);
  }
  _onDestroyAnimate = () => { new ExplosionAnimation(this.game, this.loc, this.color, this.getRadius()*2); }
  _onDestroyHazard = () => { if (this.inBounds()) { this.value = 7; } }
  _onUpdate = () => {
    this.theta += this._turnAmt;
    this.vel.set(Math.cos(this.theta), Math.sin(this.theta), COMET_V);
  }
}

class EnemyProjectile extends Hazard {
  constructor(game, loc, theta) { 
    super(game, loc, PROJ_V, theta, game.player.getRadius(), null, UFO_C, 1); // player radius used for collision
  }
  _points = () => { return [this.loc, new Vector2(this.loc.x-this.vel.x*PROJ_L, this.loc.y-this.vel.y*PROJ_L)]; }
}

class UFO extends Hazard {
  constructor(game, loc) {
    super(game, loc, UFO_V, null, UFO_R, TRIANGLE, UFO_C, 0);
    this._chaseFrames = 0;
    this._chaseLimit = Math.max(3000, 5000-game.timeToImpact); // longer games => longer chases
    this._trigger = setTimeout(this._fire, this._getFireRate()); // must store timeout response to clear it later
    new ParticleTrailAnimation(game, this, 2, 4);
  }
  _getActiveState = () => { return !this.game.gameOver && this._chaseFrames < this._chaseLimit; }
  _getFireRate = () => { return Math.max(500, 1500-this.game.score) }; // increase fire rate as score increases
  _fire = () => {
    if (this._getActiveState()) {
      new EnemyProjectile(this.game, this.loc, this.theta);
      this._trigger = setTimeout(this._fire, this._getFireRate());
    }
  }
  _onDestroyAnimate = () => { new ImpactRingAnimation(this.game, this.loc, this.color, this.getRadius()*5); }
  _onDestroyHazard = () => {
    clearTimeout(this._trigger); // ceasefire
    if (this.inBounds()) { this.value = 8; }
    else if (!this.game.gameOver) { // if it makes it safely out of bounds, spawn back in with the next hazard
      setTimeout(() => { new UFO(this.game, randomSpawn()); }, this.game.timeToImpact);
    }
  }
  _onUpdate = () => {
    if (this._getActiveState()) {
      let newTheta = Math.atan2(this.game.player.loc.y-this.loc.y, this.game.player.loc.x-this.loc.x);
      let dt = newTheta - this.theta;
      if (Math.abs(dt) > Math.PI/4) this.theta += 0.05 * dt;
      this.vel.set(Math.cos(this.theta), Math.sin(this.theta), UFO_V);
      this._chaseFrames += 1;
    }
  }
}

class ExplosionAnimation extends GameObject {
  constructor(game, loc, color=LINE_COLOR, maxRadius) {
    super(game, loc, null, (maxRadius * 0.5));
    this.color = color;
    this.baseColor = color;
    this.maxRadius = maxRadius;
    this.maxFrames = FPS * 0.5; // complete in ~1/2s
    this.currentFrame = 0;
    this.waves = [];
    this.waveDensity = 5;
  }
  _points = (shape, radius) => { 
    var points = [];
    shape.forEach(point => {
      var x = this.loc.x + radius * Math.cos(point);
      var y = this.loc.y + radius * Math.sin(point);
      points.push(new Vector2(x, y));
    });
    return points;
  }
  update = () => {
    if (this.currentFrame > this.maxFrames) this.destroy();
    else {
      if (this.currentFrame < this.maxFrames * 0.5) {
        let shape = []; // NOTE: tried using theta to shape an impact cone but the full ring looks better 90% of the time
        while (shape.length < this.waveDensity) { shape.push(randomVal(0, Math.PI * 2)); }
        this.waves.push(shape); // make a new wave at the center
      }
      if (this.flicker) console.log('flicker: '+this.baseColor+' '+this.flicker);
      this.color = fadeColor(this.baseColor, (1 - (this.currentFrame / this.maxFrames)**2));
      this.currentFrame++;
    }
  }
  render = () => {
    for (let i = 0; i < this.waves.length; i++) {
      let waveRadius = (this.currentFrame / this.maxFrames) * this.maxRadius + (this.waves.length - i);
      dotPoints(this._points(this.waves[i], waveRadius), this.color);
    }
  }
}

class ImplosionAnimation extends ExplosionAnimation {
  render = () => {
    for (let i = 0; i < this.waves.length; i++) {
      let waveRadius = ((this.maxFrames - i) / this.maxFrames) * this.maxRadius;
      dotPoints(this._points(this.waves[i], waveRadius), this.color);
    }
  }
}

class ImpactRingAnimation extends ExplosionAnimation {
  render = () => {
    for (let i = 0; i < this.waves.length; i++) {
      let waveRadius = (this.currentFrame / this.maxFrames) * this.maxRadius;
      dotPoints(this._points(this.waves[i], waveRadius), this.color);
    }
  }
}

class ParticleTrailAnimation extends GameObject {
  constructor(game, source, density=null, maxWaves=null, canGenerate=null) {
    super(game);
    this.source = source;
    this.waves = [];
    this.density = density || 5;
    this.maxWaves = maxWaves || 16;
    this.colorGradient = Array.from({length: this.maxWaves}, (c, i) => fadeColor(source.color, (1-(i/this.maxWaves))));
    this.canGenerate = canGenerate ? canGenerate : () => { return true }; // responsiveness
  }
  update = () => {
    if (this.game.gameOver || this.source.destroyed) this.destroy();
    else if (this.canGenerate()) {
      let radius = this.source.getRadius();
      let spanX = Math.sin(this.source.theta) * radius;    // left-right span
      let spanY = Math.cos(this.source.theta) * radius;
      let offsetX = -Math.cos(this.source.theta) * radius; // dist behind obj
      let offsetY = -Math.sin(this.source.theta) * radius;
      let points = Array.from({length: this.density}, (p, i) => {
        let coeff = randomChoice([-1, 1]); // x and y offsets should always have opposite signs
        return new Vector2(this.source.loc.x + coeff * randomVal(0, spanX) + offsetX,
                           this.source.loc.y - coeff * randomVal(0, spanY) + offsetY);
      });
      this.waves.unshift(points); // newest wave at the front, closest to source
    } else {
      this.waves.unshift([]); // push an empty set so older waves can finish their fade animation
    }
    this.waves = this.waves.slice(0, this.maxWaves); // keep only latest N waves
  }
  render = () => { this.waves.forEach((wave, i) => dotPoints(wave, this.colorGradient[i])) }
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
      this.longPress = null;
      window.addEventListener('touchstart', this._handleTouchStart);
      window.addEventListener('touchend', this._handleTouchEnd);
    } else {
      window.addEventListener('keydown', this._handleKeyInput);
    }
    // start game
    this.newGame();
    this.frameReq = requestAnimationFrame(this.run);
  }
  _handleTouchStart = (event) => {
    event.preventDefault(); // block resize on double-tap
    if (!this.longPress) this.longPress = setTimeout((this.gameOver ? this.newGame : this.handlePause), LTAP_TIMEOUT);
    if (!this.waitingForDoubleTap) {
      this.waitingForDoubleTap = true;
      setTimeout(() => { this.waitingForDoubleTap = false }, DTAP_TIMEOUT);
    } else if (this.paused) { // recalibrate
      this.player.neutral = null; // neutral pos will reset on resume
      if (DEBUG) alert('gyroscope will reset on resume');
    }
  }
  _handleTouchEnd = (event) => { // long press
    event.preventDefault();
    clearTimeout(this.longPress);
    this.longPress = null;
  }
  _handleKeyInput = (event) => {
    if (!this.gameOver && event.key === 'Escape'){
       this.handlePause();
    } else if (this.gameOver && event.key === 'Escape') {
      this.newGame();
    }
  }
  handlePause = () => {
    this.paused = !this.paused;
    if (this.paused) {
      cancelAnimationFrame(this.frameReq);
      clearTimeout(this.asteroidTimer);
      this.pauseTime = Date.now();
      let pauseText = [
        'BLASTEROIDS',
        (MOBILE ? 'TILT' : 'SPACE') + ' TO MOVE',
        (MOBILE ? 'TAP' : 'CLICK') + ' TO SHOOT',
        (MOBILE ? 'HOLD' : 'ESC') + ' TO RESUME',
        DEBUG ? BUILD : randomChoice(['GOOD LUCK', 'GODSPEED', 'STAY SHARP', 'HAVE FUN', "SHAKE N' BAKE", 'GET READY', 'YOURS TRULY,',
                                      'MERRY CHRISTMAS', 'HAPPY HOLIDAYS'])
      ]
      // if (MOBILE) pauseText.splice(-1, 0, 'D-TAP TO SET GYRO');
      displayTextBox(pauseText, this.player.loc.x, this.player.loc.y);
    }
    else {
      this.lastTick += (Date.now() - this.pauseTime);
      this.spawnAsteroid();
      this.frameReq = requestAnimationFrame(this.run);
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
    resizeCanvas(); // covering all bases
    this.paused = false;
    this.pauseTime = null;
    this.gameOver = false;
    this.gameOverText = null;
    this.score = DEBUG ? 300 : 0;
    this.shots = 0;
    this.hits = 0;
    this.gameObjects = new Map(); // clear stray asteroids before player spawns
    this.player = new Player(this);
    this.timeToImpact = DEBUG ? 5000 : 2500;
    this.asteroidTimer = setTimeout(this.spawnAsteroid, this.timeToImpact);
    this.upgradeInPlay = false;
    this.createBgStars();
  }
  createBgStars = () => {
    this.bgStars = [];
    for (let i = 0; i < 1000; i++) { this.bgStars.push(new Vector2(randomVal(-canvas.width, canvas.width*2), randomVal(-canvas.height, canvas.height*2))); }
  }
  spawnAsteroid = (size=0, chain=true) => { // spawns a new asteroid then queues the next one on a decreasing  timer
    if (!this.gameOver) {
      let spawnClass = null;
      if (!this.upgradeInPlay && this.player.weapon.level < MAX_WEAPON_LVL && Math.floor(this.score * 0.0133) >= this.player.weapon.level) { // check every 75 points (* 0.0133)
        spawnClass = Upgrade;
        this.upgradeInPlay = true;
      } else if (this.score > 300) {
        spawnClass = randomChoice([Asteroid, BigAsteroid, Comet, UFO, UFO, UFO]);
      } else if (this.score > 200) {
        spawnClass = randomChoice([Asteroid, BigAsteroid, Comet, UFO]);
      } else if (this.score > 150) {
        spawnClass = randomChoice([Asteroid, BigAsteroid, BigAsteroid, Comet, Comet]);
      } else if (this.score > 100) {
        spawnClass = randomChoice([Asteroid, BigAsteroid, BigAsteroid, Comet]);
      } else if (this.score > 50) {
        spawnClass = randomChoice([Asteroid, Asteroid, BigAsteroid, BigAsteroid, BigAsteroid, Comet]);
      } else if (this.score > 3) {
        spawnClass = randomChoice([Asteroid, BigAsteroid]);
      } else {
        spawnClass = Asteroid;
      }
      new spawnClass(this, randomSpawn()); // new Vector2(x, y));
      if (this.timeToImpact > (DEBUG ? 5000 : 1000)) this.timeToImpact -= 25;
      if (chain) this.asteroidTimer = setTimeout(this.spawnAsteroid, this.timeToImpact, (this.score > 3 ? randomChoice([0, 1]) : 0));
    }
  }
  checkAsteroidCollision = (collisionObj) => {
    for (const k of this.gameObjects.keys()) {
      let gameObj = this.gameObjects.get(k);
      if ('isHazard' in gameObj && Math.abs(collisionObj.loc.x-gameObj.loc.x) < gameObj.getRadius() && Math.abs(collisionObj.loc.y-gameObj.loc.y) < gameObj.getRadius()) {
        if (!gameObj.isUpgrade) collisionObj.destroy();
        gameObj.destroy();
        // new ExplosionAnimation(this, gameObj.loc.copy(), gameObj.color, gameObj.getRadius());
        return true;
      }
    }
    return false;
  }
  createGameOverText = () => {
    let sharpshooter = (this.shots > 25 && this.hits >= this.shots * 0.9);
    let pacifist = (this.shots === 0);
    // D rank
    let rank = 'D';
    let commentPool = ["MIX IT UP A LIL' BIT", 'STAY IN SCHOOL', 'I BELIEVE IN YOU', 'SKILL ISSUE', 'TRY HARDER', 'JUST SAY NO'];
    if (pacifist) commentPool = [(MOBILE ? 'TAP' : 'CLICK') + ' TO SHOOT', 'DO A BARREL ROLL'];
    // C rank
    if (sharpshooter && this.score >= 25) {
      rank = 'C';
      commentPool = ['HEATING UP', "LET 'EM COOK"];
    }
    if (this.score >= 50) {
      rank = 'C';
      commentPool = pacifist ? ['NAILED IT', 'PHONE HOME'] : ['ROOKIE', 'NOT BAD', 'GETTING SOMEWHERE', 'GOING PLACES', 'MEDIUM WELL'];
    }
    // B rank
    if (sharpshooter && this.score >= 75) {
      rank = 'B';
      commentPool = ["NICE SHOOTIN' TEX", 'LOCKED IN'];
    }
    if (this.score >= 100) {
      rank = 'B';
      commentPool = pacifist ? ['CHOSEN ONE', 'EMPTY MIND'] : ['GOOD HUSTLE', 'VERY NICE', 'SOLID', 'RESPECT+', 'WELL DONE'];
    }
    if (sharpshooter && this.score >= 200) {
      rank = 'A'; 
      commentPool = ['HOT SHOT', 'EAGLE EYE'];
    }
    if (this.score >= 250) {
      rank = 'A';
      commentPool = ['TOP NOTCH', 'AMAZING', 'EXCELLENT', 'MISSION ACCOMPLISHED', 'RARE'];
      if (sharpshooter || pacifist || this.score >= 400) {
        rank = 'S';
        commentPool = pacifist ? ['ENLIGHTENED', 'WE COME IN PEACE'] : ['SEEK HELP', 'SHOW OFF', 'CHILL OUT', 'A WINNER IS YOU', 'RAW'];
      }
    }
    this.gameOverText = [
      'GAME OVER',
      'SCORE: '+this.score,
      // 'ACC  : '+(this.shots > 0 ? 100*this.hits/this.shots : 0).toFixed(1)+'%',
      'RANK : '+rank,
      randomChoice(commentPool), //comment,
      'THANKS FOR PLAYING',
      (MOBILE ? 'HOLD' : 'ESC') + ' FOR NEW GAME'
    ]
  }
  update = () => { 
    this.gameObjects.forEach((gameObj) => { gameObj.update() });
    if (this.gameOver) clearTimeout(this.asteroidTimer);
  }
  render = () => {
    resizeCanvas(); // done each frame in case the window is resized
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (this.bgStars) {
      if (!this.gameOver) { // couldn't use _inBounds() since check is per-axis
        let moveX = 0 < this.player.loc.x && this.player.loc.x < canvas.width;
        let moveY = 0 < this.player.loc.y && this.player.loc.y < canvas.height;
        this.bgStars.forEach(point => { 
          if (moveX) { point.x -= this.player.vel.x * PARALLAX; }
          if (moveY) { point.y -= this.player.vel.y * PARALLAX; }
        });
      }
      dotPoints(this.bgStars);
    }
    this.gameObjects.forEach((gameObj) => { gameObj.render() });
    let padding = PADDING * getScale()
    let fontSize = FONT_SIZE * getScale()
    displayText(this.score, padding, padding + fontSize);
    if (this.gameOver){
      if (!this.gameOverText) this.createGameOverText();
      displayTextBox(this.gameOverText, this.player.loc.x, this.player.loc.y);
    }
    if (DEBUG && this.player.tilt) {
      displayText('x:'+this.player.tilt.x, padding, canvas.height-fontSize*2);
      displayText('y:'+this.player.tilt.y, padding, padding + canvas.height-fontSize);
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
