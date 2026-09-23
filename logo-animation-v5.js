(() => {
  'use strict';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const container = $('#firstCanopyLogo');
  const svg = $('#animatedFirstCanopyLogo');
  const fallback = $('.logo-fallback-js');
  const LETTERS = ['c', 'a', 'n', 'o', 'p', 'y'];
  let running = false;

  function stage(name) {
    if (container) container.dataset.animationState = name;
    window.dispatchEvent(new CustomEvent('firstCanopyAnimationStage', { detail: { stage: name } }));
  }

  function showFinalLogo(state = 'complete') {
    try {
      if (svg) {
        svg.hidden = false;
        svg.style.display = 'block';
      }
      if (fallback) fallback.hidden = true;
      $$('.logo-letter', svg || document).forEach(letter => {
        letter.getAnimations?.().forEach(anim => anim.cancel());
        letter.style.opacity = '1';
        letter.style.transform = 'none';
        letter.style.transformOrigin = 'center center';
      });
      container?.classList.remove('logo-animation-running');
      container?.classList.add('logo-animation-complete');
      stage(state);
    } catch (_) {
      if (fallback) fallback.hidden = false;
    }
  }

  function getLetters() {
    if (!svg) throw new Error('SVG FIRST CANOPY não encontrado.');
    const letters = LETTERS.map(key => svg.querySelector(`.logo-letter-${key}`));
    if (letters.some(Boolean) === false || letters.some(el => !el)) {
      throw new Error('As seis letras de CANOPY não foram encontradas no SVG.');
    }
    return letters;
  }

  async function animateElement(el, keyframes, options) {
    const animation = el.animate(keyframes, { fill: 'forwards', ...options });
    await animation.finished;
    return animation;
  }

  async function playSequence() {
    if (running) return;
    running = true;

    try {
      if (!container || !svg) {
        showFinalLogo('fallback');
        return;
      }

      // Force a fresh visual state on every page load.
      container.classList.remove('logo-animation-complete');
      container.classList.add('logo-animation-running');
      svg.hidden = false;
      svg.style.display = 'block';
      if (fallback) fallback.hidden = true;

      const letters = getLetters();
      letters.forEach(el => {
        el.style.opacity = '1';
        el.style.transform = 'none';
        el.style.transformBox = 'fill-box';
        el.style.transformOrigin = 'center center';
      });

      stage('initial');
      await new Promise(r => setTimeout(r, 550));

      // If the OS asks for reduced motion, still provide a visible but short reveal.
      // This avoids the previous failure mode where the logo appeared completely static.
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (reduced) {
        stage('reduced-motion-reveal');
        await Promise.all(letters.map((el, i) => animateElement(el,
          [
            { opacity: 1, transform: 'scaleX(1)' },
            { opacity: 0.35, transform: 'scaleX(.82)' },
            { opacity: 1, transform: 'scaleX(1)' }
          ],
          { duration: 500, delay: i * 45, easing: 'ease-in-out' }
        )));
        showFinalLogo('complete');
        return;
      }

      stage('dismantling');
      // Dismantle visibly from Y toward C using real vector letter paths.
      const reversed = [...letters].reverse();
      await Promise.all(reversed.map((el, i) => animateElement(el,
        [
          { opacity: 1, transform: 'translateX(0) scaleX(1) scaleY(1)' },
          { opacity: 0.72, offset: 0.35, transform: `translateX(${i % 2 ? -3 : 3}px) scaleX(.72) scaleY(.96)` },
          { opacity: 0.04, transform: `translateX(${i % 2 ? -10 : 10}px) scaleX(.05) scaleY(.9)` }
        ],
        { duration: 720, delay: i * 150, easing: 'cubic-bezier(.65,0,.35,1)' }
      )));

      stage('dismantled');
      await new Promise(r => setTimeout(r, 220));

      stage('rebuilding');
      // Rebuild C → A → N → O → P → Y.
      await Promise.all(letters.map((el, i) => animateElement(el,
        [
          { opacity: 0.04, transform: 'translateX(-8px) scaleX(.05) scaleY(.9)' },
          { opacity: 0.72, offset: 0.62, transform: 'translateX(-2px) scaleX(.78) scaleY(.98)' },
          { opacity: 1, transform: 'translateX(0) scaleX(1) scaleY(1)' }
        ],
        { duration: 650, delay: i * 270, easing: 'cubic-bezier(.2,.8,.2,1)' }
      )));

      await new Promise(r => setTimeout(r, 120));
      showFinalLogo('complete');
    } catch (error) {
      console.error('[FIRST CANOPY] Falha na animação da marca:', error);
      showFinalLogo('error-fallback');
    } finally {
      running = false;
    }
  }

  async function boot() {
    try {
      // Wait until the current document and layout are genuinely ready.
      if (document.readyState === 'loading') {
        await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
      }
      if (document.fonts?.ready) await document.fonts.ready;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await playSequence();
    } catch (error) {
      console.error('[FIRST CANOPY] Erro ao iniciar animação:', error);
      showFinalLogo('boot-fallback');
    }
  }

  boot();
})();
