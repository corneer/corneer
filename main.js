(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Theme toggle ---------- */
  const toggle = document.getElementById('themeToggle');
  toggle.addEventListener('click', () => {
    const dark = document.documentElement.classList.toggle('dark');
    toggle.querySelectorAll('.line-inner').forEach((el) => {
      el.textContent = dark ? 'Lightness' : 'Darkness';
    });
  });

  /* ---------- Split text into masked lines ---------- */
  // Wraps every rendered line of each .split element in
  // .line > .line-inner so lines can slide up from below the mask.
  const splitElements = Array.from(document.querySelectorAll('.split'));
  const originals = splitElements.map((el) => el.innerHTML);

  function splitLines() {
    splitElements.forEach((el, i) => {
      el.innerHTML = originals[i];
      const isIndent = el.classList.contains('indent');

      // Tokenize into word spans (keeping whole anchors intact).
      const tokens = [];
      Array.from(el.childNodes).forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          node.textContent.split(/\s+/).filter(Boolean).forEach((word) => {
            const span = document.createElement('span');
            span.textContent = word;
            tokens.push(span);
          });
        } else if (node.nodeName === 'BR') {
          const brMark = document.createElement('span');
          brMark.dataset.br = 'true';
          tokens.push(brMark);
        } else {
          tokens.push(node.cloneNode(true));
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
      tokens.forEach((t, idx) => {
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

      // Rebuild as mask/line structure.
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
    });

    // Soft stagger flowing across the whole page:
    // delay grows with column and line position.
    const cols = Array.from(document.querySelectorAll('.col'));
    cols.forEach((col, colIdx) => {
      col.querySelectorAll('.line-inner').forEach((inner, lineIdx) => {
        inner.style.setProperty('--d', `${0.08 + colIdx * 0.14 + lineIdx * 0.07}s`);
      });
    });
  }

  splitLines();

  requestAnimationFrame(() => {
    requestAnimationFrame(() => document.body.classList.add('loaded'));
  });

  // After the entrance finishes, drop transitions so
  // resize re-splits don't replay the animation.
  setTimeout(() => document.body.classList.add('settled'), 3000);

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(splitLines, 150);
  });

  /* ---------- Soft parallax ---------- */
  // Columns drift at different speeds: pointer on desktop, scroll on touch.
  if (!reduceMotion) {
    const cols = Array.from(document.querySelectorAll('.col'));
    const speeds = cols.map((c) => parseFloat(c.dataset.speed || '1'));
    let targetY = 0;
    let currentY = 0;

    window.addEventListener('pointermove', (e) => {
      targetY = (e.clientY / window.innerHeight - 0.5) * 2;
    });

    window.addEventListener('scroll', () => {
      targetY = Math.min(1, window.scrollY / window.innerHeight) * 2;
    }, { passive: true });

    (function raf() {
      currentY += (targetY - currentY) * 0.06;
      cols.forEach((col, i) => {
        col.style.transform = `translateY(${(-currentY * 18 * speeds[i]).toFixed(2)}px)`;
      });
      requestAnimationFrame(raf);
    })();
  }
})();
