(() => {
  'use strict';

  /* ---------------------------------------------------------
     CONSTANTS
  --------------------------------------------------------- */
  const W = 360, H = 882;
  const PHOTO_W = 320, PHOTO_H = 240;
  const MARGIN = 20, GAP = 16;
  const PHOTO_Y = [20, 276, 532];
  const CAPTION_TOP = 788;

  const FRAMES = [
    { id: 'classic', name: 'Classic Cream', body: '#f2e9dc', trim: '#2a2622', mat: '#e2d5bd' },
    { id: 'noir',    name: 'Midnight Noir', body: '#1c1a1f', trim: '#f2e9dc', mat: '#322e37' },
    { id: 'coral',   name: 'Coral Flash',   body: '#ff5a5f', trim: '#fff6ee', mat: '#ff8286' },
    { id: 'mustard', name: 'Mustard Pop',   body: '#e8b73b', trim: '#2a2622', mat: '#f0c968' },
    { id: 'teal',    name: 'Teal Dream',    body: '#2f8f8a', trim: '#eafbf9', mat: '#4aa9a4' },
    { id: 'lilac',   name: 'Lilac Haze',    body: '#c9b6e4', trim: '#332244', mat: '#dccbee' },
  ];

  const STICKERS = ['❤️','😂','😎','🌟','✨','🎉','🥳','👑','🔥','💕','🌈','☀️',
                     '🍭','🎀','🐱','🐶','⭐','🍕','🎈','🦄','💋','🍄','🎧','📸'];

  const PROGRESS_MAP = {
    'screen-home': -1,
    'screen-frames': 0,
    'screen-capture': 1,
    'screen-review': 1,
    'screen-stickers': 2,
    'screen-print': 3,
    'screen-display': 3,
  };

  /* ---------------------------------------------------------
     STATE
  --------------------------------------------------------- */
  let selectedFrame = null;
  let capturedPhotos = [];   // array of offscreen canvases (320x240)
  let currentStream = null;
  let finalDataURL = null;

  /* ---------------------------------------------------------
     NAVIGATION
  --------------------------------------------------------- */
  function goTo(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    updateProgress(id);
  }

  function updateProgress(id) {
    const step = PROGRESS_MAP[id];
    document.querySelectorAll('.progress-step').forEach(el => {
      const n = parseInt(el.dataset.step, 10);
      el.classList.remove('active', 'done');
      if (step < 0) return;
      if (n === step) el.classList.add('active');
      else if (n < step) el.classList.add('done');
    });
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  /* ---------------------------------------------------------
     CANVAS DRAWING HELPERS
  --------------------------------------------------------- */
  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function dateString() {
    const d = new Date();
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function drawStrip(ctx, frame, photos) {
    ctx.clearRect(0, 0, W, H);
    roundRectPath(ctx, 0, 0, W, H, 18);
    ctx.fillStyle = frame.body;
    ctx.fill();

    for (let i = 0; i < 3; i++) {
      const y = PHOTO_Y[i];
      // mat behind photo
      roundRectPath(ctx, MARGIN - 4, y - 4, PHOTO_W + 8, PHOTO_H + 8, 10);
      ctx.fillStyle = frame.mat;
      ctx.fill();

      ctx.save();
      roundRectPath(ctx, MARGIN, y, PHOTO_W, PHOTO_H, 6);
      ctx.clip();
      if (photos[i]) {
        ctx.drawImage(photos[i], MARGIN, y, PHOTO_W, PHOTO_H);
      } else {
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.fillRect(MARGIN, y, PHOTO_W, PHOTO_H);
      }
      ctx.restore();
    }

    // caption
    ctx.fillStyle = frame.trim;
    ctx.textAlign = 'center';
    ctx.font = "26px 'Archivo Black', sans-serif";
    ctx.fillText('SNAPPIDYSNAP', W / 2, CAPTION_TOP + 34);
    ctx.font = "14px 'Space Grotesk', sans-serif";
    ctx.globalAlpha = 0.75;
    ctx.fillText(dateString(), W / 2, CAPTION_TOP + 56);
    ctx.globalAlpha = 1;
  }

  function drawImageCover(ctx, source, sw, sh, dx, dy, dw, dh) {
    const scale = Math.max(dw / sw, dh / sh);
    const cw = dw / scale, ch = dh / scale;
    const cx = (sw - cw) / 2, cy = (sh - ch) / 2;
    ctx.drawImage(source, cx, cy, cw, ch, dx, dy, dw, dh);
  }

  /* ---------------------------------------------------------
     HOME
  --------------------------------------------------------- */
  document.getElementById('btnStart').addEventListener('click', () => goTo('screen-frames'));

  /* ---------------------------------------------------------
     FRAMES SCREEN
  --------------------------------------------------------- */
  const frameGrid = document.getElementById('frameGrid');
  const btnFramesNext = document.getElementById('btnFramesNext');

  FRAMES.forEach(frame => {
    const card = document.createElement('button');
    card.className = 'frame-card';
    card.type = 'button';
    card.innerHTML = `
      <div class="frame-preview" style="background:${frame.body}">
        <div class="frame-preview-photo" style="background:${frame.mat}"></div>
        <div class="frame-preview-photo" style="background:${frame.mat}"></div>
        <div class="frame-preview-photo" style="background:${frame.mat}"></div>
        <div class="frame-preview-cap" style="background:${frame.trim}; opacity:.25"></div>
      </div>
      <span class="frame-name">${frame.name}</span>
    `;
    card.addEventListener('click', () => {
      selectedFrame = frame;
      document.querySelectorAll('.frame-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      btnFramesNext.disabled = false;
    });
    frameGrid.appendChild(card);
  });

  document.getElementById('btnFramesBack').addEventListener('click', () => goTo('screen-home'));
  btnFramesNext.addEventListener('click', () => {
    goTo('screen-capture');
    resetCaptureUI();
    startCamera();
  });

  /* ---------------------------------------------------------
     CAPTURE SCREEN
  --------------------------------------------------------- */
  const camVideo = document.getElementById('camVideo');
  const flashOverlay = document.getElementById('flashOverlay');
  const countdownNum = document.getElementById('countdownNum');
  const camError = document.getElementById('camError');
  const thumbRail = document.getElementById('thumbRail');
  const btnCaptureStart = document.getElementById('btnCaptureStart');
  const captureSub = document.getElementById('captureSub');

  function resetCaptureUI() {
    capturedPhotos = [];
    thumbRail.querySelectorAll('.thumb-slot').forEach(s => (s.innerHTML = ''));
    btnCaptureStart.disabled = false;
    btnCaptureStart.textContent = 'Start countdown';
    captureSub.textContent = "We'll snap 3 photos, one at a time. Get ready!";
    camError.hidden = true;
  }

  function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      camError.hidden = false;
      return;
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then(stream => {
        currentStream = stream;
        camVideo.srcObject = stream;
        camError.hidden = true;
      })
      .catch(() => {
        camError.hidden = false;
      });
  }

  function stopCamera() {
    if (currentStream) {
      currentStream.getTracks().forEach(t => t.stop());
      currentStream = null;
    }
  }

  document.getElementById('btnRetryCam').addEventListener('click', startCamera);

  document.getElementById('btnCaptureBack').addEventListener('click', () => {
    stopCamera();
    goTo('screen-frames');
  });

  btnCaptureStart.addEventListener('click', runCaptureSequence);

  async function countdownFrom(n) {
    for (let i = n; i >= 1; i--) {
      countdownNum.textContent = i;
      await sleep(700);
    }
    countdownNum.textContent = '📸';
    await sleep(220);
    countdownNum.textContent = '';
  }

  function doFlash() {
    flashOverlay.classList.add('flash');
    setTimeout(() => flashOverlay.classList.remove('flash'), 260);
  }

  function capturePhotoFrame() {
    const c = document.createElement('canvas');
    c.width = PHOTO_W;
    c.height = PHOTO_H;
    const ctx = c.getContext('2d');
    ctx.save();
    // mirror to match the preview (selfie view)
    ctx.translate(PHOTO_W, 0);
    ctx.scale(-1, 1);
    drawImageCover(ctx, camVideo, camVideo.videoWidth, camVideo.videoHeight, 0, 0, PHOTO_W, PHOTO_H);
    ctx.restore();
    capturedPhotos.push(c);
  }

  function updateThumbs() {
    const slots = thumbRail.querySelectorAll('.thumb-slot');
    slots.forEach((slot, i) => {
      slot.innerHTML = '';
      if (capturedPhotos[i]) {
        const img = document.createElement('img');
        img.src = capturedPhotos[i].toDataURL('image/png');
        slot.appendChild(img);
      }
    });
  }

  async function runCaptureSequence() {
    if (!currentStream) { camError.hidden = false; return; }
    btnCaptureStart.disabled = true;
    for (let shot = 0; shot < 3; shot++) {
      captureSub.textContent = `Photo ${shot + 1} of 3 — strike a pose!`;
      await countdownFrom(3);
      doFlash();
      capturePhotoFrame();
      updateThumbs();
      await sleep(500);
    }
    captureSub.textContent = 'All done!';
    stopCamera();
    renderReviewCanvas();
    goTo('screen-review');
  }

  /* ---------------------------------------------------------
     REVIEW SCREEN
  --------------------------------------------------------- */
  const reviewCanvas = document.getElementById('reviewCanvas');

  function renderReviewCanvas() {
    const ctx = reviewCanvas.getContext('2d');
    drawStrip(ctx, selectedFrame, capturedPhotos);
  }

  document.getElementById('btnRetake').addEventListener('click', () => {
    capturedPhotos = [];
    goTo('screen-frames');
  });

  document.getElementById('btnToStickers').addEventListener('click', () => {
    goTo('screen-stickers');
    prepareStickerStage();
  });

  /* ---------------------------------------------------------
     STICKERS SCREEN
  --------------------------------------------------------- */
  const stickerGrid = document.getElementById('stickerGrid');
  const stageContainer = document.getElementById('stageContainer');
  const stageWrap = document.getElementById('stageWrap');
  const stickerBaseCanvas = document.getElementById('stickerBaseCanvas');

  STICKERS.forEach(emoji => {
    const btn = document.createElement('button');
    btn.className = 'sticker-pick';
    btn.type = 'button';
    btn.textContent = emoji;
    btn.addEventListener('click', () => addSticker(emoji));
    stickerGrid.appendChild(btn);
  });

  function prepareStickerStage() {
    stageWrap.querySelectorAll('.sticker').forEach(s => s.remove());
    const ctx = stickerBaseCanvas.getContext('2d');
    drawStrip(ctx, selectedFrame, capturedPhotos);
    fitStageScale();
  }

  function fitStageScale() {
    const maxW = stageContainer.parentElement.clientWidth || 320;
    const maxH = window.innerHeight * 0.5;
    const scale = Math.min(maxW / W, maxH / H, 1);
    stageWrap.style.transform = `scale(${scale})`;
    stageWrap.dataset.scale = scale;
    stageContainer.style.width = (W * scale) + 'px';
    stageContainer.style.height = (H * scale) + 'px';
  }
  window.addEventListener('resize', () => {
    if (document.getElementById('screen-stickers').classList.contains('active')) fitStageScale();
  });

  function localCoords(clientX, clientY) {
    const rect = stageWrap.getBoundingClientRect();
    const scale = parseFloat(stageWrap.dataset.scale) || 1;
    return { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale };
  }

  function addSticker(emoji) {
    const el = document.createElement('div');
    el.className = 'sticker';
    el.textContent = emoji;
    el.dataset.emoji = emoji;
    const size = 56;
    el.dataset.size = size;
    el.style.fontSize = size + 'px';
    el.style.left = (W / 2) + 'px';
    el.style.top = (H / 2) + 'px';

    const del = document.createElement('span');
    del.className = 'sticker-del';
    del.textContent = '×';
    del.addEventListener('pointerdown', e => e.stopPropagation());
    del.addEventListener('click', () => el.remove());
    el.appendChild(del);

    const resize = document.createElement('span');
    resize.className = 'sticker-resize';
    el.appendChild(resize);

    attachDrag(el);
    attachResize(el, resize);

    stageWrap.appendChild(el);
  }

  function attachDrag(el) {
    let startLocal = null, startLeft = 0, startTop = 0, dragging = false;
    el.addEventListener('pointerdown', e => {
      if (e.target.classList.contains('sticker-resize') || e.target.classList.contains('sticker-del')) return;
      dragging = true;
      el.classList.add('dragging');
      el.setPointerCapture(e.pointerId);
      startLocal = localCoords(e.clientX, e.clientY);
      startLeft = parseFloat(el.style.left);
      startTop = parseFloat(el.style.top);
    });
    el.addEventListener('pointermove', e => {
      if (!dragging) return;
      const cur = localCoords(e.clientX, e.clientY);
      el.style.left = (startLeft + (cur.x - startLocal.x)) + 'px';
      el.style.top = (startTop + (cur.y - startLocal.y)) + 'px';
    });
    function end(e) {
      if (dragging) {
        dragging = false;
        el.classList.remove('dragging');
      }
    }
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  function attachResize(el, handle) {
    let resizing = false, startDist = 1, startSize = 56;
    handle.addEventListener('pointerdown', e => {
      e.stopPropagation();
      resizing = true;
      handle.setPointerCapture(e.pointerId);
      const cx = parseFloat(el.style.left), cy = parseFloat(el.style.top);
      const cur = localCoords(e.clientX, e.clientY);
      startDist = Math.max(8, Math.hypot(cur.x - cx, cur.y - cy));
      startSize = parseFloat(el.dataset.size);
    });
    handle.addEventListener('pointermove', e => {
      if (!resizing) return;
      const cx = parseFloat(el.style.left), cy = parseFloat(el.style.top);
      const cur = localCoords(e.clientX, e.clientY);
      const dist = Math.max(8, Math.hypot(cur.x - cx, cur.y - cy));
      let newSize = startSize * (dist / startDist);
      newSize = Math.min(220, Math.max(20, newSize));
      el.dataset.size = newSize;
      el.style.fontSize = newSize + 'px';
    });
    function end() { resizing = false; }
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  }

  document.getElementById('btnStickersBack').addEventListener('click', () => {
    goTo('screen-review');
  });

  document.getElementById('btnPrintIt').addEventListener('click', finalizeAndPrint);

  /* ---------------------------------------------------------
     PRINT TRANSITION
  --------------------------------------------------------- */
  const finalCanvas = document.getElementById('finalCanvas');
  const printOutputWrap = document.getElementById('printOutputWrap');
  const printOutputImg = document.getElementById('printOutputImg');
  const printSub = document.getElementById('printSub');
  const printerMachine = document.getElementById('printerMachine');

  function finalizeAndPrint() {
    const ctx = finalCanvas.getContext('2d');
    drawStrip(ctx, selectedFrame, capturedPhotos);

    stageWrap.querySelectorAll('.sticker').forEach(s => {
      const cx = parseFloat(s.style.left);
      const cy = parseFloat(s.style.top);
      const size = parseFloat(s.dataset.size);
      ctx.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(s.dataset.emoji, cx, cy);
    });

    finalDataURL = finalCanvas.toDataURL('image/png');
    goTo('screen-print');
    startPrintAnimation();
  }

  function startPrintAnimation() {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    printOutputWrap.style.height = '0px';
    printOutputImg.style.transform = 'translateY(-100%)';
    printSub.textContent = "Hang tight, it's slowly coming out...";
    printOutputImg.src = finalDataURL;

    printOutputImg.onload = () => {
      const displayW = 190;
      const displayH = printOutputImg.naturalHeight * (displayW / printOutputImg.naturalWidth);
      const duration = reduceMotion ? 500 : 3600;

      printerMachine.classList.add('printing');

      const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
      const start = performance.now();

      function step(now) {
        const t = Math.min(1, (now - start) / duration);
        const eased = easeOutCubic(t);
        const remaining = 1 - eased;

        printOutputWrap.style.height = (eased * displayH) + 'px';
        // a faint side-to-side wobble that settles down as the strip fully emerges,
        // like paper catching slightly on real feed rollers
        const wobble = reduceMotion ? 0 : Math.sin(t * 26) * 2.4 * remaining;
        printOutputImg.style.transform =
          `translateY(${-remaining * 100}%) translateX(${wobble}px)`;

        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          printerMachine.classList.remove('printing');
          printSub.textContent = 'All done — say cheese!';
          setTimeout(() => {
            document.getElementById('displayImg').src = finalDataURL;
            goTo('screen-display');
          }, 700);
        }
      }
      requestAnimationFrame(step);
    };
  }

  /* ---------------------------------------------------------
     DISPLAY SCREEN
  --------------------------------------------------------- */
  document.getElementById('btnSave').addEventListener('click', () => {
    if (!finalDataURL) return;
    const a = document.createElement('a');
    a.href = finalDataURL;
    a.download = `SNAPPIDYSNAP-strip-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  document.getElementById('btnStartOver').addEventListener('click', () => {
    stopCamera();
    selectedFrame = null;
    capturedPhotos = [];
    finalDataURL = null;
    document.querySelectorAll('.frame-card').forEach(c => c.classList.remove('selected'));
    btnFramesNext.disabled = true;
    stageWrap.querySelectorAll('.sticker').forEach(s => s.remove());
    goTo('screen-home');
  });

  /* init */
  updateProgress('screen-home');
})();