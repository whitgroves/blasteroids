import * as utils from "./utils.js";

console.log("Game audio used courtesy of freesound.org and the respective artists. \
For detailed attribution, view the README at https://github.com/whitgroves/blasteroids.");

// const USER_CONFIG = document.cookie.split(";");
// const safeGetSetting = (settingName) => {
//   let setting = USER_CONFIG.find((configSetting) => configSetting.startsWith(settingName));
//   return setting ? setting.split("=")[1] : "";
// }
// let newUser = (safeGetSetting("new_user") !== "false");

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
    // TODO: pause game
  }
});

class GameObject {
  constructor(game, loc=null, vel=null, radius=1, theta=0) {
    this.game = game;
    this.loc = loc ? loc.copy() : new utils.Vector2();
    this.vel = vel ? vel.copy() : new utils.Vector2();
    this.objId = this.game.register(this);
    this._radius = radius;
    this.theta = theta;
    this.destroyed = false;
  }
  getRadius = () => { return utils.getScale() * this._radius } // wrapper to rescale on landscape-utils.MOBILE
  inBounds = () => { return -this.getRadius() <= this.loc.x && this.loc.x <= utils.canvas.width+this.getRadius() 
                         && -this.getRadius() <= this.loc.y && this.loc.y <= utils.canvas.height+this.getRadius() }
  _points = (shape) => { 
    var points = [];
    shape.forEach(point => {
      var x = this.loc.x + this.getRadius() * Math.cos(point + this.theta);
      var y = this.loc.y + this.getRadius() * Math.sin(point + this.theta);
      points.push(new utils.Vector2(x, y));
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
      this.loc.add(this.vel.x, this.vel.y, this.game.deltaTime * utils.getScale());
    }
    else { this.destroy(); } 
  }
  render = () => {} // virtual
}

class Projectile extends GameObject {
  constructor(game, loc, theta) { super(game, loc, new utils.Vector2(Math.cos(theta), Math.sin(theta), utils.PROJ_V), 0, theta) }
  update = () => {
    let hit = this.game.checkAsteroidCollision(this);
    if (!hit && this.inBounds()) {
      this.loc.add(this.vel.x, this.vel.y, this.game.deltaTime * utils.getScale());
    } else {
      if (hit) this.game.hits++;
      this.destroy();
    }
  }
  render = () => { utils.tracePoints([this.loc, new utils.Vector2(this.loc.x-this.vel.x*utils.PROJ_L, this.loc.y-this.vel.y*utils.PROJ_L)], false, utils.PLAYER_C) }
}

class PlayerWeapon {
  constructor(level=1) { this.level = level }
  fire(game, loc, theta) {
    switch (this.level) {
      case 4:
        let xo4 = Math.sin(theta) * OFFSET_RATIO * utils.getScale();
        let yo4 = Math.cos(theta) * OFFSET_RATIO * utils.getScale();
        let cone4 = 0.03125; // 1 / 32
        let cone4_sm = 0.0078125; // 1 / 128
        new Projectile(game, new utils.Vector2(loc.x-xo4*3, loc.y+yo4*3), theta+(Math.PI*cone4));
        new Projectile(game, new utils.Vector2(loc.x-xo4, loc.y+yo4), theta+(Math.PI*cone4_sm));
        new Projectile(game, new utils.Vector2(loc.x+xo4, loc.y-yo4), theta-(Math.PI*cone4_sm));
        new Projectile(game, new utils.Vector2(loc.x+xo4*3, loc.y-yo4*3), theta-(Math.PI*cone4));
        break;
      case 3:
        let cone3 = 0.0625; // 1/16
        new Projectile(game, loc, theta);
        new Projectile(game, loc, theta+(Math.PI*cone3));
        new Projectile(game, loc, theta-(Math.PI*cone3));
        break;
      case 2:
        let xo2 = Math.sin(theta) * OFFSET_RATIO * utils.getScale();
        let yo2 = Math.cos(theta) * OFFSET_RATIO * utils.getScale();
        new Projectile(game, new utils.Vector2(loc.x-xo2, loc.y+yo2), theta);
        new Projectile(game, new utils.Vector2(loc.x+xo2, loc.y-yo2), theta);
        break;
      default:
        new Projectile(game, loc, theta);
    }
    utils.safePlayAudio(utils.WEAPON_SFX);
  }
}

class Player extends GameObject {
  constructor(game) {
    utils.resizeCanvas(); // ensure player ALWAYS spawns at mid-screen
    super(game, new utils.Vector2(utils.canvas.width*0.5, utils.canvas.height*0.5));
    this.accel = utils.PLAYER_A;
    this.frict = utils.PLAYER_F;
    this.theta = -Math.PI * 0.5 // 0;
    this._radius = utils.PLAYER_R;
    this.target = null;
    this.firing = false;
    this.boosting = false;
    this.tilt = new utils.Vector2(); // track device tilt on utils.MOBILE to trigger movement 
    this.neutral = utils.MOBILE ? new utils.Vector2(0, 22) : null; // neutral position for tilt movement
    this.registerInputs(); // TODO: move so it's managed entirely within Game (priority -1)
    this.weapon = new PlayerWeapon();
    this.color = utils.PLAYER_C;
    new ParticleTrailAnimation(game, this, null, 8, () => { return this.boosting || this._isTilted() });
  }
  // generally, each event sets an update flag, then the response is handled during update()
  // otherwise we'd stall the game doing trig on every mouse move or keypress
  registerInputs = () => {
    if (utils.MOBILE) {
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
    if (utils.MOBILE) { 
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
    this.target = new utils.Vector2(event.touches[0].clientX, event.touches[0].clientY);
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
    this.tilt = new utils.Vector2(x, y);
    if (!this.neutral) this.neutral = this.tilt.copy(); // remember neutral position if one isn't set
    if (lastOrientation != screenOrientation) {
      lastOrientation = screenOrientation;
      if (!this.game.paused) this.game.handlePause(); // if the orientation changed, pause the game
      utils.resizeCanvas();                                 // adjust for new dims
      this.game.createBgStars();                      // stars need to be redrawn because of new dims
      // if (utils.DEBUG) alert('x:'+utils.canvas.width.toFixed(2)+' y:'+utils.canvas.height.toFixed(2));
    }
  }
  _onMouseMove = (event) => { this.target = new utils.Vector2(event.x, event.y) }
  _onMouseDown = (event) => { if (event.button === 0) this.firing = true }
  _onKeyDown = (event) => { this.boosting = event.key === ' ' }
  _onKeyUp = (event) => { this.boosting = !event.key === ' ' }
  _onDestroy = () => {
    this.game.gameOver = true;
    this.deregisterInputs();
    // utils.safePlayAudio(BOOM_SFX_2); // clashes with the endgame jingle
    // new ExplosionAnimation(this.game, this.loc.copy(), this.color, this.getRadius()*10);
    // BUG: the game doesn't update in the game over state, so this^ animation never plays (WONTFIX)
  }
  _isTilted = () => { return this.neutral && Math.abs(this.tilt.x-this.neutral.x) > TILT_THRESH | Math.abs(this.tilt.y-this.neutral.y) > TILT_THRESH}
  _safeUpdateVelocity = (v) => {
    v *= (1 - this.frict);
    v = Math.max(-utils.PLAYER_V, Math.min(v, utils.PLAYER_V));            
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
    if (utils.MOBILE && this._isTilted()) { // https://developer.mozilla.org/en-US/docs/Web/API/Device_orientation_events/Orientation_and_motion_data_explained
      this.vel.add(this.tilt.x-this.neutral.x, this.tilt.y-this.neutral.y, this.accel * this.game.deltaTime * 0.0111 * utils.getScale()); // scale by 1/90 to normalize raw tilt input
    } 
    if (!utils.MOBILE && this.boosting) this.vel.add(Math.cos(this.theta), Math.sin(this.theta), this.accel * this.game.deltaTime);
    this.vel.apply(this._safeUpdateVelocity);
    this.loc.x = Math.max(0, Math.min(this.loc.x + this.vel.x, utils.canvas.width));
    this.loc.y = Math.max(0, Math.min(this.loc.y + this.vel.y, utils.canvas.height));
    this.game.checkAsteroidCollision(this); // collision check
  }
  render = () => { utils.tracePoints(this._points(utils.TRIANGLE), true, this.color, this.color); } // TODO: change color based on upgrade level
}

class Hazard extends GameObject {
  constructor(game, loc, vscale, theta, radius, shape, color, value) {
    theta = theta || Math.atan2(game.player.loc.y-loc.y, game.player.loc.x-loc.x);
    super(game, loc, new utils.Vector2(Math.cos(theta), Math.sin(theta), vscale), radius, theta);
    this.shape = shape;
    this.color = color;
    this.value = value;
    this.isHazard = true; // collision filter
  }
  _onDestroyAnimate = () => { new ExplosionAnimation(this.game, this.loc, this.color, this.getRadius()); } // default
  _onDestroyAudio = () => { utils.safePlayAudio(utils.BOOM_SFX_0); } // default
  _onDestroyHazard = () => {} // virtual, re-wraps destruction logic
  _onDestroy = () => {
    this._onDestroyHazard(); // called before score update so subclass can change its value if conditions are met
    if (!this.game.gameOver) {
      this.game.score += this.value;
      if (this.inBounds()) this._onDestroyAudio();
    }
  }
  render = () => { utils.tracePoints(this._points(this.shape), this.shape, this.color); } // using this.shape as enclose flag
}

class Asteroid extends Hazard {
  constructor(game, loc, theta=null, vscale=null, radius=null, shape=null, color=null, value=null) {
    vscale = vscale || utils.ROCK_V;
    radius = radius || utils.ROCK_R;
    shape = shape || utils.OCTAGON;
    color = color || utils.ROCK_C;
    value = value || 1;
    super(game, loc, vscale, theta, radius, shape, color, value);
    this.shape = this.shape.map(x => x += utils.randomVal(-1, 1) * (shape.length**-1)); // +/- 1/N
  }
}

class BigAsteroid extends Asteroid {
  constructor(game, loc) {
    super(game, loc, null, null, utils.BIGROCK_R, null, null, 3);
  }
  _onDestroyAudio = () => { utils.safePlayAudio(utils.BOOM_SFX_1); }
  _onDestroyHazard = () => { // spawn 2 asteroids in a 120 degree cone
    if (this.inBounds()) {
      new Asteroid(this.game, this.loc.copy(), this.theta + Math.PI * utils.randomVal(0.1667, 0.25));
      new Asteroid(this.game, this.loc.copy(), this.theta - Math.PI * utils.randomVal(0.1667, 0.25)); 
      if (this.game.score > 25 && utils.randomChoice([true, false])) { // 3rd can spawn after a specific score is reached
        new Asteroid(this.game, this.loc.copy(), this.theta + Math.PI * utils.randomVal(-0.1667, 0.1667));
      }
    }
  }
}

class Upgrade extends Hazard { // not really a hazard but behavior is 90% the same
  constructor(game, loc) {
    utils.safePlayAudio(utils.UPGRADE_SFX_1);
    super(game, loc, utils.UPGRADE_V, null, utils.UPGRADE_R, utils.HEXAGON, utils.UPGRADE_C, 0);
    this.isUpgrade = true; // flag so collision doesn't kill the player
    this.glowFrames = FPS*2;
    this.colorGradient = Array.from({length: this.glowFrames}, (c, i) => utils.fadeColor(this.color, 1-(i/this.glowFrames)));
    this.gradientIndex = 0;
    this.gradientStep = -1; // will flip on first call to `render()`
  }
  _onDestroy = () => {
    if (this.inBounds() && this.game.player.weapon.level < utils.MAX_WEAPON_LVL) { // skip to the highest available level
      this.game.player.weapon.level = Math.min(utils.MAX_WEAPON_LVL, Math.floor(this.game.score * 0.0133) + 1); // * 1/75
      utils.safePlayAudio(utils.UPGRADE_SFX_0);
    }
    setTimeout(() => { this.game.upgradeInPlay = false }, utils.randomVal(5000, 10000)); // if missed, wait 5-10s to respawn
  }
  _onDestroyAnimate = () => { new ImpactRingAnimation(this.game, this.loc, this.color, this.getRadius() * 5)}
  render = () => {
    utils.tracePoints(this._points(this.shape), this.shape, this.color, this.colorGradient[this.gradientIndex]);
    if (this.gradientIndex <= 0 || this.gradientIndex >= this.colorGradient.length) { this.gradientStep *= -1; }
    this.gradientIndex += this.gradientStep;
  }
}

class Comet extends Asteroid {
  constructor(game, loc) {
    super(game, loc, null, utils.COMET_V, utils.COMET_R, utils.PENTAGON, utils.COMET_C, 0); // only give points if hit
    this._turnAmt = utils.randomVal(-utils.COMET_TA, utils.COMET_TA); // follows a random arc
    new ParticleTrailAnimation(game, this);
    utils.safePlayAudio(utils.COMET_SFX_0);
  }
  _onDestroyAnimate = () => { new ExplosionAnimation(this.game, this.loc, this.color, this.getRadius()*7); }
  _onDestroyAudio = () => {
    utils.COMET_SFX_0.muted = true; // force whoosh sound to stop
    utils.safePlayAudio(utils.COMET_SFX_1);
  }
  _onDestroyHazard = () => { if (this.inBounds()) { this.value = 7; } }
  _onUpdate = () => {
    this.theta += this._turnAmt;
    this.vel.set(Math.cos(this.theta), Math.sin(this.theta), utils.COMET_V);
  }
}

class EnemyProjectile extends Hazard {
  constructor(game, loc, theta) { 
    super(game, loc, utils.PROJ_V, theta, game.player.getRadius(), null, utils.UFO_C, 1); // player radius used for collision
  }
  _points = () => { return [this.loc, new utils.Vector2(this.loc.x-this.vel.x*utils.PROJ_L, this.loc.y-this.vel.y*utils.PROJ_L)]; }
}

class UFO extends Hazard {
  constructor(game, loc) {
    utils.safePlayAudio(utils.UFO_SFX_0);
    super(game, loc, utils.UFO_V, null, utils.UFO_R, utils.DIAMOND, utils.UFO_C, 0);
    this._chaseFrames = 0;
    this._chaseLimit = Math.max(3000, 5000-game.timeToImpact); // longer games => longer chases
    this._trigger = setTimeout(this._fire, this._getFireRate()); // must store timeout response to clear it later
    this.glowFrames = utils.FPS*2.5;
    this.colorGradient = Array.from({length: this.glowFrames}, (c, i) => utils.fadeColor(this.color, 1-(i/this.glowFrames)));
    this.gradientIndex = 0;
    this.gradientStep = -1; // will flip on first call to `render()`
  }
  _getActiveState = () => { return !this.game.gameOver && this._chaseFrames < this._chaseLimit; }
  _getFireRate = () => { return Math.max(1000, 1500-this.game.score) }; // slowly increase fire rate with score
  _fire = () => {
    if (this._getActiveState()) {
      if (!this.game.paused) { // fire blanks while paused
        utils.safePlayAudio(UFO_SFX_1);
        new EnemyProjectile(this.game, this.loc, this.theta);
      } // but keep recursing so pattern continues on resume
      this._trigger = setTimeout(this._fire, this._getFireRate());
    }
  }
  _onDestroyAnimate = () => { new ImpactRingAnimation(this.game, this.loc, this.color, this.getRadius()*5); }
  _onDestroyHazard = () => {
    clearTimeout(this._trigger); // ceasefire
    utils.UFO_SFX_0.muted = true; // stop engine noise until next UFO spawns
    if (this.inBounds()) { this.value = 8; }
    else if (!this.game.gameOver) { // if it makes it safely out of bounds, spawn back in with the next hazard
      setTimeout(() => { new UFO(this.game, utils.randomSpawn()); }, this.game.timeToImpact);
    }
  }
  _onUpdate = () => {
    if (this._getActiveState()) {
      let newTheta = Math.atan2(this.game.player.loc.y-this.loc.y, this.game.player.loc.x-this.loc.x);
      let dt = newTheta - this.theta;
      if (Math.abs(dt) > Math.PI/4) this.theta += 0.05 * dt;
      this.vel.set(Math.cos(this.theta), Math.sin(this.theta), utils.UFO_V);
      this._chaseFrames += 1;
      if (utils.UFO_SFX_0.ended) { utils.safePlayAudio(utils.UFO_SFX_0); }
    }
  }
  render = () => {
    utils.tracePoints(this._points(this.shape), this.shape, this.color, this.colorGradient[this.gradientIndex]);
    if (this.gradientIndex <= 0 || this.gradientIndex >= this.colorGradient.length) { this.gradientStep *= -1; }
    this.gradientIndex += this.gradientStep;
  }
}

class ExplosionAnimation extends GameObject {
  constructor(game, loc, color=utils.LINE_COLOR, maxRadius) {
    super(game, loc, null, (maxRadius * 0.5));
    this.color = color;
    this.baseColor = color;
    this.maxRadius = maxRadius;
    this.maxFrames = utils.FPS * 0.5; // complete in ~1/2s
    this.currentFrame = 0;
    this.waves = [];
    this.waveDensity = 5;
  }
  _points = (shape, radius) => { 
    var points = [];
    shape.forEach(point => {
      var x = this.loc.x + radius * Math.cos(point);
      var y = this.loc.y + radius * Math.sin(point);
      points.push(new utils.Vector2(x, y));
    });
    return points;
  }
  update = () => {
    if (this.currentFrame > this.maxFrames) this.destroy();
    else {
      if (this.currentFrame < this.maxFrames * 0.5) {
        let shape = []; // NOTE: tried using theta to shape an impact cone but the full ring looks better 90% of the time
        while (shape.length < this.waveDensity) { shape.push(utils.randomVal(0, Math.PI * 2)); }
        this.waves.push(shape); // make a new wave at the center
      }
      if (this.flicker) console.log('flicker: '+this.baseColor+' '+this.flicker);
      this.color = utils.fadeColor(this.baseColor, (1 - (this.currentFrame / this.maxFrames)**2));
      this.currentFrame++;
    }
  }
  render = () => {
    for (let i = 0; i < this.waves.length; i++) {
      let waveRadius = (this.currentFrame / this.maxFrames) * this.maxRadius + (this.waves.length - i);
      utils.dotPoints(this._points(this.waves[i], waveRadius), this.color);
    }
  }
}

class ImplosionAnimation extends ExplosionAnimation {
  render = () => {
    for (let i = 0; i < this.waves.length; i++) {
      let waveRadius = ((this.maxFrames - i) / this.maxFrames) * this.maxRadius;
      utils.dotPoints(this._points(this.waves[i], waveRadius), this.color);
    }
  }
}

class ImpactRingAnimation extends ExplosionAnimation {
  render = () => {
    for (let i = 0; i < this.waves.length; i++) {
      let waveRadius = (this.currentFrame / this.maxFrames) * this.maxRadius;
      utils.dotPoints(this._points(this.waves[i], waveRadius), this.color);
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
    this.colorGradient = Array.from({length: this.maxWaves}, (c, i) => utils.fadeColor(source.color, 1-(i/this.maxWaves)));
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
        let coeff = utils.randomChoice([-1, 1]); // x and y offsets should always have opposite signs
        return new utils.Vector2(this.source.loc.x + coeff * utils.randomVal(0, spanX) + offsetX,
                           this.source.loc.y - coeff * utils.randomVal(0, spanY) + offsetY);
      });
      this.waves.unshift(points); // newest wave at the front, closest to source
    } else {
      this.waves.unshift([]); // push an empty set so older waves can finish their fade animation
    }
    this.waves = this.waves.slice(0, this.maxWaves); // keep only latest N waves
  }
  render = () => { this.waves.forEach((wave, i) => utils.dotPoints(wave, this.colorGradient[i])) }
}

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
    if (!this.gameOver && event.key === utils.START_KEY){
       this.handlePause();
    } else if (this.gameOver && event.key === utils.START_KEY) {
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
      this.new ? 'BLASTEROIDS' : 'YOU ARE HERE',
      (utils.MOBILE ? 'TILT' : 'SPACE') + ' TO MOVE',
      (utils.MOBILE ? 'TAP' : 'CLICK') + ' TO SHOOT',
      (utils.MOBILE ? 'LONG PRESS' : utils.START_KEY.toUpperCase()) + ' TO ' + (this.new ? 'START' : 'RESUME'),
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
      (utils.MOBILE ? 'HOLD' : 'ESC') + ' FOR NEW GAME'
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