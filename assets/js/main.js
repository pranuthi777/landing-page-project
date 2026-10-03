/* ============================================================================
   RIDGEWAY INSTRUMENT CO. — behaviour
   ----------------------------------------------------------------------------
   Plain ES2017, no dependencies, no build step. The main script is loaded with
   `defer`, so the DOM is ready and every module below can run immediately.

   Modules
     1. Small shared helpers
     2. Header: hairline appears once the page scrolls
     3. Navigation: hamburger panel, Escape, outside click, resize
     4. Scroll spy: marks the visible section in the nav
     5. Reveal on scroll, plus the hero drawing
     6. Copyright year
     7. Contact form: validation, error list, composed message, clipboard

   Everything degrades safely. If this file fails to load, the page is still
   readable and every link still works. The only lost behaviour is the
   animations, the mobile menu button and the client-side form check.
   ========================================================================= */

(function () {
  'use strict';

  /* ---------------------------------------------------------------------
     1. Helpers
     ------------------------------------------------------------------- */

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function $(selector, scope) { return (scope || document).querySelector(selector); }
  function $$(selector, scope) {
    return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
  }

  /* True when the layout is wide enough for the full nav, which is also the
     breakpoint at which the hamburger stops existing. Mirrors the 880px
     media query in the stylesheet. */
  function isWide() { return window.matchMedia('(min-width: 880px)').matches; }

  /* Runs fn at most once per animation frame. Used for scroll handlers. */
  function onFrame(fn) {
    var queued = false;
    return function () {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(function () { queued = false; fn(); });
    };
  }

  /* ---------------------------------------------------------------------
     2. Header state
     ------------------------------------------------------------------- */

  function initHeader() {
    var header = $('#site-header');
    if (!header) return;

    var apply = onFrame(function () {
      header.classList.toggle('is-stuck', window.scrollY > 8);
    });

    apply();
    window.addEventListener('scroll', apply, { passive: true });
  }

  /* ---------------------------------------------------------------------
     3. Mobile navigation
     ------------------------------------------------------------------- */

  function initNav() {
    var toggle = $('#nav-toggle');
    var nav = $('#site-nav');
    if (!toggle || !nav) return;

    function isOpen() { return toggle.getAttribute('aria-expanded') === 'true'; }

    function open() {
      toggle.setAttribute('aria-expanded', 'true');
      nav.classList.add('is-open');
      document.body.classList.add('nav-open');
      toggle.querySelector('.nav-toggle__label').textContent = 'Close';
    }

    function close(returnFocus) {
      toggle.setAttribute('aria-expanded', 'false');
      nav.classList.remove('is-open');
      document.body.classList.remove('nav-open');
      toggle.querySelector('.nav-toggle__label').textContent = 'Menu';
      if (returnFocus) toggle.focus();
    }

    toggle.addEventListener('click', function () {
      if (isOpen()) close(false); else open();
    });

    /* Escape closes the panel and hands focus back to the button, so keyboard
       users are never stranded inside a hidden menu. */
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && isOpen()) { close(true); }
    });

    /* Clicking anywhere outside the header closes it. */
    document.addEventListener('click', function (event) {
      if (!isOpen()) return;
      if (!nav.contains(event.target) && !toggle.contains(event.target)) close(false);
    });

    /* Following a link closes the panel so the target section is visible. */
    $$('[data-nav-link]', nav).forEach(function (link) {
      link.addEventListener('click', function () { close(false); });
    });

    /* Resizing up to the desktop layout must not leave the body scroll-locked
       by a menu that is now hidden. */
    window.addEventListener('resize', function () {
      if (isWide() && isOpen()) close(false);
    });
  }

  /* ---------------------------------------------------------------------
     4. Scroll spy
     Marks whichever section is under the header as the current page.
     ------------------------------------------------------------------- */

  function initScrollSpy() {
    var links = $$('[data-nav-link]');
    if (!links.length) return;

    var targets = links
      .map(function (link) {
        var id = link.getAttribute('href');
        if (!id || id.charAt(0) !== '#') return null;
        var section = document.querySelector(id);
        return section ? { link: link, section: section } : null;
      })
      .filter(Boolean);

    if (!targets.length) return;

    var update = onFrame(function () {
      var offset = 120;   // a little below the sticky header
      var current = null;

      targets.forEach(function (item) {
        if (item.section.getBoundingClientRect().top - offset <= 0) current = item;
      });

      /* At the very bottom of the page the last section may never cross the
         offset line on a short viewport, so claim it explicitly. */
      var atBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 4;
      if (atBottom) current = targets[targets.length - 1];

      targets.forEach(function (item) {
        if (item === current) {
          item.link.setAttribute('aria-current', 'true');
        } else {
          item.link.removeAttribute('aria-current');
        }
      });
    });

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
  }

  /* ---------------------------------------------------------------------
     5. Reveal on scroll
     ------------------------------------------------------------------- */

  function initReveal() {
    var items = $$('.reveal, .hero__copy, .hero__figure');
    if (!items.length) return;

    /* If the browser cannot observe, or the visitor asked for less motion,
       show everything immediately rather than leaving it invisible. */
    if (!('IntersectionObserver' in window) || reduceMotion.matches) {
      items.forEach(function (el) { el.classList.add('is-visible'); });
      $$('.drawing .draw').forEach(function (p) { p.classList.add('is-visible'); });
      return;
    }

    /* Each stroke in the schematic needs its own dash length, measured from
       the real path geometry rather than guessed. */
    $$('.drawing .draw').forEach(function (path) {
      var length = 0;
      try { length = Math.ceil(path.getTotalLength()); } catch (err) { length = 1000; }
      path.style.setProperty('--len', length);
    });

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });

    items.forEach(function (el) { observer.observe(el); });
    $$('.drawing .draw').forEach(function (el) { observer.observe(el); });
  }

  /* ---------------------------------------------------------------------
     6. Copyright year
     Written from the visitor's clock, so the footer never goes stale.
     ------------------------------------------------------------------- */

  function initYear() {
    var slot = $('#year');
    if (!slot) return;
    slot.textContent = String(new Date().getFullYear());
  }

  /* ---------------------------------------------------------------------
     7. Contact form
     -------------------------------------------------------------------
     There is no backend on a static host, so nothing pretends to be sent.
     The form validates, then builds the message the visitor asked for and
     offers it in a box they can copy or hand to their own mail app.
     ------------------------------------------------------------------- */

  var RECIPIENT = 'hello@ridgeway.example';

  /* One validator per field. Each returns an error string, or '' if valid. */
  var validators = {
    name: function (value) {
      if (!value) return 'Enter your name so we know who to reply to.';
      if (value.length < 2) return 'That looks too short to be a name.';
      return '';
    },
    email: function (value) {
      if (!value) return 'Enter an email address so we can reply.';
      /* Deliberately permissive: one @, no spaces, a dot in the domain. */
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
        return 'That does not look like an email address. Check for a missing @ or domain.';
      }
      return '';
    },
    organisation: function () { return ''; },   // optional, so never fails
    interest: function (value) {
      if (!value) return 'Pick the closest option so it reaches the right person.';
      return '';
    },
    message: function (value) {
      if (!value) return 'Tell us what you need, even roughly.';
      if (value.length < 20) {
        return 'A little more detail, please. ' + (20 - value.length) +
               ' more character' + (20 - value.length === 1 ? '' : 's') + '.';
      }
      return '';
    }
  };

  /* Labels used to name each field in the summary list. */
  var fieldLabels = {
    name: 'Name', email: 'Email', organisation: 'Organisation',
    interest: 'Subject', message: 'Message'
  };

  function initForm() {
    var form = $('#contact-form');
    var status = $('#form-status');
    if (!form || !status) return;

    var submitBtn = $('#submit-btn');
    var resetBtn = $('#reset-btn');
    var touched = false;   // only show errors for fields the visitor has met

    /* --- per-field feedback ------------------------------------------- */
    function validateField(name) {
      var input = form.elements[name];
      var box = $('#' + name + '-error', form);
      if (!input || !box) return true;

      var message = validators[name] ? validators[name](input.value.trim()) : '';

      if (message) {
        box.textContent = message;
        input.setAttribute('aria-invalid', 'true');
        return false;
      }

      box.textContent = '';
      input.removeAttribute('aria-invalid');
      return true;
    }

    function validateAll() {
      var ok = true;
      Object.keys(validators).forEach(function (name) {
        if (!validateField(name)) ok = false;
      });
      return ok;
    }

    /* Validate a field once it has been left, then keep it honest as the
       visitor types. Cheaper and less shouty than validating every keystroke
       from the first character. */
    Object.keys(validators).forEach(function (name) {
      var input = form.elements[name];
      if (!input) return;

      input.addEventListener('blur', function () {
        if (touched || input.value.trim()) validateField(name);
      });

      input.addEventListener('input', function () {
        if (input.getAttribute('aria-invalid') === 'true') validateField(name);
      });

      /* The select fires change rather than input on older browsers. */
      input.addEventListener('change', function () {
        if (input.tagName === 'SELECT' || input.getAttribute('aria-invalid') === 'true') {
          validateField(name);
        }
      });
    });

    /* --- status panels ------------------------------------------------ */
    function clearStatus() { status.innerHTML = ''; }

    function showErrorSummary(failures) {
      clearStatus();
      var panel = document.createElement('div');
      panel.className = 'status status--error';

      var title = document.createElement('span');
      title.className = 'status__title';
      title.textContent = failures.length === 1
        ? 'One field needs attention'
        : failures.length + ' fields need attention';
      panel.appendChild(title);

      var lead = document.createElement('p');
      lead.textContent = 'Nothing has been sent yet. Fix the following and try again:';
      panel.appendChild(lead);

      var list = document.createElement('ul');
      failures.forEach(function (name) {
        var item = document.createElement('li');
        /* Each entry is a link, so a keyboard user can jump straight to it. */
        var link = document.createElement('a');
        link.href = '#' + name;
        link.textContent = (fieldLabels[name] || name) + ': ' +
          (validators[name](form.elements[name].value.trim()));
        link.addEventListener('click', function (event) {
          event.preventDefault();
          form.elements[name].focus();
        });
        item.appendChild(link);
        list.appendChild(item);
      });
      panel.appendChild(list);

      status.appendChild(panel);

      /* Put focus on the first problem rather than leaving it at the button. */
      form.elements[failures[0]].focus();
    }

    function buildMessage(values) {
      return [
        'From: ' + values.name + (values.organisation ? ' (' + values.organisation + ')' : ''),
        'Email: ' + values.email,
        'Subject: ' + values.interest,
        '',
        values.message
      ].join('\n');
    }

    function showSuccess(values) {
      var message = buildMessage(values);

      clearStatus();
      var panel = document.createElement('div');
      panel.className = 'status status--ok';

      var title = document.createElement('span');
      title.className = 'status__title';
      title.textContent = 'Message ready, not sent';
      panel.appendChild(title);

      var lead = document.createElement('p');
      /* Says plainly what happened and what has not happened. */
      lead.innerHTML = 'This page is a static demo with no server behind it, so nothing ' +
        'was transmitted. The details you entered are below, ready to send to ' +
        '<strong>' + RECIPIENT + '</strong> from your own mail app.';
      panel.appendChild(lead);

      var box = document.createElement('pre');
      box.className = 'status__body';
      box.textContent = message;
      panel.appendChild(box);

      var tools = document.createElement('div');
      tools.className = 'status__tools';

      /* Prefilled mail link. This works because the form is populated. */
      var mailBtn = document.createElement('a');
      mailBtn.className = 'btn btn--solid';
      mailBtn.href = 'mailto:' + RECIPIENT +
        '?subject=' + encodeURIComponent(values.interest + ' from ' + values.name) +
        '&body=' + encodeURIComponent(message);
      mailBtn.textContent = 'Open in mail app';
      tools.appendChild(mailBtn);

      /* Copy button, with a confirmation that is itself announced. */
      var copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'btn btn--ghost';
      copyBtn.textContent = 'Copy message';
      copyBtn.addEventListener('click', function () {
        copyText(message).then(function () {
          copyBtn.textContent = 'Copied to clipboard';
          window.setTimeout(function () { copyBtn.textContent = 'Copy message'; }, 2400);
        }).catch(function () {
          copyBtn.textContent = 'Copy failed, select the text above';
          window.setTimeout(function () { copyBtn.textContent = 'Copy message'; }, 3200);
        });
      });
      tools.appendChild(copyBtn);

      panel.appendChild(tools);
      status.appendChild(panel);
    }

    /* Clipboard API where it exists, a hidden textarea where it does not. */
    function copyText(text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text);
      }
      return new Promise(function (resolve, reject) {
        var scratch = document.createElement('textarea');
        scratch.value = text;
        scratch.setAttribute('readonly', '');
        scratch.style.position = 'fixed';
        scratch.style.top = '-1000px';
        document.body.appendChild(scratch);
        scratch.select();
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
        document.body.removeChild(scratch);
        ok ? resolve() : reject(new Error('copy unavailable'));
      });
    }

    /* --- submit ------------------------------------------------------- */
    form.addEventListener('submit', function (event) {
      /* Stop the real submission: a static host has nowhere to send it. */
      event.preventDefault();
      touched = true;

      var failures = Object.keys(validators).filter(function (name) {
        return !validateField(name);
      });

      if (failures.length) {
        showErrorSummary(failures);
        return;
      }

      var values = {};
      Object.keys(validators).forEach(function (name) {
        values[name] = form.elements[name].value.trim();
      });

      /* A brief pause so the state change reads as deliberate rather than
         as a page that silently did nothing. */
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Preparing…';
      }

      window.setTimeout(function () {
        showSuccess(values);
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Send message';
        }
      }, reduceMotion.matches ? 0 : 350);
    });

    /* --- reset -------------------------------------------------------- */
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        form.reset();
        touched = false;
        clearStatus();
        Object.keys(validators).forEach(function (name) {
          var input = form.elements[name];
          var box = $('#' + name + '-error', form);
          if (input) input.removeAttribute('aria-invalid');
          if (box) box.textContent = '';
        });
        form.elements.name.focus();
      });
    }
  }

  /* ---------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------- */

  function start() {
    initHeader();
    initNav();
    initScrollSpy();
    initReveal();
    initYear();
    initForm();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
}());