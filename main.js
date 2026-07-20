(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Whole entrance fits inside 1.5s: max stagger delay + letter duration (0.6s).
  const MAX_DELAY = 0.9;

  const splitElements = Array.from(document.querySelectorAll('.split'));
  const originals = splitElements.map((el) => el.innerHTML);

  /* ---------- Split text into masked lines of letters ---------- */
  function toLetters(text, target) {
    text.split('').forEach((ch) => {
      if (/\s/.test(ch)) {
        target.appendChild(document.createTextNode(ch));
      } else {
        const l = document.createElement('span');
        l.className = 'ltr';
        l.textContent = ch;
        target.appendChild(l);
      }
    });
  }

  function splitEl(el, i) {
    el.innerHTML = originals[i];
    const isIndent = el.classList.contains('indent');

    // Tokenize into word spans (keeping whole anchors intact).
    // Letters are created here so measurement happens on the exact
    // elements that render — inline-block rounding stays consistent.
    const tokens = [];
    Array.from(el.childNodes).forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        node.textContent.split(/\s+/).filter(Boolean).forEach((word) => {
          const span = document.createElement('span');
          span.className = 'word';
          toLetters(word, span);
          tokens.push(span);
        });
      } else if (node.nodeName === 'BR') {
        const brMark = document.createElement('span');
        brMark.dataset.br = 'true';
        tokens.push(brMark);
      } else {
        const clone = node.cloneNode(true);
        const text = clone.textContent;
        clone.innerHTML = '';
        clone.setAttribute('aria-label', text);
        toLetters(text, clone);
        tokens.push(clone);
      }
    });

    el.innerHTML = '';
    if (isIndent) {
      // Spacer reproduces the first-line indent during measurement,
      // so line grouping matches the final padded layout.
      const spacer = document.createElement('span');
      spacer.style.display = 'inline-block';
      spacer.style.width = '2.2em';
      el.appendChild(spacer);
    }
    tokens.forEach((t) => {
      el.appendChild(t);
      if (!t.dataset || !t.dataset.br) el.appendChild(document.createTextNode(' '));
      if (t.dataset && t.dataset.br) t.style.display = 'block';
    });

    // Group tokens by their rendered line (offsetTop).
    const lines = [];
    let currentTop = null;
    tokens.forEach((t) => {
      if (t.dataset && t.dataset.br) {
        currentTop = null;
        return;
      }
      const top = t.offsetTop;
      if (currentTop === null || Math.abs(top - currentTop) > 2) {
        lines.push([]);
        currentTop = top;
      }
      lines[lines.length - 1].push(t);
    });

    // Rebuild as mask/line structure with per-letter spans.
    el.innerHTML = '';
    lines.forEach((words, lineIdx) => {
      const line = document.createElement('span');
      line.className = 'line';
      if (isIndent && lineIdx === 0) line.classList.add('line--indent');
      const inner = document.createElement('span');
      inner.className = 'line-inner';
      words.forEach((w, wIdx) => {
        inner.appendChild(w);
        if (wIdx < words.length - 1) inner.appendChild(document.createTextNode(' '));
      });
      line.appendChild(inner);
      el.appendChild(line);
    });
  }

  // Soft letter stagger flowing across the whole page,
  // clamped so everything has settled within 2 seconds.
  function assignDelays() {
    document.querySelectorAll('.col').forEach((col, colIdx) => {
      col.querySelectorAll('.line-inner').forEach((inner, lineIdx) => {
        inner.querySelectorAll('.ltr').forEach((ltr, ltrIdx) => {
          const d = 0.04 + colIdx * 0.11 + lineIdx * 0.042 + ltrIdx * 0.006;
          ltr.style.setProperty('--d', `${Math.min(d, MAX_DELAY).toFixed(3)}s`);
        });
      });
    });
  }

  function splitAll() {
    splitElements.forEach((el, i) => splitEl(el, i));
    assignDelays();
  }

  // Wait for the webfont so line measurement matches the final metrics;
  // .split elements stay hidden until body.loaded reveals them.
  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
  Promise.race([fontsReady, new Promise((r) => setTimeout(r, 2000))]).then(() => {
    splitAll();
    // Force a reflow so letters start from their masked position, then
    // reveal. setTimeout fallback covers throttled rAF in background tabs.
    void document.body.offsetHeight;
    let revealed = false;
    const reveal = () => {
      if (revealed) return;
      revealed = true;
      document.body.classList.add('loaded');
    };
    requestAnimationFrame(() => requestAnimationFrame(reveal));
    setTimeout(reveal, 300);
    // After the entrance finishes, drop transitions so re-splits
    // (resize, toggle relabel) don't replay the animation.
    setTimeout(() => document.body.classList.add('settled'), 1600);
  });

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(splitAll, 150);
  });

  /* ---------- Theme toggle with full-page wipe ---------- */
  const toggle = document.getElementById('themeToggle');
  const wipe = document.getElementById('wipe');
  const toggleIdx = splitElements.indexOf(toggle);
  toggle.setAttribute('aria-label', 'Dark');
  let wiping = false;

  function applyTheme(dark) {
    document.documentElement.classList.toggle('dark', dark);
    originals[toggleIdx] = dark ? 'Light' : 'Dark';
    splitEl(toggle, toggleIdx);
    toggle.setAttribute('aria-label', originals[toggleIdx]);
    assignDelays();
  }

  toggle.addEventListener('click', () => {
    const dark = !document.documentElement.classList.contains('dark');
    if (reduceMotion) {
      applyTheme(dark);
      return;
    }
    if (wiping) return;
    wiping = true;
    wipe.style.background = dark ? '#111111' : '#e9e9e7';
    wipe.classList.add('wipe--in');
    wipe.addEventListener('transitionend', () => {
      applyTheme(dark);
      wipe.classList.add('wipe--out');
      wipe.addEventListener('transitionend', () => {
        wipe.classList.remove('wipe--in', 'wipe--out');
        wiping = false;
      }, { once: true });
    }, { once: true });
  });
})();
