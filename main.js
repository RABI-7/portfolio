/**
 * Ultra-Smooth Scroll-Driven Frame Animation & Interactive Portfolio
 * 
 * Features:
 * - 269-frame high-resolution sequence
 * - Multi-phase prioritized preloading (instant first frame + keyframes + progressive fill)
 * - Nearest-frame fallback so the canvas NEVER flickers or displays a blank screen
 * - Linear Interpolation (lerp) easing physics for buttery 60-120fps motion
 * - High-DPI / Retina auto-scaling with performance-capped internal buffers
 * - Energy-efficient render loop that sleeps when idle
 * - Cover-fit aspect ratio scaling with portrait-aware vertical focal centering
 * - Dynamic scroll progress bar & interactive sticky navigation
 */

(() => {
  'use strict';

  const TOTAL_FRAMES = 269;
  const FRAME_PREFIX = 'ezgif-72f0a157d1557de0-png-split/ezgif-frame-';
  const FRAME_EXT = '.png';
  const LERP_FACTOR = 0.12; // Easing factor: buttery smooth and responsive
  const CONCURRENT_LOAD_LIMIT = 8; // Optimal parallel download stream
  const MAX_CANVAS_WIDTH = 2560; // Max hardware buffer width
  const MAX_CANVAS_HEIGHT = 1440; // Max hardware buffer height

  const canvas = document.getElementById('animationCanvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const progressBar = document.getElementById('scrollProgressBar');
  const siteHeader = document.getElementById('siteHeader');

  // Image sequence cache and state
  const images = new Array(TOTAL_FRAMES + 1);
  const loaded = new Uint8Array(TOTAL_FRAMES + 1);
  let lastDrawnFrameIndex = -1;

  // Animation & physics state
  let currentFrame = 1;
  let targetFrame = 1;
  let isLoopRunning = false;

  // Format frame filename with 3-digit zero-padding
  function getFramePath(index) {
    const padded = String(index).padStart(3, '0');
    return `${FRAME_PREFIX}${padded}${FRAME_EXT}`;
  }

  // Priority queue for loading images
  const queue = [];
  const inProgress = new Set();

  function enqueue(index, priority = false) {
    if (loaded[index] || inProgress.has(index)) return;
    if (priority) {
      const existingIdx = queue.indexOf(index);
      if (existingIdx !== -1) queue.splice(existingIdx, 1);
      queue.unshift(index);
    } else {
      if (!queue.includes(index)) {
        queue.push(index);
      }
    }
    processQueue();
  }

  function processQueue() {
    while (inProgress.size < CONCURRENT_LOAD_LIMIT && queue.length > 0) {
      const nextIndex = queue.shift();
      if (loaded[nextIndex] || inProgress.has(nextIndex)) continue;

      inProgress.add(nextIndex);
      const img = new Image();
      img.src = getFramePath(nextIndex);

      img.onload = () => {
        images[nextIndex] = img;
        loaded[nextIndex] = 1;
        inProgress.delete(nextIndex);

        const currentTargetInt = Math.round(currentFrame);
        // Draw frame 1 immediately when it loads, or redraw if near current frame
        if (nextIndex === 1 && lastDrawnFrameIndex === -1) {
          drawFrame(1);
        } else if (Math.abs(nextIndex - currentTargetInt) <= 1 && lastDrawnFrameIndex !== nextIndex) {
          drawFrame(currentTargetInt);
        }

        processQueue();
      };

      img.onerror = () => {
        inProgress.delete(nextIndex);
        processQueue();
      };
    }
  }

  // Find nearest loaded frame if the exact requested frame is still downloading
  function getBestAvailableFrame(targetIndex) {
    if (loaded[targetIndex] && images[targetIndex] && images[targetIndex].complete) {
      return { img: images[targetIndex], index: targetIndex };
    }

    // Search outwards from targetIndex
    for (let offset = 1; offset < TOTAL_FRAMES; offset++) {
      const up = targetIndex + offset;
      if (up <= TOTAL_FRAMES && loaded[up] && images[up] && images[up].complete) {
        return { img: images[up], index: up };
      }
      const down = targetIndex - offset;
      if (down >= 1 && loaded[down] && images[down] && images[down].complete) {
        return { img: images[down], index: down };
      }
    }

    if (images[1] && images[1].complete) return { img: images[1], index: 1 };
    return null;
  }

  // Render a specific frame index with cover scaling & portrait focal centering
  function drawFrame(frameIndex) {
    const result = getBestAvailableFrame(frameIndex);
    if (!result || !result.img) return;

    const img = result.img;
    const cw = canvas.width;
    const ch = canvas.height;
    const iw = img.naturalWidth || 1920;
    const ih = img.naturalHeight || 1080;

    // Aspect ratio "cover" calculation
    const hRatio = cw / iw;
    const vRatio = ch / ih;
    const ratio = Math.max(hRatio, vRatio);

    const nw = iw * ratio;
    const nh = ih * ratio;

    // Center horizontally
    const nx = (cw - nw) / 2;
    // Portrait-aware vertical focal centering: maintains ample headroom on widescreen
    const ny = nh > ch ? (ch - nh) * 0.25 : (ch - nh) / 2;

    // Clear background with exact studio backdrop tone
    ctx.fillStyle = '#070508';
    ctx.fillRect(0, 0, cw, ch);

    // Draw high-quality frame
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, iw, ih, nx, ny, nw, nh);

    lastDrawnFrameIndex = result.index;
  }

  // Physics animation loop using linear interpolation (lerp)
  function animationTick() {
    const delta = targetFrame - currentFrame;

    if (Math.abs(delta) > 0.002) {
      currentFrame += delta * LERP_FACTOR;
      const frameToDraw = Math.round(currentFrame);
      drawFrame(frameToDraw);

      // Prioritize loading frames surrounding the current position
      prioritizeNearby(frameToDraw);

      requestAnimationFrame(animationTick);
    } else {
      currentFrame = targetFrame;
      drawFrame(Math.round(currentFrame));
      isLoopRunning = false;
    }
  }

  function startAnimation() {
    if (!isLoopRunning) {
      isLoopRunning = true;
      requestAnimationFrame(animationTick);
    }
  }

  // Prioritize frames around current scrub point
  function prioritizeNearby(centerIndex) {
    const range = 12;
    const start = Math.max(1, centerIndex - range);
    const end = Math.min(TOTAL_FRAMES, centerIndex + range);

    // Forward direction first
    for (let i = centerIndex; i <= end; i++) {
      if (!loaded[i]) enqueue(i, true);
    }
    // Backward direction
    for (let i = centerIndex - 1; i >= start; i--) {
      if (!loaded[i]) enqueue(i, true);
    }
  }

  // Calculate target frame from scroll position
  function updateScroll() {
    const scrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
    const scrollHeight = document.documentElement.scrollHeight || document.body.scrollHeight;
    const clientHeight = window.innerHeight || document.documentElement.clientHeight;
    const maxScroll = Math.max(1, scrollHeight - clientHeight);

    let progress = 0;
    if (maxScroll > 0) {
      progress = Math.max(0, Math.min(1, scrollY / maxScroll));
    }

    targetFrame = 1 + progress * (TOTAL_FRAMES - 1);
    startAnimation();

    // Update scroll progress bar
    if (progressBar) {
      progressBar.style.width = `${(progress * 100).toFixed(2)}%`;
    }

    // Toggle header scrolled styling
    if (siteHeader) {
      if (scrollY > 40) {
        siteHeader.classList.add('scrolled');
      } else {
        siteHeader.classList.remove('scrolled');
      }
    }
  }

  // Responsive canvas buffer sizing with DPR and max dimension clamping
  function resize() {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let targetW = Math.round(viewportWidth * dpr);
    let targetH = Math.round(viewportHeight * dpr);

    if (targetW > MAX_CANVAS_WIDTH) {
      const scale = MAX_CANVAS_WIDTH / targetW;
      targetW = MAX_CANVAS_WIDTH;
      targetH = Math.round(targetH * scale);
    }
    if (targetH > MAX_CANVAS_HEIGHT) {
      const scale = MAX_CANVAS_HEIGHT / targetH;
      targetH = MAX_CANVAS_HEIGHT;
      targetW = Math.round(targetW * scale);
    }

    canvas.width = targetW;
    canvas.height = targetH;

    drawFrame(Math.round(currentFrame));
  }

  // Multi-phase preloader initialization
  function initPreloader() {
    // Phase 1: Load frame 1 immediately for instant paint
    enqueue(1, true);

    // Phase 2: Keyframes across timeline (every 10 frames)
    for (let i = 10; i <= TOTAL_FRAMES; i += 10) {
      enqueue(i, false);
    }
    enqueue(TOTAL_FRAMES, false);

    // Phase 3: Secondary keyframes (every 5 frames)
    for (let i = 5; i <= TOTAL_FRAMES; i += 10) {
      enqueue(i, false);
    }

    // Phase 4: All remaining frames in sequence
    for (let i = 2; i <= TOTAL_FRAMES; i++) {
      if (!loaded[i]) {
        enqueue(i, false);
      }
    }
  }

  // Smooth anchor scrolling
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      const targetEl = document.querySelector(targetId);
      if (targetEl) {
        e.preventDefault();
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // Event Listeners
  window.addEventListener('scroll', updateScroll, { passive: true });
  window.addEventListener('resize', resize, { passive: true });

  // Initial execution
  resize();
  initPreloader();
  updateScroll();
})();
