/* script.js — TAMAMI (yeni, eklentili, floating-wrapper çözümü)
   - play-area içi overflow: hidden nedeniyle oluşan kırpma sorununu çözmek için
     final harfleri body'ye yerleştirilmiş absolute bir "floating wrapper" içinde gösterilir.
   - responsive ölçekleme, dikey/yatay sığdırma, username eklentisi, ses ve patlama korundu.
*/

/* ----------------------- DOM REFERANSLARI ----------------------- */
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');
const rabbit = document.getElementById('rabbit');
const box = document.getElementById('box');
const fxCanvas = document.getElementById('fxCanvas');
const finalOverlay = document.getElementById('finalOverlay'); // still kept for compatibility
const explosionAudio = document.getElementById('explosionAudio');
const bgAudio = document.getElementById('bgAudio');

const ctx = fxCanvas.getContext('2d');

/* ----------------------- CANVAS / RESIZE ----------------------- */
function resizeCanvas(){
  // Ensure canvas drawing buffer matches displayed size
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

/* ----------------------- AUDIO (WebAudio fallback synth) ----------------------- */
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

/* ----------------------- UTILS: STAGE -> CANVAS COORDS ----------------------- */
/* We pass stage-relative coordinates (pixels inside playArea). Canvas coordinates match
   fxCanvas.width/fxCanvas.height (we set them equal to clientWidth/clientHeight), so they align.
   This helper is kept for clarity and future scaling if needed.
*/
function stageToCanvasCoords(stageX, stageY) {
  // fxCanvas size equals playArea client size (after resizeCanvas)
  const stage = document.getElementById('playArea');
  const stageRect = stage.getBoundingClientRect();
  const scaleX = fxCanvas.width / stageRect.width;
  const scaleY = fxCanvas.height / stageRect.height;
  return { x: stageX * scaleX, y: stageY * scaleY };
}

/* ----------------------- PATLAMA (BÜYÜK) ----------------------- */
/* cx,cy are stage-relative coordinates (px from playArea.left/top) */
function createExplosion(cx, cy){
  return new Promise(resolve => {
    const particles = [];
    const w = fxCanvas.width;
    const h = fxCanvas.height;

    // Convert center to canvas coords
    const c = stageToCanvasCoords(cx, cy);

    for(let i=0;i<EXPLOSION_PARTICLES;i++){
      const angle = Math.random()*Math.PI*2;
      const speed = 1 + Math.random()*6; // yavaşlatılmış
      const vx = Math.cos(angle)*speed;
      const vy = Math.sin(angle)*speed;
      const size = 3 + Math.random()*10;
      const life = 1000 + Math.random()*1400; // ms
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

      // küçük parıltılar
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

/* ----------------------- HARF BURST (KÜÇÜKLER) ----------------------- */
/* x,y stage-relative coordinates */
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

/* ----------------------- PATLAMA SESI ----------------------- */
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
  // basit heuristic: alfanumerik veya noktalama değilse emoji kabul et
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

/* ----------------------- FLOATING WRAPPER (FINAL TEXT) ----------------------- */
let __finalFloatingWrapper = null;
let __finalFloatingResizeHandler = null;

/* remove wrapper and listeners */
function removeFloatingWrapper() {
  if (__finalFloatingWrapper) {
    __finalFloatingWrapper.remove();
    __finalFloatingWrapper = null;
  }
  if (__finalFloatingResizeHandler) {
    window.removeEventListener('resize', __finalFloatingResizeHandler);
    window.removeEventListener('scroll', __finalFloatingResizeHandler);
    __finalFloatingResizeHandler = null;
  }
}

/* adjust container inside wrapper: ensures it fits horizontally and vertically above the box */
function adjustFinalContainer(container) {
  if (!container || !__finalFloatingWrapper) return;

  const stage = document.getElementById('playArea');
  const stageRect = stage.getBoundingClientRect();
  const boxRect = box.getBoundingClientRect();

  const contRect = container.getBoundingClientRect();
  const wrapperRect = __finalFloatingWrapper.getBoundingClientRect();
  const wrapperWidth = wrapperRect.width;
  const wrapperHeight = wrapperRect.height;

  const paddingX = 24;
  const maxAllowedWidth = Math.max(wrapperWidth - paddingX * 2, 40);

  const marginAboveBox = 10;
  const allowedBottom = (boxRect.top - stageRect.top) - marginAboveBox;

  // compute scales
  const scaleX = maxAllowedWidth / contRect.width;
  const availableHeight = Math.max(allowedBottom - 8, 24);
  const scaleY = availableHeight / contRect.height;

  let scale = Math.min(scaleX, scaleY, 1);
  const MIN_SCALE = 0.58;
  scale = Math.max(scale, MIN_SCALE);

  const scaledHeight = contRect.height * scale;
  const centeredTop = (wrapperHeight / 2) - (scaledHeight / 2);
  const scaledBottomIfCentered = centeredTop + scaledHeight;

  let finalTop = centeredTop;
  if (scaledBottomIfCentered > allowedBottom) {
    finalTop = Math.max(6, allowedBottom - scaledHeight - 4);
  }

  const translateFromCenter = finalTop - ((wrapperHeight / 2) - (contRect.height / 2));

  container.style.transition = 'transform 260ms cubic-bezier(.2,.9,.3,1)';
  container.style.transformOrigin = 'center center';
  container.style.transform = `translateY(${translateFromCenter}px) scale(${scale})`;
}

/* showFinalText: main function (uses plugin username if set) */
let __pluginUsername = ""; // plugin username store

function showFinalText(text) {
  // decide final text
  if(!text || text === DEFAULT_LETTER_TEXT) {
    if(__pluginUsername && __pluginUsername.trim() !== "") {
      text = `Canım Arkadaşım ${__pluginUsername} 😊 🥰`;
    } else {
      text = DEFAULT_LETTER_TEXT;
    }
  }

  // cleanup old
  removeFloatingWrapper();
  if(finalOverlay) finalOverlay.innerHTML = '';

  const stage = document.getElementById('playArea');
  const stageRect = stage.getBoundingClientRect();

  // create wrapper positioned over playArea
  __finalFloatingWrapper = document.createElement('div');
  __finalFloatingWrapper.className = 'final-floating-wrapper';
  Object.assign(__finalFloatingWrapper.style, {
    position: 'absolute',
    left: `${Math.round(stageRect.left + window.scrollX)}px`,
    top: `${Math.round(stageRect.top + window.scrollY)}px`,
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

  // inner container
  const container = document.createElement('div');
  container.className = 'final-container';
  container.style.whiteSpace = 'nowrap';
  container.style.willChange = 'transform';
  container.style.transform = `translateY(${getBaseTranslateY()}px) scale(1)`;
  __finalFloatingWrapper.appendChild(container);

  const chars = Array.from(text);
  chars.forEach((ch, i) => {
    const span = document.createElement('span');
    span.className = 'letter';
    if(isEmoji(ch)) span.classList.add('emoji');
    span.textContent = ch;
    container.appendChild(span);

    setTimeout(() => {
      span.classList.add('show');
      setTimeout(()=> span.classList.add('spark'), 80);
      setTimeout(()=> span.classList.add('float'), 420);

      // letter burst: compute center relative to wrapper
      const spanRect = span.getBoundingClientRect();
      const wrapperRect = __finalFloatingWrapper.getBoundingClientRect();
      const cx = (spanRect.left - wrapperRect.left) + spanRect.width / 2;
      const cy = (spanRect.top - wrapperRect.top) + spanRect.height / 2;
      createLetterBurst(cx, cy);
    }, i * LETTER_DELAY);
  });

  // After letters drawn, adjust container to avoid box overlap
  const totalDelay = Math.max((chars.length * LETTER_DELAY) + 180, 260);
  setTimeout(() => adjustFinalContainer(container), totalDelay);

  // reposition wrapper on resize/scroll and readjust
  __finalFloatingResizeHandler = () => {
    if (!__finalFloatingWrapper) return;
    const stageRect2 = stage.getBoundingClientRect();
    Object.assign(__finalFloatingWrapper.style, {
      left: `${Math.round(stageRect2.left + window.scrollX)}px`,
      top: `${Math.round(stageRect2.top + window.scrollY)}px`,
      width: `${Math.round(stageRect2.width)}px`,
      height: `${Math.round(stageRect2.height)}px`,
    });
    requestAnimationFrame(() => {
      const inner = __finalFloatingWrapper.querySelector('.final-container');
      if (inner) adjustFinalContainer(inner);
    });
  };
  window.addEventListener('resize', __finalFloatingResizeHandler);
  window.addEventListener('scroll', __finalFloatingResizeHandler, { passive: true });
}

/* clearFinalText: remove wrapper */
function clearFinalText(){
  removeFloatingWrapper();
  if(finalOverlay) finalOverlay.innerHTML = '';
}

/* ----------------------- START/RESET SEQUENCE ----------------------- */
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

  // patlama bittikten sonra harfleri başlat
  setTimeout(()=> {
    showFinalText(); // plugin username otomatik eklenir
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

  // reset overlay and start button states
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
  // küçük gecikme ile overlay aç (pluginShowOverlay fonksiyonu aşağıda)
  setTimeout(()=> pluginShowOverlay(__pluginUsername), 60);
});
window.addEventListener('keydown', (e) => {
  if(e.key.toLowerCase() === 'x' && !startBtn.disabled) startBtn.click();
});
startBtn.addEventListener('keydown', (e) => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startBtn.click(); }}); 
resetBtn.addEventListener('keydown', (e) => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); resetBtn.click(); }});

/* ----------------------- EKLENTİ: KULLANICI ADI OVERLAY ----------------------- */
/*
  Amaç:
  - Sayfa açıldığında kullanıcı adı overlay göster.
  - Kullanıcı adını girene kadar Başla devre dışı.
  - Devam ile overlay kapanır; showFinalText kullanıcı adını kullanır.
  - Tekrar butonuna basınca overlay tekrar gösterilir (önceki adı prefill).
*/

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

// initial show on load
window.addEventListener('load', () => {
  setTimeout(()=> pluginShowOverlay(""), 30);
});

/* ----------------------- SON ----------------------- */
