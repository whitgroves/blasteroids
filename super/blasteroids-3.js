const BUILD = '2024.01.30.0';
console.log(`Super Blasteroids ver. ${BUILD}`);
const SCREEN = document.getElementById('screen');
const SCREEN_CTX = SCREEN.getContext('2d');
const FPS = 60;
const PANIC_THRESH = 100;

// mobile support
const MOBILE = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent); // https://stackoverflow.com/a/29509267/3178898
if (MOBILE) {
    const DTAP_MS = 300;
    const LTAP_MS = 500; // aka "long press"
    const TILT_THRESH = 3;
    addEventListener('error', e => alert(`Error @ ${e.lineno}: ${e.message}`));
}

class Game {
    constructor() {
        this.newPlayer = true;
        this.lastTick = 0;
        this.registerGlobalInputs();
        // listen for user input to start the first game
    }
    newGame = () => {
        // clear all prior game objects
        this.gameObjects = new Map();
        this.deltaTime = 0;
        // reset all game variables
        // (re-)register inputs
        // make sure the game is fullscreen (input to call this must be tied to UI element)
        // spawn the player at center screen
        // offer a tutorial, store the response in a cookie
        // once completed/declined, queue the first asteroid
        this.newPlayer = false;
        requestAnimationFrame(this.run);
    }
    registerGlobalInputs = () => {
        if (MOBILE) {
            this.waitingForDoubleTap = false;
            this.longPressTimeout = null;
            addEventListener('touchstart', e => {
                e.preventDefault(); // block resize
                if (!this.longPressTimeout) { setTimeout(() => alert('long press'), LTAP_TIMEOUT) }
                if (!this.waitingForDoubleTap) {
                    this.waitingForDoubleTap = true;
                    setTimeout(() => this.waitingForDoubleTap = false, DTAP_TIMEOUT);
                }else { alert('double tap'); }
            });
            addEventListener('touchend', e => {
                e.preventDefault();
                clearTimeout(this.longPressTimeout);
                this.longPressTimeout = null;
            });
        } else {
            addEventListener('keydown', e => {
                alert(e.key);
            })
        }
    }
    run = (timestamp) => {
        if (!this.paused) {
            this.deltaTime += timestamp - this.lastTick;
            this.lastTick = timestamp;
            let updatesThisFrame = 0;
            while (this.deltaTime >= TIME_STEP) {
                this.gameObjects.forEach(obj => obj.update());
                // check/handle game over state
                // if game is over, clear the hazard time and destroy all game objects
                if (++updatesThisFrame > PANIC_THRESH) { this.deltaTime = 0 }
                else { this.deltaTime -= TIME_STEP }
            }
        }
        this.cleanupIds.forEach(objId => this.gameObjects.delete(objId));
        this.cleanupIds = [];
        // resize the canvas
        // draw the background
        this.gameObjects.forEach(obj => obj.render());
        // then display scores and other game info
        requestAnimationFrame(this.run);
    }
}

let game = new Game();