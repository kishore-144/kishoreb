/* =============================================================================
   Kishore — portfolio behaviour
   Every module is progressive enhancement: the page is complete and readable
   with this file blocked.
   ========================================================================== */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var $  = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  /* ---------------------------------------------------------------------------
     Intro overlay
     The original site hid the whole page until the clip finished. The clip now
     still plays; Esc / Enter / Space dismiss it, and it always fails open.
     ------------------------------------------------------------------------ */
  function initIntro() {
    var intro = $('#intro');
    var video = $('#introVideo');
    if (!intro || !video) return;
    if (reduceMotion.matches) return;              // never even fetch the clip

    var regions = [$('#siteHeader'), $('#main'), $('.site-footer')].filter(Boolean);
    var timer;
    var done = false;

    function dismiss() {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { video.pause(); } catch (e) { /* no-op */ }
      intro.classList.add('is-leaving');
      document.documentElement.removeAttribute('data-intro');
      regions.forEach(function (el) { el.removeAttribute('inert'); });
      window.setTimeout(function () { intro.hidden = true; }, 450);
    }

    document.documentElement.setAttribute('data-intro', 'playing');
    regions.forEach(function (el) { el.setAttribute('inert', ''); });
    intro.hidden = false;

    video.addEventListener('ended', dismiss);
    video.addEventListener('error', dismiss);
    video.addEventListener('stalled', dismiss);
    document.addEventListener('keydown', function (e) {
      if (!done && (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ')) dismiss();
    });

    // Hard stop: never let a slow or blocked clip hold the page hostage.
    timer = window.setTimeout(dismiss, 8000);

    video.preload = 'auto';
    var playback = video.play();
    if (playback && typeof playback.catch === 'function') playback.catch(dismiss);
  }

  /* ---------------------------------------------------------------------------
     Header: solid background once the page scrolls; tucks away while reading
     downward and returns on the first scroll up. Never hides with the mobile
     menu open or while something inside it has focus.
     ------------------------------------------------------------------------ */
  function initHeader() {
    var header = $('#siteHeader');
    if (!header) return;
    var ticking = false;
    var lastY = window.scrollY;

    function update() {
      var y = window.scrollY;
      header.classList.toggle('is-stuck', y > 5);

      var delta = y - lastY;
      var locked = document.body.dataset.nav === 'open' || header.contains(document.activeElement);
      if (locked || y < 240) header.classList.remove('is-hidden');
      else if (delta > 6) header.classList.add('is-hidden');
      else if (delta < -6) header.classList.remove('is-hidden');
      if (Math.abs(delta) > 6) lastY = y;

      ticking = false;
    }
    header.addEventListener('focusin', function () { header.classList.remove('is-hidden'); });
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* ---------------------------------------------------------------------------
     Mobile navigation panel
     ------------------------------------------------------------------------ */
  function initNav() {
    var toggle = $('#navToggle');
    var list   = $('#navList');
    var scrim  = $('#navScrim');
    if (!toggle || !list) return;

    function setOpen(open) {
      document.body.dataset.nav = open ? 'open' : '';
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      if (scrim) scrim.hidden = !open;
      if (open) {
        // The panel animates in from visibility:hidden, so focus has to wait a
        // frame for it to become focusable.
        window.requestAnimationFrame(function () {
          var first = $('a', list);
          if (first) first.focus();
        });
      }
    }

    toggle.addEventListener('click', function () {
      setOpen(document.body.dataset.nav !== 'open');
    });

    if (scrim) scrim.addEventListener('click', function () { setOpen(false); toggle.focus(); });

    list.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });

    document.addEventListener('keydown', function (e) {
      if (document.body.dataset.nav !== 'open') return;

      if (e.key === 'Escape') { setOpen(false); toggle.focus(); return; }
      if (e.key !== 'Tab') return;

      // Keep focus inside the open panel.
      var focusables = [toggle].concat($$('a', list));
      var first = focusables[0];
      var last  = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    // Leaving the mobile breakpoint must not strand the panel open.
    var wide = window.matchMedia('(min-width: 64.0625rem)');
    var onChange = function (e) { if (e.matches) setOpen(false); };
    if (wide.addEventListener) wide.addEventListener('change', onChange);
    else wide.addListener(onChange);
  }

  /* ---------------------------------------------------------------------------
     Tabs — each [data-tabs] block is independent (the original shared one
     global handler, so the About tabs and the Targets tabs fought each other).
     ------------------------------------------------------------------------ */
  function initTabs() {
    $$('[data-tabs]').forEach(function (group) {
      var tabs = $$('[role="tab"]', group);
      if (!tabs.length) return;

      function select(tab, focus) {
        tabs.forEach(function (t) {
          var active = t === tab;
          t.setAttribute('aria-selected', String(active));
          t.tabIndex = active ? 0 : -1;
          var panel = document.getElementById(t.getAttribute('aria-controls'));
          if (panel) panel.hidden = !active;
        });
        if (focus) tab.focus();
      }

      tabs.forEach(function (tab, i) {
        tab.addEventListener('click', function () { select(tab); });
        tab.addEventListener('keydown', function (e) {
          var next = null;
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = tabs[(i + 1) % tabs.length];
          else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = tabs[(i - 1 + tabs.length) % tabs.length];
          else if (e.key === 'Home') next = tabs[0];
          else if (e.key === 'End') next = tabs[tabs.length - 1];
          if (next) { e.preventDefault(); select(next, true); }
        });
      });
    });
  }

  /* ---------------------------------------------------------------------------
     Hero role typewriter — cycles three roles at the original cadence.
     The full list is always in the markup for assistive tech and crawlers.
     ------------------------------------------------------------------------ */
  function initTypewriter() {
    var slot = $('#roleText');
    if (!slot || reduceMotion.matches) return;

    var texts = ['Solution Architect', 'Product Engineer', 'Backend Engineer'];
    var speed = 100;
    var delayBeforeNext = 3000;
    var textIndex = 0;
    var i = texts[0].length;      // the first role is already rendered in HTML
    var typing = false;           // so we start by erasing it
    var timer;

    function step() {
      var txt = texts[textIndex];
      if (typing) {
        if (i < txt.length) {
          i += 1;
          slot.textContent = txt.slice(0, i);
          timer = setTimeout(step, speed);
        } else {
          typing = false;
          timer = setTimeout(step, delayBeforeNext);
        }
      } else if (i > 0) {
        i -= 1;
        slot.textContent = txt.slice(0, i);
        timer = setTimeout(step, speed);
      } else {
        typing = true;
        textIndex = (textIndex + 1) % texts.length;
        timer = setTimeout(step, speed);
      }
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) clearTimeout(timer);
      else timer = setTimeout(step, speed);
    });

    timer = setTimeout(step, delayBeforeNext);
  }

  /* ---------------------------------------------------------------------------
     Scroll reveal + nav highlighting
     ------------------------------------------------------------------------ */
  function initReveal() {
    var items = $$('[data-reveal]');
    if (!items.length) return;

    if (reduceMotion.matches || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-revealed'); });
      return;
    }

    var pending = items.slice();

    function reveal(el) {
      el.classList.add('is-revealed');
      io.unobserve(el);
      var at = pending.indexOf(el);
      if (at > -1) pending.splice(at, 1);
      if (!pending.length) window.removeEventListener('scroll', onScroll);
    }

    // Items that enter in the same frame (a row of cards, a list on a tall
    // screen) cascade in DOM order instead of popping in at once.
    function revealBatch(els) {
      els.sort(function (a, b) {
        return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
      });
      els.forEach(function (el, i) {
        el.style.setProperty('--reveal-delay', Math.min(i, 4) * 90 + 'ms');
        reveal(el);
      });
    }

    var io = new IntersectionObserver(function (entries) {
      revealBatch(entries.filter(function (e) { return e.isIntersecting; })
                         .map(function (e) { return e.target; }));
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0 });

    // A fast flick or an anchor jump can outrun the observer, so sweep anything
    // that is already on screen once scrolling settles.
    var sweepTimer;
    function sweep() {
      revealBatch(pending.filter(function (el) {
        return el.getBoundingClientRect().top < window.innerHeight;
      }));
    }
    function onScroll() {
      clearTimeout(sweepTimer);
      sweepTimer = setTimeout(sweep, 140);
    }

    items.forEach(function (el) { io.observe(el); });
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  function initScrollSpy() {
    var links = $$('.nav__link');
    if (!links.length || !('IntersectionObserver' in window)) return;

    var byId = {};
    var sections = links.map(function (link) {
      var id = link.getAttribute('href').slice(1);
      var section = document.getElementById(id);
      if (section) byId[id] = link;
      return section;
    }).filter(Boolean);

    var visible = {};
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { visible[e.target.id] = e.isIntersecting; });

      var current = null;
      sections.forEach(function (s) { if (visible[s.id] && !current) current = s.id; });

      links.forEach(function (link) {
        if (link.getAttribute('href') === '#' + current) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });

    sections.forEach(function (s) { io.observe(s); });
  }

  /* ---------------------------------------------------------------------------
     Card spotlight — a soft light that follows the pointer (fine pointers only)
     ------------------------------------------------------------------------ */
  function initSpotlight() {
    if (reduceMotion.matches || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    $$('[data-spotlight]').forEach(function (card) {
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        card.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
  }

  /* ---------------------------------------------------------------------------
     Reading progress — CSS scroll timelines drive it where supported; this is
     the fallback for browsers without them (e.g. Firefox).
     ------------------------------------------------------------------------ */
  function initProgress() {
    var bar = $('.scroll-progress');
    if (!bar || reduceMotion.matches) return;
    if (window.CSS && CSS.supports && CSS.supports('animation-timeline: scroll()')) return;

    var ticking = false;
    function update() {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.setProperty('--progress', max > 0 ? Math.min(1, window.scrollY / max) : 0);
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
    }, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  /* ---------------------------------------------------------------------------
     Contact form — unchanged Google Apps Script endpoint, with a visible
     failure state and a guard against double submits.
     ------------------------------------------------------------------------ */
  function initForm() {
    var form = $('#contactForm');
    var status = $('#msgg');
    var button = $('#summaaa');
    if (!form || !status) return;

    var scriptURL = 'https://script.google.com/macros/s/AKfycbwGy0m4gZMXTgHVidE9hI8zPtloRQjgU6aJxJGwR2H3HpAF1dTQFvvZ5PBYUBCGRg/exec';
    var resetTimer;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (button && button.disabled) return;

      clearTimeout(resetTimer);
      if (button) button.disabled = true;
      status.removeAttribute('data-state');
      status.textContent = '';

      fetch(scriptURL, { method: 'POST', body: new FormData(form) })
        .then(function () {
          status.textContent = 'Message Sent Successfully';
          form.reset();
        })
        .catch(function (error) {
          status.setAttribute('data-state', 'error');
          status.textContent = 'Message could not be sent. Please try again.';
          if (window.console) console.error('Error!', error.message);
        })
        .then(function () {
          if (button) button.disabled = false;
          resetTimer = setTimeout(function () {
            status.textContent = '';
            status.removeAttribute('data-state');
          }, 4000);
        });
    });
  }

  initIntro();
  initHeader();
  initNav();
  initTabs();
  initTypewriter();
  initReveal();
  initScrollSpy();
  initSpotlight();
  initProgress();
  initForm();
})();
