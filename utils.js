export const canvas = document.getElementById('game-content');

// window/canvas
const getWindowStyle = (attribute) => {window.getComputedStyle(document.body).getPropertyValue(attribute).slice(0, -2)}
export const resizeCanvas = () => { // https://stackoverflow.com/questions/4037212/html-canvas-full-screen
  canvas.width = window.innerWidth - getWindowStyle('margin-left') - getWindowStyle('margin-right'); 
  canvas.height = window.innerHeight - getWindowStyle('margin-bottom') - getWindowStyle('margin-top');
}

// sfx
export const safePlayAudio = (audio) => {
  if (!audio) return;
  audio.pause(); // https://stackoverflow.com/q/14834520
  audio.currentTime = 0;
  audio.play();
}
export const safeToggleAudio = (audio, mode='auto') => {
  if (!audio) return;
  if (audio.paused && mode !== 'pauseOnly') { 
    if (audio.ended) audio.currentTime = 0;
    audio.play();
  }
  else if (mode !== 'playOnly') audio.pause();
}