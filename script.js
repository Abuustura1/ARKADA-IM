/* script.js — patlama animasyonu yavaşlatıldı ve final yazısı patlama bittikten sonra gösteriliyor.
   Bu sürümde eklenti korunmuştur; ayrıca final yazısının mobil/pc uyumunu sağlayan dinamik ölçekleme/konum düzeltmesi eklendi.
*/

const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');
const rabbit = document.getElementById('rabbit');
const box = document.getElementById('box');
const fxCanvas = document.getElementById('fxCanvas');
const finalOverlay = document.getElementById('finalOverlay');
const explosionAudio = document.getElementById('explosionAudio');
const bgAudio = document.getElementById('bgAudio');

const ctx = fxCanvas.getContext('2d');
function resizeCanvas(){
  fxCanvas.width = fxCanvas.clientWidth;
  fxCanvas.height = fxCanvas.clientHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

/* AYARLAR */
const JUMP_DURATION = 850;
const JUMP_HEIGHT = 180;
const EXPLOSION_PARTICLES = 160;
const LETTER_TEXT = 'Canım arkadaşım 💖✨';
const LETTER_DELAY = 90;

/* Ses / AudioContext */
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
explosionAudio.volume = 0.7; // biraz kısıldı

/* Easing */
function easeInOutCubic(t){
  return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3)/2;
}

/* Tavşan zıplatma */
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

/* --- YAVAŞLATILMIŞ BÜYÜK PATLAMA (Promise döndürür) --- */
function createExplosion(cx, cy){
  return new Promise(resolve => {
    const particles = [];
    const w = fxCanvas.width;
    const h = fxCanvas.height;

    // Daha uzun ömür ve daha yavaş hız: kullanıcının patlamayı görebilmesi için
    for(let i=0;i<EXPLOSION_PARTICLES;i++){
      const angle = Math.random()*Math.PI*2;
      // hız azaltıldı (daha yavaş yayılma)
      const speed = 1 + Math.random()*6;
      const vx = Math.cos(angle)*speed;
      const vy = Math.sin(angle)*speed;
      const size = 3 + Math.random()*10;
      const life = 1000 + Math.random()*1400; // 1s..2.4s
      const hue = Math.floor(10 + Math.random()*320);
      const shape = Math.random() < 0.25 ? 'rect' : 'circle';
      particles.push({x:cx, y:cy, vx, vy, size, life, age:0, hue, shape});
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
        const px = cx + (Math.random()-0.5)*120;
        const py = cy + (Math.random()-0.5)*60;
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

/* Harf başına küçük burst */
function createLetterBurst(x, y){
  const particles = [];
  const count = 18;
  const w = fxCanvas.width, h = fxCanvas.height;
  for(let i=0;i<count;i++){
    const angle = Math.random()*Math.PI*2;
    const speed = 1 + Math.random()*4;
    particles.push({
      x, y,
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

/* Patlama sesi (dosya yoksa WebAudio synth ile çal) */
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

/* Harf harf gösterim */
function isEmoji(ch){
  if(!ch || ch.trim()==='') return false;
  return !(/[A-Za-z0-9ÇĞİÖŞÜçğıöşü\s\.,!?\-]/.test(ch));
}

/* ---------- RESPONSIVE ADJUST HELPERS ---------- */

/* base translateY by viewport (matches CSS breakpoints) */
function getBaseTranslateY() {
  const w = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
  if (w >= 1200) return -48;
  if (w >= 641) return -36;
  if (w >= 401) return -56;
  return -64;
}

/* Apply adaptive scaling & upward shift so text doesn't overlap the box */
function adjustFinalContainer(container) {
  if(!container) return;
  // reset transforms
  container.style.transform = `translateY(${getBaseTranslateY()}px) scale(1)`;
  container.style.transition = 'transform 240ms cubic-bezier(.2,.9,.3,1)';

  // measure after paint
  requestAnimationFrame(() => {
    const stage = document.getElementById('playArea');
    const stageRect = stage.getBoundingClientRect();
    const boxRect = box.getBoundingClientRect();
    const contRect = container.getBoundingClientRect();

    // allowed bottom: a few px above the top of the box
    const allowedBottom = (boxRect.top - stageRect.top) - 8; // px from top of stage
    const containerTop = contRect.top - stageRect.top;
    const containerBottom = contRect.bottom - stageRect.top;
    const containerHeight = contRect.height;
    const containerWidth = contRect.width;
    const stageWidth = stageRect.width;

    // 1) If width too large, compute scale to fit within stage width minus padding
    const maxAllowedWidth = Math.max(stageWidth - 32, 80); // keep some padding
    let scale = 1;
    if (containerWidth > maxAllowedWidth) {
      scale = (maxAllowedWidth / containerWidth) * 0.97; // slight margin
    }

    // 2) After scaling, check vertical overlap with box
    const scaledContainerBottom = containerTop + containerHeight * scale;
    let extraUp = 0;
    if (scaledContainerBottom > allowedBottom) {
      // compute how much to move up
      extraUp = Math.min( (scaledContainerBottom - allowedBottom) + 6, stageRect.height * 0.6 );
      // if moving up is insufficient (very tall), additionally reduce scale
      const availableHeight = Math.max(allowedBottom - containerTop - 6, 20);
      if (containerHeight * scale > availableHeight) {
        const heightScale = (availableHeight / containerHeight) * 0.95;
        scale = Math.min(scale, heightScale);
      }
    }

    // Apply final transform: translateY(base - extraUp) scale(scale)
    const finalTranslateY = getBaseTranslateY() - extraUp;
    container.style.transform = `translateY(${finalTranslateY}px) scale(${scale})`;
  });
}

/* ---------- FINAL TEXT RENDER ---------- */
function showFinalText(text = LETTER_TEXT){
  finalOverlay.innerHTML = '';
  const container = document.createElement('div');
  container.className = 'final-container';
  finalOverlay.appendChild(container);

  // ensure container is single-line initially
  container.style.whiteSpace = 'nowrap';
  container.style.transform = `translateY(${getBaseTranslateY()}px) scale(1)`;

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

      // letter burst at letter center
      const spanRect = span.getBoundingClientRect();
      const stageRect = document.getElementById('playArea').getBoundingClientRect();
      const cx = (spanRect.left - stageRect.left) + spanRect.width / 2;
      const cy = (spanRect.top - stageRect.top) + spanRect.height / 2;
      createLetterBurst(cx, cy);
    }, i * LETTER_DELAY);
  });

  // After all letters drawn, adjust layout to avoid overlaps
  const totalDelay = Math.max( (chars.length * LETTER_DELAY) + 140, 220);
  setTimeout(()=> {
    // Try to keep it one line; if still too wide/tall, adjust
    adjustFinalContainer(container);
  }, totalDelay);
}

/* Clear final text & reset any transforms */
function clearFinalText(){
  finalOverlay.innerHTML = '';
}

/* Başlatma: patlama tamamlanana kadar bekle, sonra final metni göster */
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
    showFinalText();
  }, 120);

  box.animate([
    { transform: 'translateY(0) scale(1)'},
    { transform: 'translateY(-8px) scale(1.04)'},
    { transform: 'translateY(0) scale(1)'}
  ], { duration: 700, easing: 'cubic-bezier(.2,.9,.3,1)'});
}

/* Reset */
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

/* Eventler */
startBtn.addEventListener('click', () => {
  unlockAudioContext();
  startSequence();
});
resetBtn.addEventListener('click', () => resetSequence());
window.addEventListener('keydown', (e) => {
  if(e.key.toLowerCase() === 'x' && !startBtn.disabled) startBtn.click();
});
resizeCanvas();
startBtn.addEventListener('keydown', (e) => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startBtn.click(); }}); 
resetBtn.addEventListener('keydown', (e) => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); resetBtn.click(); }});

/* ----------------- EKLENTİ KODU (Sadece burası eklenti mantığı) ----------------- */

/*
  Amaç:
  - Sayfa açılınca kullanıcı adı overlay'i göster.
  - Kullanıcı adı girilene kadar Başla butonu devre dışı.
  - Kullanıcı "Devam" dediğinde overlay kapanır, Başla aktif olur.
  - Final mesajı kullanıcı adını içerir: "Canım Arkadaşım [Ad] 😊 🥰"
  - Tekrar butonuna basınca overlay tekrar gösterilir (önceki adı input içine taşı).
*/

// Küresel kullanıcı adı tutucu
let __pluginUsername = "";

// Overlay elemanları (HTML içinde ekli)
const usernameOverlay = document.getElementById('usernameOverlay');
const usernameInput = document.getElementById('usernameInput');
const usernameContinue = document.getElementById('usernameContinue');

// Başlangıç: overlay göster, başla butonu devre dışı
function pluginShowOverlay(prefill = "") {
  if(usernameOverlay) {
    usernameOverlay.setAttribute('aria-hidden', 'false');
    usernameOverlay.style.display = 'flex';
  }
  if(usernameInput) {
    usernameInput.value = prefill || "";
    // mobilde klavyeyi tetiklemek için küçük gecikme ile focus
    setTimeout(()=> usernameInput.focus(), 60);
  }
  // Başla butonunu kapat
  if(startBtn) {
    startBtn.disabled = true;
    startBtn.style.opacity = 0.6;
  }
  // temiz final yazısını gizle
  if(finalOverlay) finalOverlay.innerHTML = '';
}

// Overlay kapat
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

// Continue butonu işlemi
if(usernameContinue) {
  usernameContinue.addEventListener('click', () => {
    const val = (usernameInput && usernameInput.value) ? usernameInput.value.trim() : "";
    if(!val) {
      // Basit uyarı (isteğe bağlı)
      alert("Lütfen adınızı girin!");
      usernameInput.focus();
      return;
    }
    __pluginUsername = val;
    pluginHideOverlay();
  });
  // Enter ile submit
  usernameInput && usernameInput.addEventListener('keydown', (e) => {
    if(e.key === 'Enter') {
      e.preventDefault();
      usernameContinue.click();
    }
  });
}

// Override / wrap showFinalText: orijinal fonksiyonu sakla ve yeni isimle çağır
if(typeof showFinalText === 'function') {
  const _origShowFinalText = showFinalText;
  window.showFinalText = function(text) {
    // Eğer text verilmemiş veya text orijinal sabitse, kullanıcı adını ekle
    if(!text || text === LETTER_TEXT) {
      if(__pluginUsername && __pluginUsername.trim() !== "") {
        // İstenen format: "Canım Arkadaşım [Ad] 😊 🥰" (emojiler arasında boşluk)
        text = `Canım Arkadaşım ${__pluginUsername} 😊 🥰`;
      } else {
        text = LETTER_TEXT;
      }
    }
    return _origShowFinalText(text);
  };
}

// resetSequence'e overlay açılmasını ekliyoruz
if(resetBtn) {
  resetBtn.addEventListener('click', () => {
    // küçük gecikme ile overlay açıyoruz ki resetSequence'in yaptığı temizlemeler bitsin
    setTimeout(() => {
      pluginShowOverlay(__pluginUsername);
    }, 60);
  });
}

// İlk yüklemede overlay göster
window.addEventListener('load', () => {
  setTimeout(()=> pluginShowOverlay(""), 30);
});
