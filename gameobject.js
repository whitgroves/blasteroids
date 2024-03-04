import * as utils from "./utils.js";

export class GameObject {
  constructor(game, loc=null, vel=null, radius=1, theta=0) {
    this.game = game;
    this.loc = loc ? loc.copy() : new utils.Vector2();
    this.vel = vel ? vel.copy() : new utils.Vector2();
    this.objId = this.game.register(this);
    this.radius = radius * utils.getScale();
    this.theta = theta;
    this.destroyed = false;
    this.canDestroy = false; // flag to stop update loop from immediately destroying objects that spawn offscreen
    this.parentId = null;
  }
  getRadius = () => { return this.radius }
  inBounds = ()=> {
    return -this.radius < this.loc.x && this.loc.x < utils.canvas.width  + this.radius &&
           -this.radius < this.loc.y && this.loc.y < utils.canvas.height + this.radius 
  }
  _points = (shape) => { 
    var points = [];
    shape.forEach(point => {
      var x = this.loc.x + this.radius * Math.cos(point + this.theta);
      var y = this.loc.y + this.radius * Math.sin(point + this.theta);
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
      if (this.inBounds()) { this._onDestroyAnimate() }
      this.game.deregister(this.objId); // stop updating/rendering and queue for cleanup
    }
  }
  _onUpdate = () => {} // virtual, wraps update() 
  update = () => {
    this._onUpdate();
    if (this.inBounds() || !this.canDestroy) {
      this.loc.add(this.vel.x, this.vel.y, this.game.deltaTime * utils.getScale());
      if (!this.canDestroy && this.inBounds()) this.canDestroy = true; // once it's in bounds for the first time, it can be destroyed
    }
    else this.destroy();
  }
  render = () => {} // virtual
}

export class Projectile extends GameObject {
  constructor(game, loc, theta) { super(game, loc, new utils.Vector2(Math.cos(theta), Math.sin(theta), utils.PROJ_V), 0, theta) }
  _onUpdate = () => {
    let hit = this.game.checkHazardCollision(this);
    if (hit && hit.value) {
      this.game.hits++;
      this.game.score += hit.value;
      this.canDestroy = true;
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
        // let xo2 = Math.sin(theta) * utils.OFFSET_RATIO * utils.getScale();
        // let yo2 = Math.cos(theta) * utils.OFFSET_RATIO * utils.getScale();
        // new Projectile(game, new utils.Vector2(loc.x-xo2, loc.y+yo2), theta);
        // new Projectile(game, new utils.Vector2(loc.x+xo2, loc.y-yo2), theta);
        new Projectile(game, loc, theta);
        setTimeout(() => { new Projectile(game, game.player.loc, game.player.theta) }, 70);
        break;
      default:
        new Projectile(game, loc, theta);
    }
    utils.safePlayAudio(utils.WEAPON_SFX);
  }
}

export class Player extends GameObject {
  constructor(game) {
    // utils.resizeCanvas(); // just in case
    super(game, new utils.Vector2(utils.playerSpawnX(), utils.playerSpawnY()));
    this.accel = utils.PLAYER_A;
    this.frict = utils.PLAYER_F;
    this.theta = -Math.PI * 0.5 // 0;
    this.radius = utils.PLAYER_R;
    this.target = null;
    this.firing = false;
    this.boosting = false;
    this.tilt = new utils.Vector2(); // track device tilt on utils.MOBILE to trigger movement 
    this.neutral = utils.MOBILE ? new utils.Vector2(0, utils.TILT_DEFAULT) : null; // neutral position for tilt movement
    this.weapon = new PlayerWeapon();
    this.color = utils.PLAYER_C;
    let animFunc = utils.MOBILE ?
                   () => { return this.theta < 0 || this._isTilted() } :
                   () => { return this.boosting || this.theta < 0 };
    new ParticleTrailAnimation(game, this, null, (utils.MOBILE ? 4 : 8), animFunc);
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
    if (!this.game.paused) {
      let beta = Math.max(-90, Math.min(event.beta, 90)); // [-180, 180) -> clamp to [-90, 90)
      let gamma = event.gamma; // [-90, 90)    
      let x = 0;
      let y = 0;
      switch (screen.orientation.type) {
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
      if (!this.neutral) this.neutral = this.tilt.copy(); // remember neutral position if it's been reset
    }
  }
  _onMouseMove = (event) => { this.target = new utils.Vector2(event.x, event.y) }
  _onMouseDown = (event) => { if (event.button === 0) this.firing = true }
  _onKeyDown = (event) => { this.boosting = event.key === ' ' }
  _onKeyUp = (event) => { this.boosting = !event.key === ' ' }
  _onDestroy = () => {
    this.game.gameOver = true;
    this.deregisterInputs();
    this.vel = new utils.Vector2(); // stop bg x-scroll on game over
    // utils.safePlayAudio(BOOM_SFX_2); // clashes with the endgame jingle
  }
  _onDestroyAnimate = () => { new ImpactRingAnimation(this.game, this.loc, this.color, this.getRadius()*10); }
  _isTilted = () => { return this.neutral && Math.abs(this.tilt.x-this.neutral.x) > utils.TILT_THRESH | Math.abs(this.tilt.y-this.neutral.y) > utils.TILT_THRESH}
  _safeUpdateVelocity = (v) => {
    v *= (1 - this.frict);
    v = Math.max(-utils.PLAYER_V, Math.min(v, utils.PLAYER_V));            
    if (Math.abs(v) < utils.PLAYER_V_FLOOR) v = 0;
    return v;
  }
  update = () => {
    if (!this.firing && this._isTilted()) {
      let newTheta = Math.atan2(this.tilt.y-this.neutral.y, this.tilt.x-this.neutral.x);
      let dt = newTheta - this.theta;
      if (dt > Math.PI) dt -= utils.PI_2;
      this.theta += 0.05 * dt;
    }
    if (this.target) this.theta = Math.atan2(this.target.y-this.loc.y, this.target.x-this.loc.x);
    this.theta %= utils.PI_2; // radians
    if (this.firing) { // fire projectile
      this.weapon.fire(this.game, this.loc.copy(), this.theta);
      this.firing = false;
      this.game.shots++;
      if (utils.MOBILE) setTimeout(() => { if (!this.firing) this.target = null }, 1000); // stay on target for 1s until/unless a new one is set
    }
    // apply velocity    
    if (this._isTilted()) this.vel.add(this.tilt.x-this.neutral.x, this.tilt.y-this.neutral.y, this.accel * this.game.deltaTime * 0.0111 * utils.getScale()); // scale by 1/90 to normalize raw tilt input
    if (this.boosting) this.vel.add(Math.cos(this.theta), Math.sin(this.theta), this.accel * this.game.deltaTime);
    this.vel.apply(this._safeUpdateVelocity);
    this.loc.x = Math.max(this.radius, Math.min(this.loc.x + this.vel.x, utils.canvas.width -this.radius));
    this.loc.y = Math.max(this.radius, Math.min(this.loc.y + this.vel.y, utils.canvas.height-this.radius));
    this.game.checkHazardCollision(this); // collision check
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
  // _onUpdate = () => { this.game.checkHazardCollision(this) } // enables asteroid-to-asteroid collision but not fun
  _onDestroyAnimate = () => { new ExplosionAnimation(this.game, this.loc, this.color, this.getRadius()); } // default
  _onDestroyAudio = () => { utils.safePlayAudio(utils.BOOM_SFX_0); } // default
  _onDestroyHazard = () => {} // virtual, re-wraps destruction logic
  _onDestroy = () => {
    this._onDestroyHazard(); // called before score update so subclass can change its value if conditions are met
    if (!this.game.gameOver) {
      if (this.inBounds()) this._onDestroyAudio();
      else this.game.score++; // full hazard value is added by the Projectile class if hit, otherwise grant 1 point for dodging
    }
  }
  render = () => { utils.tracePoints(this._points(this.shape), this.shape, this.color); } // using this.shape as enclose flag
}

export class Asteroid2 extends Hazard {
  constructor(game, loc, theta=null, vscale=null, radius=null, shape=null, color=null, value=null) {
    let sizeCap = (game.score > 25 ? 3 : game.score > 3 ? 2 : 1);
    let grade = radius ? Math.max(1, Math.floor(radius*utils.ROCK_R_DIV)) : utils.randomInt(1, sizeCap);
    radius = (radius || utils.ROCK_R * grade) * (1 + utils.randomVal(-0.1, 0.1));
    radius = Math.min(radius, utils.ROCK_R_MAX);
    vscale = (vscale || utils.ROCK_V) * (1 + utils.randomVal(-0.15 * grade, 0));
    shape = shape || utils.OCTAGON;
    color = color || utils.ROCK_C;
    value = value || 1;
    super(game, loc, vscale, theta, radius, shape, color, value);
    this.shape = this.shape.map(x => x += utils.randomVal(-2, 2) / shape.length);
    this.vscale = vscale;
    this.isBig = radius > utils.ROCK_R * 1.5; // tried grade > 1 instead, but this approach enables multi-hit asteroids
  }
  _onDestroyAudio = () => {
    if (this.isBig) utils.safePlayAudio(utils.BOOM_SFX_1);
    else utils.safePlayAudio(utils.BOOM_SFX_0);
  }
  _onDestroyHazard = () => {
    if (this.isBig && this.inBounds()) {
      let flipTheta = utils.randomChoice([true, false]);
      let remainingRadius = this.radius;
      let loops = 0;
      let chunks = Math.floor(this.radius*utils.ROCK_R_DIV);
      while (remainingRadius >= utils.ROCK_R && loops < chunks) {
        let newRadius = Math.max(utils.randomVal(utils.ROCK_R, remainingRadius-utils.ROCK_R), utils.ROCK_R);
        remainingRadius -= newRadius;
        let theta = this.theta + (chunks === 1 ? 0 : ((flipTheta ? -1 : 1) * Math.PI * (loops+1 % 3 === 0 ?
                                                                                        utils.randomVal(-0.125, 0.125) : 
                                                                                        utils.randomVal(0.1667, 0.25))));
        let asteroid = new Asteroid2(this.game, this.loc.copy(), theta, this.vscale*(1-utils.randomVal(0,0.1)), newRadius);
        asteroid.parentId = this.objId;
        flipTheta = !flipTheta;
        loops++;
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
  _onDestroyAnimate = () => { new ImpactRingAnimation(this.game, this.loc, this.color, this.getRadius()*3)}
  render = () => {
    utils.tracePoints(this._points(this.shape), this.shape, this.color, this.colorGradient[this.gradientIndex]);
    if (this.gradientIndex <= 0 || this.gradientIndex >= this.colorGradient.length) { this.gradientStep *= -1; }
    this.gradientIndex += this.gradientStep;
  }
}

export class Comet extends Asteroid2 {
  constructor(game, loc) {
    super(game, loc, null, utils.COMET_V, utils.COMET_R, utils.PENTAGON, utils.COMET_C, 7);
    this._turnAmt = utils.randomVal(-utils.COMET_TA, utils.COMET_TA); // follows a random arc
    new ParticleTrailAnimation(game, this);
    if (utils.COMET_SFX_0.paused) utils.safePlayAudio(utils.COMET_SFX_0);
  }
  _onDestroyAnimate = () => { new ExplosionAnimation(this.game, this.loc, this.color, this.getRadius()*7); }
  _onDestroyAudio = () => {
    if (!utils.COMET_SFX_0.muted) utils.COMET_SFX_0.muted = true; // force whoosh sound to stop
    // utils.safeToggleAudio(utils.COMET_SFX_0, 'pauseOnly');
    utils.safePlayAudio(utils.COMET_SFX_1);
  }
  _onUpdate = () => {
    this.game.checkHazardCollision(this);
    this.theta += this._turnAmt;
    this.vel.update(Math.cos(this.theta), Math.sin(this.theta), utils.COMET_V);
    if (utils.COMET_SFX_0.muted) utils.COMET_SFX_0.muted = false;
  }
}

export class EnemyProjectile extends Hazard {
  constructor(game, loc, theta, parentId) { 
    super(game, loc, utils.PROJ_V, theta, game.player.getRadius(), null, utils.UFO_C, 1); // player radius used for collision
    this.parentId = parentId; // collision filter
  }
  _onUpdate = () => { this.game.checkHazardCollision(this) }
  _points = () => { return [this.loc, new utils.Vector2(this.loc.x-this.vel.x*utils.PROJ_L, this.loc.y-this.vel.y*utils.PROJ_L)]; }
  _onDestroyAnimate = () => { new ImplosionAnimation(this.game, this.loc, this.color, utils.PROJ_L); }
}

export class UFO extends Hazard {
  constructor(game, loc) {
    utils.safePlayAudio(utils.UFO_SFX_0);
    super(game, loc, utils.UFO_V, null, utils.UFO_R, utils.DIAMOND, utils.UFO_C, 5);
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
        new EnemyProjectile(this.game, this.loc, this.theta, this.objId);
      } // but keep recursing so pattern continues on resume
      this._trigger = setTimeout(this._fire, this._getFireRate());
    }
  }
  _onDestroyAnimate = () => { new ImplosionAnimation(this.game, this.loc, this.color, this.getRadius()); }
  _onDestroyHazard = () => {
    clearTimeout(this._trigger); // ceasefire
    utils.UFO_SFX_0.muted = true; // stop engine noise
    if (!this.inBounds() && !this.game.gameOver) {
      setTimeout(() => { new UFO(this.game, utils.randomSpawn()) }, this._getFireRate());
    }
  }
  _onUpdate = () => {
    this.game.checkHazardCollision(this);
    if (this._getActiveState()) {
      let newTheta = Math.atan2(this.game.player.loc.y-this.loc.y, this.game.player.loc.x-this.loc.x);
      let dt = newTheta - this.theta;
      if (dt > Math.PI) dt -= utils.PI_2;
      // if (Math.abs(dt) > Math.PI/4) 
      this.theta += 0.05 * dt;
      this.theta %= Math.PI * 2;
      this.vel.update(Math.cos(this.theta), Math.sin(this.theta), utils.UFO_V);
      this._chaseFrames += 1;
      utils.UFO_SFX_0.muted = false;
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
      // if (this.flicker) console.log('flicker: '+this.baseColor+' '+this.flicker);
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
  constructor(game, loc, color, maxRadius) {
    super(game, loc, color, maxRadius);
    this.waveDensity = 10;
  }
  render = () => {
    for (let i = 0; i < this.waves.length; i++) {
      let waveRadius = ((this.maxFrames - i) / this.maxFrames) * this.maxRadius;
      utils.dotPoints(this._points(this.waves[i], waveRadius), this.color);
    }
  }
}

export class ImpactRingAnimation extends ExplosionAnimation {
  constructor(game, loc, color, maxRadius) {
    super(game, loc, color, maxRadius);
    // this.maxFrames = utils.FPS;
    this.waveDensity = 10;
  }
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