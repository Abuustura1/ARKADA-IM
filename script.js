/* script.js — TAMAMI (emoji-yan-yan + sola-kaydırma eklendi)
   - Tüm önceki eklentiler korunmuştur.
   - Emoji tokenleri ardışık ise tek satırda yan yana gösterilir.
   - Container tümüne küçük bir sola kaydırma (responsive) uygulanır.
*/

/* ----------------------- DOM REFERANSLARI ----------------------- */
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');
const rabbit = document.getElementById('rabbit');
const box = document.getElementById('box');
const fxCanvas = document.getElementById('fxCanvas');
const finalOverlay = document.getElementById('finalOverlay');
const explosionAudio = document.getElementById('explosionAudio');
const bgAudio = document.getElementById('bgAudio');

const ctx = fxCanvas.getContext('2d');

/* ----------------------- CANVAS / RESIZE ----------------------- */
function resizeCanvas(){
  fxCanvas.width = Math.round(fxCanvas.clientWidth);
  fxCanvas.height = Math.round(fxCanvas.clientHeight);
}
window.addEventListener('resize', resizeCanvas);
window.addEventListener('load', resizeCanvas);
resizeCanvas();

/* ----------------------- AYARLAR ----------------------- */
const JUMP_DURATION = 850;
const JUMP_HEIGHT = 180;
const EXPLOSION_PARTICLES = 160;
const DEFAULT_LETTER_TEXT = 'Canım arkadaşım 💖✨';
const LETTER_DELAY = 90;

/* ----------------------- AUDIO ----------------------- */
let audioCtx = null;
function getAudioCtx(){
  if(!audioCtx){
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if(!Ctx) return null;
    audioCtx = new Ctx();
  }
  return audioCtx;
}
function unlockAudioContext(){
  try {
    const ac = getAudioCtx();
    if(ac && ac.state === 'suspended'){
      ac.resume().catch(()=>{/* ignore */});
    }
  } catch(e){}
}
explosionAudio.crossOrigin = "anonymous";
explosionAudio.volume = 0.7;

/* ----------------------- EASING ----------------------- */
function easeInOutCubic(t){
  return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3)/2;
}

/* ----------------------- TAVŞAN ZIPLATMA ----------------------- */
function animateRabbitJump(duration = JUMP_DURATION, height = JUMP_HEIGHT){
  return new Promise(resolve => {
    const startRect = rabbit.getBoundingClientRect();
    const endRect = box.getBoundingClientRect();
    const stageRect = document.getElementById('playArea').getBoundingClientRect();

    const startX = startRect.left - stageRect.left + startRect.width/2;
    const startY = startRect.top - stageRect.top + startRect.height/2;
    const endX = endRect.left - stageRect.left + endRect.width/2;
    const endY = endRect.top - stageRect.top + endRect.height/2;

    const deltaX = endX - startX;
    const deltaY = endY - startY;
    const originLeft = startRect.left - stageRect.left;
    const originTop = startRect.top - stageRect.top;

    const startTime = performance.now();
    rabbit.style.transition = 'transform 0s';
    rabbit.style.willChange = 'transform';

    function frame(now){
      const elapsed = now - startTime;
      let t = Math.min(1, elapsed / duration);
      const eased = easeInOutCubic(t);

      const arc = -4 * height * (eased - 0.5) * (eased - 0.5) + height;
      const currentX = startX + deltaX * eased;
      const currentY = startY + deltaY * eased - arc;

      const tx = currentX - (startRect.width/2) - originLeft;
      const ty = currentY - (startRect.height/2) - originTop;

      const rot = (eased - 0.5) * 12;

      rabbit.style.transform = `translate(${tx}px, ${ty}px) rotate(${rot}deg) scale(1.02)`;

      if(t < 1) requestAnimationFrame(frame);
      else {
        rabbit.style.transition = 'opacity 220ms linear';
        rabbit.style.opacity = '0';
        rabbit.style.pointerEvents = 'none';
        setTimeout(()=> {
          rabbit.dataset.hidden = 'true';
          resolve();
        }, 240);
      }
    }
    requestAnimationFrame(frame);
  });
}

/* ----------------------- COORD HELPERS ----------------------- */
function stageToCanvasCoords(stageX, stageY) {
  const stage = document.getElementById('playArea');
  const stageRect = stage.getBoundingClientRect();
  const scaleX = fxCanvas.width / stageRect.width;
  const scaleY = fxCanvas.height / stageRect.height;
  return { x: stageX * scaleX, y: stageY * scaleY };
}

/* ----------------------- PATLAMA (BÜYÜK) ----------------------- */
function createExplosion(cx, cy){
  return new Promise(resolve => {
    const particles = [];
    const w = fxCanvas.width;
    const h = fxCanvas.height;
    const c = stageToCanvasCoords(cx, cy);

    for(let i=0;i<EXPLOSION_PARTICLES;i++){
      const angle = Math.random()*Math.PI*2;
      const speed = 1 + Math.random()*6;
      const vx = Math.cos(angle)*speed;
      const vy = Math.sin(angle)*speed;
      const size = 3 + Math.random()*10;
      const life = 1000 + Math.random()*1400;
      const hue = Math.floor(10 + Math.random()*320);
      const shape = Math.random() < 0.25 ? 'rect' : 'circle';
      particles.push({x:c.x, y:c.y, vx, vy, size, life, age:0, hue, shape});
    }

    let last = performance.now();
    let active = true;

    function tick(now){
      const dt = now - last; last = now;
      ctx.clearRect(0,0,w,h);

      for(const p of particles){
        p.age += dt;
        if(p.age > p.life) { p.dead = true; continue; }
        p.vy += 0.02 * (dt/16);
        p.x += p.vx * (dt/16);
        p.y += p.vy * (dt/16);
        const alpha = Math.max(0, 1 - p.age / p.life);

        if(p.shape === 'circle'){
          ctx.beginPath();
          ctx.fillStyle = `hsla(${p.hue},85%,60%,${alpha})`;
          ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
          ctx.fill();
        } else {
          ctx.save();
          ctx.translate(p.x, p.y);
          const rot = (p.age / p.life) * Math.PI * 2;
          ctx.rotate(rot);
          ctx.fillStyle = `hsla(${p.hue},85%,60%,${alpha})`;
          ctx.fillRect(-p.size/2, -p.size/2, p.size*1.6, p.size*1.1);
          ctx.restore();
        }
      }

      if(Math.random() < 0.03){
        const px = c.x + (Math.random()-0.5)*120;
        const py = c.y + (Math.random()-0.5)*60;
        ctx.beginPath();
        ctx.fillStyle = `rgba(255,255,255,${Math.random()*0.75})`;
        ctx.arc(px, py, 1 + Math.random()*3, 0, Math.PI*2);
        ctx.fill();
      }

      const alive = particles.filter(p => !p.dead);
      if(alive.length === 0) active = false;

      if(active) requestAnimationFrame(tick);
      else {
        setTimeout(()=> {
          ctx.clearRect(0,0,w,h);
          resolve();
        }, 260);
      }
    }
    requestAnimationFrame(tick);
  });
}

/* ----------------------- HARF BURST ----------------------- */
function createLetterBurst(x, y){
  const particles = [];
  const count = 18;
  const w = fxCanvas.width, h = fxCanvas.height;
  const c = stageToCanvasCoords(x, y);
  for(let i=0;i<count;i++){
    const angle = Math.random()*Math.PI*2;
    const speed = 1 + Math.random()*4;
    particles.push({
      x: c.x,
      y: c.y,
      vx: Math.cos(angle)*speed,
      vy: Math.sin(angle)*speed - Math.random()*1.2,
      size: 2 + Math.random()*4,
      life: 280 + Math.random()*240,
      age: 0,
      hue: 20 + Math.random()*320
    });
  }
  let last = performance.now();
  function tick(now){
    const dt = now - last; last = now;
    ctx.clearRect(0,0,w,h);
    for(const p of particles){
      p.age += dt;
      if(p.age > p.life){ p.dead = true; continue; }
      p.vy += 0.02 * (dt/16);
      p.x += p.vx * (dt/16);
      p.y += p.vy * (dt/16);
      const alpha = Math.max(0, 1 - p.age / p.life);
      ctx.beginPath();
      ctx.fillStyle = `hsla(${p.hue},90%,60%,${alpha})`;
      ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
      ctx.fill();
    }
    const alive = particles.filter(p => !p.dead);
    if(alive.length > 0) requestAnimationFrame(tick);
    else setTimeout(()=> ctx.clearRect(0,0,w,h), 60);
  }
  requestAnimationFrame(tick);
}

/* ----------------------- SES ----------------------- */
function playExplosionSound(){
  unlockAudioContext();

  if(explosionAudio && explosionAudio.src){
    explosionAudio.volume = 0.7;
    explosionAudio.currentTime = 0;
    explosionAudio.play().catch(()=>{});
    return;
  }

  const ac = getAudioCtx();
  if(!ac) return;
  const bufferSize = Math.floor(ac.sampleRate * 0.5);
  const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for(let i=0;i<bufferSize;i++){
    const env = 1 - (i / bufferSize);
    data[i] = (Math.random()*2 - 1) * env * (0.75 + Math.random()*0.7);
  }

  const src = ac.createBufferSource();
  src.buffer = buffer;

  const lowpass = ac.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 1400;

  const gain = ac.createGain();
  gain.gain.value = 0.0001;

  src.connect(lowpass);
  lowpass.connect(gain);
  gain.connect(ac.destination);

  const now = ac.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(1.15, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

  src.start(now);
  src.stop(now + 0.6);
}

/* ----------------------- EMOJI / HARF TESPITI ----------------------- */
function isEmoji(ch){
  if(!ch || ch.trim()==='') return false;
  return !(/[A-Za-z0-9ÇĞİÖŞÜçğıöşü\s\.,!?\-]/.test(ch));
}

/* ----------------------- RESPONSIVE HELPERS ----------------------- */
function getBaseTranslateY() {
  const w = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
  if (w >= 1200) return -48;
  if (w >= 641) return -36;
  if (w >= 401) return -56;
  return -64;
}

/* get X offset (small left shift), responsive */
function getFinalOffsetX(wrapperWidth){
  // negative value shifts left
  if(wrapperWidth <= 360) return -10;
  if(wrapperWidth <= 420) return -14;
  if(wrapperWidth <= 640) return -18;
  return -22; // desktop small shift
}

/* ----------------------- FLOATING WRAPPER (FINAL TEXT) ----------------------- */
let __finalFloatingWrapper = null;
let __finalFloatingResizeHandler = null;
let __pluginUsername = "";

/* remove wrapper and listeners */
function removeFloatingWrapper() {
  if (__finalFloatingWrapper) {
    __finalFloatingWrapper.remove();
    __finalFloatingWrapper = null;
  }
  if (__finalFloatingResizeHandler) {
    window.removeEventListener('resize', __finalFloatingResizeHandler);
    window.removeEventListener('scroll', __finalFloatingResizeHandler);
    if(window.visualViewport) {
      window.visualViewport.removeEventListener('resize', __finalFloatingResizeHandler);
      window.visualViewport.removeEventListener('scroll', __finalFloatingResizeHandler);
    }
    __finalFloatingResizeHandler = null;
  }
}

/* adjust container inside wrapper (applies translateX left offset) */
function adjustFinalContainer(container) {
  if (!container || !__finalFloatingWrapper) return;

  const stage = document.getElementById('playArea');
  const stageRect = stage.getBoundingClientRect();
  const boxRect = box.getBoundingClientRect();

  let contRect = container.getBoundingClientRect();
  const wrapperRect = __finalFloatingWrapper.getBoundingClientRect();
  const wrapperWidth = wrapperRect.width;
  const wrapperHeight = wrapperRect.height;

  const paddingX = 20;
  const maxAllowedWidth = Math.max(wrapperWidth - paddingX*2, 40);
  const marginAboveBox = 10;
  const allowedBottom = (boxRect.top - stageRect.top) - marginAboveBox;
  const availableHeight = Math.max(allowedBottom - 8, 24);

  // compute scaleX / scaleY
  const scaleX = maxAllowedWidth / contRect.width;
  const scaleY = availableHeight / contRect.height;
  let scale = Math.min(scaleX, scaleY, 1);

  const MIN_SCALE = wrapperWidth <= 420 ? 0.45 : 0.58;
  scale = Math.max(scale, MIN_SCALE);

  const scaledHeight = contRect.height * scale;
  const centeredTop = (wrapperHeight / 2) - (scaledHeight / 2);
  const scaledBottomIfCentered = centeredTop + scaledHeight;

  let finalTop = centeredTop;
  if (scaledBottomIfCentered > allowedBottom) {
    finalTop = Math.max(6, allowedBottom - scaledHeight - 4);
  }

  // compute translate relative to center baseline
  const baselineCenterOffset = (wrapperHeight / 2) - (contRect.height / 2);
  const translateFromCenterY = finalTop - baselineCenterOffset;

  // compute X offset (left shift)
  const offsetX = getFinalOffsetX(wrapperWidth);

  container.style.transition = 'transform 260ms cubic-bezier(.2,.9,.3,1)';
  container.style.transformOrigin = 'center center';
  // translate(X, Y) where X is small negative to shift left
  container.style.transform = `translate(${offsetX}px, ${translateFromCenterY}px) scale(${scale})`;
}

/* ----------------------- showFinalText (kelime-altalta, emoji-yan-yan grup) ----------------------- */
function showFinalText(text) {
  // decide final text (username plugin)
  if(!text || text === DEFAULT_LETTER_TEXT) {
    if(__pluginUsername && __pluginUsername.trim() !== "") {
      // ensure emojis are adjacent without splitting tokens: put emojis with no extra spaces between them in template
      text = `Canım Arkadaşım ${__pluginUsername} 😊🥰`;
    } else {
      text = DEFAULT_LETTER_TEXT;
    }
  }

  removeFloatingWrapper();
  if(finalOverlay) finalOverlay.innerHTML = '';

  const stage = document.getElementById('playArea');
  let stageRect = stage.getBoundingClientRect();

  // create fixed wrapper
  __finalFloatingWrapper = document.createElement('div');
  __finalFloatingWrapper.className = 'final-floating-wrapper';
  Object.assign(__finalFloatingWrapper.style, {
    position: 'fixed',
    left: `${Math.round(stageRect.left)}px`,
    top: `${Math.round(stageRect.top)}px`,
    width: `${Math.round(stageRect.width)}px`,
    height: `${Math.round(stageRect.height)}px`,
    pointerEvents: 'none',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible'
  });
  document.body.appendChild(__finalFloatingWrapper);

  // container: column layout so each "word line" stacks vertically
  const container = document.createElement('div');
  container.className = 'final-container';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.gap = '8px';
  container.style.alignItems = 'flex-start'; // left aligned so offset is visible
  container.style.justifyContent = 'center';
  container.style.whiteSpace = 'normal';
  container.style.willChange = 'transform';
  // initial transform uses only base translateY; final X offset applied in adjustFinalContainer
  container.style.transform = `translate(0px, ${getBaseTranslateY()}px) scale(1)`;
  __finalFloatingWrapper.appendChild(container);

  // Tokenize preserving emoji sequences:
  // Split into tokens by spaces, but group consecutive single-character emoji tokens together
  const rawTokens = text.split(/\s+/).filter(Boolean);

  // Build groups: each group is {type: 'emoji'|'word', value: string}
  const groups = [];
  let emojiGroup = [];

  rawTokens.forEach(tok => {
    const chars = Array.from(tok);
    const allEmoji = chars.length > 0 && chars.every(ch => isEmoji(ch));
    if(allEmoji){
      // push each emoji char into emojiGroup (we want them adjacent)
      emojiGroup.push(...chars);
    } else {
      // flush emojiGroup first if any
      if(emojiGroup.length){
        groups.push({type:'emoji', value: emojiGroup.join('')}); // join so they are a single token
        emojiGroup = [];
      }
      // word token (keep as-is)
      groups.push({type:'word', value: tok});
    }
  });
  // flush at end
  if(emojiGroup.length){
    groups.push({type:'emoji', value: emojiGroup.join('')});
    emojiGroup = [];
  }

  // Animate characters with global char index
  let charIndex = 0;

  groups.forEach(group => {
    if(group.type === 'emoji'){
      // create a single emoji-row; emojis inside will be side-by-side
      const emojiRow = document.createElement('div');
      emojiRow.className = 'emoji-row';
      emojiRow.style.display = 'flex';
      emojiRow.style.gap = '6px'; // smaller gap so emojis are closer
      emojiRow.style.justifyContent = 'flex-start';
      emojiRow.style.alignItems = 'center';
      emojiRow.style.flexWrap = 'nowrap';

      const emojis = Array.from(group.value);
      emojis.forEach((ch) => {
        const span = document.createElement('span');
        span.className = 'letter emoji';
        span.textContent = ch;
        span.style.display = 'inline-block';
        emojiRow.appendChild(span);

        setTimeout(() => {
          span.classList.add('show');
          setTimeout(()=> span.classList.add('spark'), 80);
          setTimeout(()=> span.classList.add('float'), 420);
          // burst center
          const spanRect = span.getBoundingClientRect();
          const wrapperRect = __finalFloatingWrapper.getBoundingClientRect();
          const cx = (spanRect.left - wrapperRect.left) + spanRect.width / 2;
          const cy = (spanRect.top - wrapperRect.top) + spanRect.height / 2;
          createLetterBurst(cx, cy);
        }, charIndex * LETTER_DELAY);
        charIndex++;
      });

      container.appendChild(emojiRow);
    } else {
      // word row: each character its own span
      const wordRow = document.createElement('div');
      wordRow.className = 'word-row';
      wordRow.style.display = 'inline-flex';
      wordRow.style.gap = '6px';
      wordRow.style.justifyContent = 'flex-start';
      wordRow.style.alignItems = 'center';
      wordRow.style.flexWrap = 'nowrap';

      const chars = Array.from(group.value);
      chars.forEach(ch => {
        const span = document.createElement('span');
        span.className = 'letter';
        span.textContent = ch;
        span.style.display = 'inline-block';
        wordRow.appendChild(span);

        setTimeout(() => {
          span.classList.add('show');
          setTimeout(()=> span.classList.add('spark'), 80);
          setTimeout(()=> span.classList.add('float'), 420);
          // burst center
          const spanRect = span.getBoundingClientRect();
          const wrapperRect = __finalFloatingWrapper.getBoundingClientRect();
          const cx = (spanRect.left - wrapperRect.left) + spanRect.width / 2;
          const cy = (spanRect.top - wrapperRect.top) + spanRect.height / 2;
          createLetterBurst(cx, cy);
        }, charIndex * LETTER_DELAY);
        charIndex++;
      });

      container.appendChild(wordRow);
    }
  });

  // After animation scheduling, adjust container for fit and left offset
  const totalDelay = Math.max((charIndex * LETTER_DELAY) + 180, 260);
  setTimeout(() => {
    adjustFinalContainer(container);
    setTimeout(()=> adjustFinalContainer(container), 90); // small follow-up
  }, totalDelay);

  // reposition wrapper on resize/scroll and listen to visualViewport
  __finalFloatingResizeHandler = () => {
    if (!__finalFloatingWrapper) return;
    stageRect = document.getElementById('playArea').getBoundingClientRect();
    Object.assign(__finalFloatingWrapper.style, {
      left: `${Math.round(stageRect.left)}px`,
      top: `${Math.round(stageRect.top)}px`,
      width: `${Math.round(stageRect.width)}px`,
      height: `${Math.round(stageRect.height)}px`,
    });
    requestAnimationFrame(()=> {
      const inner = __finalFloatingWrapper.querySelector('.final-container');
      if(inner) adjustFinalContainer(inner);
    });
  };
  window.addEventListener('resize', __finalFloatingResizeHandler);
  window.addEventListener('scroll', __finalFloatingResizeHandler, { passive: true });
  if(window.visualViewport) {
    window.visualViewport.addEventListener('resize', __finalFloatingResizeHandler);
    window.visualViewport.addEventListener('scroll', __finalFloatingResizeHandler);
  }
}

/* clearFinalText */
function clearFinalText(){
  removeFloatingWrapper();
  if(finalOverlay) finalOverlay.innerHTML = '';
}

/* ----------------------- SEQUENCE ----------------------- */
async function startSequence(){
  if(startBtn.disabled) return;
  startBtn.disabled = true;
  startBtn.style.opacity = 0.6;
  resetBtn.style.opacity = 1;
  resetBtn.setAttribute('aria-hidden', 'false');

  unlockAudioContext();

  if(bgAudio.src){
    bgAudio.volume = 0.16;
    bgAudio.play().catch(()=>{});
  }

  await animateRabbitJump();

  const stageRect = document.getElementById('playArea').getBoundingClientRect();
  const boxRect = box.getBoundingClientRect();
  const cx = (boxRect.left - stageRect.left) + boxRect.width/2;
  const cy = (boxRect.top - stageRect.top) + boxRect.height/2;

  playExplosionSound();
  await createExplosion(cx, cy);

  setTimeout(()=> {
    showFinalText(); // username plugin will be applied inside if set
  }, 120);

  box.animate([
    { transform: 'translateY(0) scale(1)'},
    { transform: 'translateY(-8px) scale(1.04)'},
    { transform: 'translateY(0) scale(1)'}
  ], { duration: 700, easing: 'cubic-bezier(.2,.9,.3,1)'});
}

function resetSequence(){
  rabbit.style.opacity = '1';
  rabbit.style.transform = '';
  rabbit.style.pointerEvents = 'auto';
  rabbit.dataset.hidden = 'false';

  ctx.clearRect(0,0,fxCanvas.width, fxCanvas.height);
  clearFinalText();

  startBtn.disabled = false;
  startBtn.style.opacity = 1;
  resetBtn.style.opacity = 0.6;
  resetBtn.setAttribute('aria-hidden', 'true');

  if(bgAudio && !bgAudio.paused){ bgAudio.pause(); bgAudio.currentTime = 0; }
}

/* ----------------------- EVENTLER ----------------------- */
startBtn.addEventListener('click', () => {
  unlockAudioContext();
  startSequence();
});
resetBtn.addEventListener('click', () => {
  resetSequence();
  setTimeout(()=> pluginShowOverlay(__pluginUsername), 60);
});
window.addEventListener('keydown', (e) => {
  if(e.key.toLowerCase() === 'x' && !startBtn.disabled) startBtn.click();
});
startBtn.addEventListener('keydown', (e) => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startBtn.click(); }}); 
resetBtn.addEventListener('keydown', (e) => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); resetBtn.click(); }});

/* ----------------------- KULLANICI ADI EKLENTISI ----------------------- */
const usernameOverlay = document.getElementById('usernameOverlay');
const usernameInput = document.getElementById('usernameInput');
const usernameContinue = document.getElementById('usernameContinue');

function pluginShowOverlay(prefill = "") {
  if(usernameOverlay) {
    usernameOverlay.setAttribute('aria-hidden', 'false');
    usernameOverlay.style.display = 'flex';
  }
  if(usernameInput) {
    usernameInput.value = prefill || "";
    setTimeout(()=> usernameInput.focus(), 60);
  }
  if(startBtn) {
    startBtn.disabled = true;
    startBtn.style.opacity = 0.6;
  }
  clearFinalText();
}

function pluginHideOverlay() {
  if(usernameOverlay) {
    usernameOverlay.setAttribute('aria-hidden', 'true');
    usernameOverlay.style.display = 'none';
  }
  if(startBtn) {
    startBtn.disabled = false;
    startBtn.style.opacity = 1;
  }
  if(usernameInput) usernameInput.blur();
}

if(usernameContinue) {
  usernameContinue.addEventListener('click', () => {
    const val = (usernameInput && usernameInput.value) ? usernameInput.value.trim() : "";
    if(!val) {
      alert("Lütfen adınızı girin!");
      usernameInput.focus();
      return;
    }
    __pluginUsername = val;
    pluginHideOverlay();
  });
  usernameInput && usernameInput.addEventListener('keydown', (e) => {
    if(e.key === 'Enter') {
      e.preventDefault();
      usernameContinue.click();
    }
  });
}

window.addEventListener('load', () => {
  setTimeout(()=> pluginShowOverlay(""), 30);
});

/* ----------------------- BİTTİ ----------------------- */
