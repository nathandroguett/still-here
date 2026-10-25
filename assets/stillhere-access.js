/* Still Here: sign-in, unlocking and the Stripe buttons.
   One file, shared by every page. It does three jobs:
     1. Chapters 11 to 34: shows the paywall, signs buyers in by email link,
        then fetches the chapter text from private storage and puts it on the page.
     2. Support forms: sends each amount to the right Stripe payment link.
     3. The "Unlock" card on Chapter 10 and the /unlock/ page buyers land on after paying.

   To go live with real payments, change STRIPE_MODE below from 'test' to 'live'. */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://polsfpnpvbeqnypcctjy.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_2YkE95Ou93iB8DM3sjXmBA_db95poEv'; // publishable: safe in the browser
  var SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js';
  var SUPABASE_SRI = 'sha384-Rj26LVGvoeRVR6+mwQmFfcR3QOBEwT+ZmuCWpuiqeTzJpCs0ER4ITAWGb4Hiy3Ok';
  var TOKEN_KEY = 'sb-polsfpnpvbeqnypcctjy-auth-token';

  var STRIPE_MODE = 'test'; // 'test' = Stripe Sandbox, 'live' = real money

  var LINKS = {
    test: {
      book: 'https://buy.stripe.com/test_00w4gAcPb4ohemXdtS48001',
      any: 'https://buy.stripe.com/test_dRm5kEbL71c5fr1gG448000',
      once: {
        5: 'https://buy.stripe.com/test_bJe5kE16t4ohgv50H648006',
        10: 'https://buy.stripe.com/test_28EbJ27uRdYR7YzexW48007',
        25: 'https://buy.stripe.com/test_dRm5kE7uRdYRcePcpO48008',
        50: 'https://buy.stripe.com/test_9B6fZig1n4oh5Qr75u48009'
      },
      monthly: {
        5: 'https://buy.stripe.com/test_5kQ14o7uR8Ex92D2Pe48002',
        10: 'https://buy.stripe.com/test_6oUfZi7uR7Ata6HgG448003',
        25: 'https://buy.stripe.com/test_cNieVebL7g6Za6HgG448004',
        50: 'https://buy.stripe.com/test_28E28s9CZ6wp5QrdtS48005'
      }
    },
    live: {
      book: 'https://buy.stripe.com/00w4gAcPb4ohemXdtS48001',
      any: 'https://buy.stripe.com/5kQ14o7uR8Ex92D2Pe48002',
      once: {
        5: 'https://buy.stripe.com/28EbJ27uRdYR7YzexW48007',
        10: 'https://buy.stripe.com/dRm5kE7uRdYRcePcpO48008',
        25: 'https://buy.stripe.com/9B6fZig1n4oh5Qr75u48009',
        50: 'https://buy.stripe.com/eVq28s16tg6ZemX3Ti4800a'
      },
      monthly: {
        5: 'https://buy.stripe.com/6oUfZi7uR7Ata6HgG448003',
        10: 'https://buy.stripe.com/cNieVebL7g6Za6HgG448004',
        25: 'https://buy.stripe.com/28E28s9CZ6wp5QrdtS48005',
        50: 'https://buy.stripe.com/bJe5kE16t4ohgv50H648006'
      }
    }
  };
  var L = LINKS[STRIPE_MODE];

  var me = document.currentScript;
  var ROOT = me ? me.src.replace(/assets\/stillhere-access\.js.*$/, '') : '../';
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- Supabase, loaded only when it's needed ---------- */
  var sbPromise = null;
  function supabase() {
    if (sbPromise) return sbPromise;
    sbPromise = new Promise(function (resolve, reject) {
      if (window.supabase && window.supabase.createClient) return resolve();
      var s = document.createElement('script');
      s.src = SUPABASE_JS; s.integrity = SUPABASE_SRI; s.crossOrigin = 'anonymous';
      s.onload = function () { resolve(); };
      s.onerror = function () { sbPromise = null; reject(new Error('load')); };
      document.head.appendChild(s);
    }).then(function () {
      return window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { flowType: 'implicit', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
    });
    return sbPromise;
  }
  function hasStoredSession() {
    try { return !!localStorage.getItem(TOKEN_KEY); } catch (e) { return false; }
  }
  function linkInUrl() { return /access_token=|error_description=/.test(location.hash); }
  function linkError() {
    var m = /error_description=([^&]*)/.exec(location.hash);
    return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : '';
  }
  function cleanHash() {
    if (/access_token=|error/.test(location.hash) && history.replaceState)
      history.replaceState(null, '', location.pathname + location.search);
  }
  function getUser() {
    return supabase().then(function (sb) {
      return sb.auth.getSession().then(function (r) {
        cleanHash();
        var s = r.data && r.data.session;
        return { sb: sb, email: s && s.user ? s.user.email : null };
      });
    });
  }
  function ownsBook(sb) {
    return sb.rpc('has_book').then(function (r) { if (r.error) throw r.error; return r.data === true; });
  }
  function sendLink(email, back) {
    return supabase().then(function (sb) {
      return sb.auth.signInWithOtp({ email: email, options: { emailRedirectTo: back, shouldCreateUser: true } });
    }).then(function (r) { if (r.error) throw r.error; });
  }
  function here() { return location.origin + location.pathname; }
  function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
  function withEmail(url, email) {
    return email ? url + (url.indexOf('?') < 0 ? '?' : '&') + 'prefilled_email=' + encodeURIComponent(email) : url;
  }
  var knownEmail = null;
  function sendFailMessage(err) {
    var m = (err && (err.message || '')) + '';
    if (/rate|seconds|too many/i.test(m)) return 'Too many links in a row. Give it a minute, then try again.';
    if (err && err.message === 'load') return 'I couldn’t reach the sign-in service. Check your connection and try again.';
    return 'That didn’t send. Check the email address and try again.';
  }

  /* ---------- 1. Locked chapters ---------- */
  function lockedChapter() {
    var box = $('shLock'); if (!box) return;
    var ch = box.getAttribute('data-ch');
    var file = 'chapter-' + ch + '.html';
    var views = ['sh-buy', 'sh-wait', 'sh-nope', 'sh-err'];
    function show(v) { views.forEach(function (id) { var el = $(id); if (el) el.hidden = id !== v; }); }

    var buy = box.querySelector('[data-buy]');
    if (buy) buy.href = L.book;

    // "Already bought it?" form
    var form = $('sh-form'), input = $('sh-email'), note = $('sh-note');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = input.value.trim();
      if (!validEmail(v)) { note.textContent = 'That email doesn’t look quite right.'; input.focus(); return; }
      var btn = form.querySelector('button'); btn.disabled = true; note.textContent = 'Sending…';
      sendLink(v, here()).then(function () {
        form.hidden = true;
        $('sh-sent').hidden = false;
        $('sh-sent-to').textContent = v;
      }, function (err) { note.textContent = sendFailMessage(err); }).then(function () { btn.disabled = false; });
    });
    var again = $('sh-again');
    if (again) again.addEventListener('click', function () { $('sh-sent').hidden = true; form.hidden = false; input.focus(); });

    var bad = linkError();
    if (bad) { cleanHash(); note.textContent = 'That link has expired or was already used. Send yourself a fresh one.'; }

    if (!hasStoredSession() && !linkInUrl()) return; // a first-time visitor just sees the offer

    show('sh-wait');
    var sbRef = null;
    function open() {
      show('sh-wait');
      return getUser().then(function (u) {
        sbRef = u.sb; knownEmail = u.email;
        if (!u.email) { show('sh-buy'); return; }
        return u.sb.storage.from('chapters').download(file).then(function (r) {
          if (r.data) return r.data.text().then(function (html) { reveal(html, u.email); });
          // No file came back. Either they haven't bought it, or something else went wrong.
          return ownsBook(u.sb).then(function (owns) {
            if (owns) { show('sh-err'); return; }
            $('sh-who').textContent = u.email;
            var b2 = $('sh-buy2'); if (b2) b2.href = withEmail(L.book, u.email);
            show('sh-nope');
          });
        });
      }).catch(function () { show('sh-err'); });
    }
    function reveal(html, email) {
      var wrap = document.createElement('div');
      wrap.className = 'sh-text';
      wrap.innerHTML = html;
      box.parentNode.replaceChild(wrap, box);
      bindZoom(wrap);
      var end = document.querySelector('.end-mark');
      if (end) {
        var p = document.createElement('p');
        p.className = 'sh-signed';
        p.innerHTML = 'Signed in as <span></span> · <button type="button">Sign out</button>';
        p.querySelector('span').textContent = email;
        p.querySelector('button').addEventListener('click', signOut);
        end.parentNode.insertBefore(p, end.nextSibling);
      }
      window.dispatchEvent(new Event('resize')); // refresh the reading-progress bar
    }
    function signOut() {
      (sbRef ? Promise.resolve(sbRef) : supabase()).then(function (sb) { return sb.auth.signOut(); })
        .catch(function () {}).then(function () { location.reload(); });
    }
    [].forEach.call(box.querySelectorAll('[data-signout]'), function (b) { b.addEventListener('click', signOut); });
    [].forEach.call(box.querySelectorAll('[data-retry]'), function (b) { b.addEventListener('click', open); });
    open();
  }

  // Photos inside the unlocked text open in the page's existing lightbox.
  function bindZoom(scope) {
    var lb = $('lb'), img = $('lbImg'), cap = $('lbCap');
    if (!lb || !img) return;
    [].forEach.call(scope.querySelectorAll('.zoom'), function (b) {
      b.addEventListener('click', function () {
        img.src = b.getAttribute('data-full');
        var i = b.querySelector('img'); img.alt = i ? i.alt : '';
        if (cap) cap.textContent = b.getAttribute('data-cap') || '';
        if (lb.showModal) lb.showModal(); else lb.setAttribute('open', '');
      });
    });
  }

  /* ---------- 2. Support forms ---------- */
  function supportForm() {
    var f = $('support'); if (!f || f.tagName !== 'FORM') return;
    var other = $('otherField'), btn = $('sp-btn'), monthly = $('sp-monthly'), note = $('sp-note');
    function amount() {
      var b = f.querySelector('.amounts button[aria-pressed="true"]');
      return b ? b.getAttribute('data-amt') : '10';
    }
    // There's no amount to type here: Stripe asks for it on the next screen.
    function relabel() {
      if (amount() !== 'other') return;
      if (other) other.hidden = true;
      btn.textContent = monthly && monthly.checked ? 'Choose a monthly amount' : 'Choose your own amount';
    }
    [].forEach.call(f.querySelectorAll('.amounts button'), function (b) { b.addEventListener('click', relabel); });
    if (monthly) monthly.addEventListener('change', relabel);

    // Runs before the page's own preview handler, and replaces it.
    window.addEventListener('submit', function (e) {
      if (e.target !== f) return;
      e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation();
      var a = amount(), m = monthly && monthly.checked, url;
      if (a === 'other') {
        if (m) { note.textContent = 'Monthly support comes in $5, $10, $25 or $50. Pick one of those, or untick monthly to give any amount.'; return; }
        url = L.any;
      } else {
        url = (m ? L.monthly : L.once)[a];
        if (!url) { note.textContent = 'Monthly support comes in $5, $10, $25 or $50.'; return; }
      }
      note.textContent = 'Opening secure checkout…';
      location.href = withEmail(url, knownEmail);
    }, true);

    if (/[?&]thanks=1/.test(location.search)) {
      note.textContent = 'Thank you. Truly. It means more than you’d think.';
      note.classList.add('sh-thanks');
      var give = $('give') || f;
      setTimeout(function () { give.scrollIntoView({ block: 'center' }); }, 300);
    }
  }

  /* ---------- 3a. Chapter 10's unlock card ---------- */
  function unlockCard() {
    var card = $('nextCh');
    if (!card || card.getAttribute('href') !== '#') return;
    card.href = L.book;
    // Runs before the page's old "preview only" handler, and replaces it.
    window.addEventListener('click', function (e) {
      if (!card.contains(e.target)) return;
      e.stopImmediatePropagation(); e.stopPropagation();
      if (card.getAttribute('data-owned')) return; // plain link to Chapter 11
      e.preventDefault();
      location.href = withEmail(L.book, knownEmail);
    }, true);
    if (!hasStoredSession()) return;
    getUser().then(function (u) {
      knownEmail = u.email;
      if (!u.email) return;
      return ownsBook(u.sb).then(function (owns) {
        if (!owns) return;
        card.setAttribute('data-owned', '1');
        card.href = '../chapter-11/';
        var go = card.querySelector('.go');
        if (go && go.firstChild) go.firstChild.textContent = 'Keep reading ';
      });
    }).catch(function () {});
  }

  /* ---------- 3b. The /unlock/ page ---------- */
  function unlockPage() {
    var root = $('shUnlock'); if (!root) return;
    var views = ['un-ask', 'un-sent', 'un-check', 'un-yes', 'un-no', 'un-err'];
    function show(v) { views.forEach(function (id) { $(id).hidden = id !== v; }); }
    var form = $('un-form'), input = $('un-email'), note = $('un-note'), sb = null;
    $('un-buy').href = L.book;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = input.value.trim();
      if (!validEmail(v)) { note.textContent = 'That email doesn’t look quite right.'; input.focus(); return; }
      var btn = form.querySelector('button'); btn.disabled = true; note.textContent = 'Sending…';
      sendLink(v, here()).then(function () { $('un-to').textContent = v; show('un-sent'); note.textContent = ''; },
        function (err) { note.textContent = sendFailMessage(err); }).then(function () { btn.disabled = false; });
    });
    $('un-resend').addEventListener('click', function () { show('un-ask'); input.focus(); });
    [].forEach.call(root.querySelectorAll('[data-signout]'), function (b) {
      b.addEventListener('click', function () {
        (sb ? sb.auth.signOut() : Promise.resolve()).catch(function () {}).then(function () { show('un-ask'); input.value = ''; input.focus(); });
      });
    });
    $('un-recheck').addEventListener('click', function () { poll(sb, 0); });

    if (linkError()) { cleanHash(); note.textContent = 'That link has expired or was already used. Send yourself a fresh one.'; }
    if (!hasStoredSession() && !linkInUrl()) return;

    show('un-check');
    getUser().then(function (u) {
      sb = u.sb;
      if (!u.email) { show('un-ask'); return; }
      [].forEach.call(root.querySelectorAll('[data-who]'), function (el) { el.textContent = u.email; });
      input.value = u.email;
      poll(sb, 0);
    }).catch(function () { show('un-err'); });

    // Stripe tells the site about a payment within a few seconds, so keep checking for up to a minute.
    function poll(client, n) {
      show('un-check');
      ownsBook(client).then(function (owns) {
        if (owns) { show('un-yes'); return; }
        if (n < 12) setTimeout(function () { poll(client, n + 1); }, 5000);
        else show('un-no');
      }, function () { show('un-err'); });
    }
  }

  /* ---------- 4. "Next book" sign-ups ---------- */
  var GOAL = 1000;      // sign-ups needed before book two starts
  var SHOW_AFTER = 50;  // the counter stays hidden until this many real people have signed up

  function signupForm() {
    var f = $('signup'); if (!f || f.tagName !== 'FORM') return;
    var em = $('su-email'), nm = $('su-name'), note = $('su-note');
    window.addEventListener('submit', function (e) {
      if (e.target !== f) return;
      e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation();
      var v = em.value.trim(), name = nm ? nm.value.trim().slice(0, 80) : '';
      if (!validEmail(v)) { note.textContent = 'That email doesn’t look quite right.'; em.focus(); return; }
      var btn = f.querySelector('button[type="submit"]'); btn.disabled = true; note.textContent = 'Saving…';
      var where = location.pathname.split('/').filter(Boolean).pop() || 'home';
      supabase().then(function (sb) {
        return sb.from('signups').insert({ email: v.toLowerCase(), first_name: name || null, source: where.slice(0, 40) });
      }).then(function (r) {
        if (r.error && r.error.code !== '23505') throw r.error;
        var thanks = name ? 'Thank you, ' + name + '. ' : 'Thank you. ';
        note.textContent = r.error ? 'You’re already on the list. ' + thanks + 'I’ll be in touch.' : thanks + 'You’re on the list, and you’ll be the first to know.';
        f.reset(); refreshCount();
      }).catch(function () {
        note.textContent = 'That didn’t save. Check your connection and try again.';
      }).then(function () { btn.disabled = false; });
    }, true);
  }

  function refreshCount() {
    var m = $('su-meter'); if (!m) return;
    supabase().then(function (sb) { return sb.rpc('signup_count'); }).then(function (r) {
      var n = r && typeof r.data === 'number' ? r.data : 0;
      if (n < SHOW_AFTER) return;
      m.hidden = false;
      m.querySelector('.fill').style.width = Math.min(100, n / GOAL * 100).toFixed(1) + '%';
      var left = Math.max(0, GOAL - n);
      m.querySelector('.k').textContent = left
        ? n.toLocaleString('en-AU') + ' signed up · ' + left.toLocaleString('en-AU') + ' to go'
        : n.toLocaleString('en-AU') + ' signed up. We did it. I’m writing.';
    }).catch(function () {});
  }
  function counter() {
    var m = $('su-meter'); if (!m) return;
    // Only load the sign-in library once the reader scrolls near the form.
    if (!('IntersectionObserver' in window)) return refreshCount();
    var io = new IntersectionObserver(function (es) {
      if (es.some(function (x) { return x.isIntersecting; })) { io.disconnect(); refreshCount(); }
    }, { rootMargin: '400px' });
    io.observe($('signup') || m.parentNode); // the meter itself is hidden, so watch its form
  }

  /* ---------- Support forms everywhere: pass on the signed-in email ---------- */
  function rememberEmail() {
    if (knownEmail || !hasStoredSession() || $('shLock') || $('shUnlock') || ($('nextCh') && $('nextCh').getAttribute('href') === '#')) return;
    getUser().then(function (u) { knownEmail = u.email; }).catch(function () {});
  }

  function start() { lockedChapter(); unlockCard(); unlockPage(); supportForm(); signupForm(); counter(); rememberEmail(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
