import * as utils from "./utils.js";

export class GameObject {
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

export class Projectile extends GameObject {
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

export class PlayerWeapon {
  constructor(level=1) { this.level = level }
  fire(game, loc, theta) {
    switch (this.level) {
      case 4:
        let xo4 = Math.sin(theta) * utils.OFFSET_RATIO * utils.getScale();
        let yo4 = Math.cos(theta) * utils.OFFSET_RATIO * utils.getScale();
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
        let xo2 = Math.sin(theta) * utils.OFFSET_RATIO * utils.getScale();
        let yo2 = Math.cos(theta) * utils.OFFSET_RATIO * utils.getScale();
        new Projectile(game, new utils.Vector2(loc.x-xo2, loc.y+yo2), theta);
        new Projectile(game, new utils.Vector2(loc.x+xo2, loc.y-yo2), theta);
        break;
      default:
        new Projectile(game, loc, theta);
    }
    utils.safePlayAudio(utils.WEAPON_SFX);
  }
}

export class Player extends GameObject {
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

export class Hazard extends GameObject {
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

export class Asteroid extends Hazard {
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

export class BigAsteroid extends Asteroid {
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

export class Upgrade extends Hazard { // not really a hazard but behavior is 90% the same
  constructor(game, loc) {
    utils.safePlayAudio(utils.UPGRADE_SFX_1);
    super(game, loc, utils.UPGRADE_V, null, utils.UPGRADE_R, utils.HEXAGON, utils.UPGRADE_C, 0);
    this.isUpgrade = true; // flag so collision doesn't kill the player
    this.glowFrames = utils.FPS*2;
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

export class Comet extends Asteroid {
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

export class EnemyProjectile extends Hazard {
  constructor(game, loc, theta) { 
    super(game, loc, utils.PROJ_V, theta, game.player.getRadius(), null, utils.UFO_C, 1); // player radius used for collision
  }
  _points = () => { return [this.loc, new utils.Vector2(this.loc.x-this.vel.x*utils.PROJ_L, this.loc.y-this.vel.y*utils.PROJ_L)]; }
}

export class UFO extends Hazard {
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
        utils.safePlayAudio(utils.UFO_SFX_1);
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

export class ExplosionAnimation extends GameObject {
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

export class ImplosionAnimation extends ExplosionAnimation {
  render = () => {
    for (let i = 0; i < this.waves.length; i++) {
      let waveRadius = ((this.maxFrames - i) / this.maxFrames) * this.maxRadius;
      utils.dotPoints(this._points(this.waves[i], waveRadius), this.color);
    }
  }
}

export class ImpactRingAnimation extends ExplosionAnimation {
  render = () => {
    for (let i = 0; i < this.waves.length; i++) {
      let waveRadius = (this.currentFrame / this.maxFrames) * this.maxRadius;
      utils.dotPoints(this._points(this.waves[i], waveRadius), this.color);
    }
  }
}

export class ParticleTrailAnimation extends GameObject {
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