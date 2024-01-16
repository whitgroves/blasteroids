const canvas = document.getElementById("mainCanvas");
const ctx = canvas.getContext("2d");

// https://stackoverflow.com/questions/4037212/html-canvas-full-screen
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// constants (SETTINGS)
const HALF_W = canvas.width / 2;
const HALF_H = canvas.height / 2;

const TRIANGLE = [(3 * Math.PI / 2), (Math.PI / 4), (3 * Math.PI / 4)];
const PLAYER_R = 16 // player radius
const PLAYER_V = 4 // player max vel
const T_OFFSET = Math.PI / 2; // theta offset

const DEF_COLOR = '#FFF'

// player
let px = HALF_W;
let py = HALF_H;
let pt = 0; // theta
let pvx = 0; // velocity x
let pvy = 0; // velocity y
let pa = 0.4; // acceleration coeff
let pf = 0.01; // friction coeff

function updateVelocity(vel) {
  vel *= 1 - pf;
  vel = Math.max(-PLAYER_V, Math.min(vel, PLAYER_V))
  if (Math.abs(vel) < 0.01) vel = 0;
  return vel;
}

function updatePlayer() {
  pvx = updateVelocity(pvx);
  pvy = updateVelocity(pvy);
  console.log(pvx, pvy);
  px = Math.max(0, Math.min(px + pvx, canvas.width));
  py = Math.max(0, Math.min(py + pvy, canvas.height));
} 

function drawPlayer() {
  points = [];
  TRIANGLE.forEach(point => {
    x = px + PLAYER_R * Math.cos(point + pt);
    y = py + PLAYER_R * Math.sin(point + pt);
    points.push({'x':x, 'y':y});
  });
  ctx.beginPath();
  ctx.strokeStyle = DEF_COLOR;
  ctx.moveTo(points[2].x, points[2].y);
  points.forEach(point => {
    ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();
  ctx.closePath();
}

// input handlers
document.onmousemove = (event) => {
  pt = Math.atan2(event.y-py, event.x-px) + T_OFFSET;
  pt %= 2 * Math.PI;
};

document.onkeydown = (event) => {
  if (event.key === ' ') {
    pvx += Math.cos(pt - T_OFFSET) * pa;
    pvy += Math.sin(pt - T_OFFSET) * pa;
  }
}

// game loop
function run() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  updatePlayer();
  drawPlayer();
}

// init
const screenRefresh = setInterval(run, 10);