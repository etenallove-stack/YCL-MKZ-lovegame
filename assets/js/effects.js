/* ========================================================================
   視覺特效：櫻花、花瓣暴風雨、閃光、光玉飛行
   全部畫在 1280x720 的座標系上。
   ======================================================================== */

var Effects = (function () {

  var canvas, ctx;
  var petals = [];
  var ambient = 0;          // 常駐櫻花的目標數量
  var running = false;
  var W = 1280, H = 720;

  var COLORS = ['#ffd9e4', '#ffc6d9', '#ffe8ef', '#ffb8cf', '#fff2f6'];

  function init(el) {
    canvas = el;
    ctx = canvas.getContext('2d');
  }

  function makePetal(opts) {
    opts = opts || {};
    var burst = !!opts.burst;
    return {
      x: opts.x != null ? opts.x : Math.random() * (W + 200) - 100,
      y: opts.y != null ? opts.y : -20 - Math.random() * H,
      size: 7 + Math.random() * 9,
      // 暴風雨時花瓣又快又斜，平時只是慢慢飄落
      vy: burst ? 2.2 + Math.random() * 4.5 : 0.6 + Math.random() * 1.1,
      vx: burst ? -3.5 - Math.random() * 3.5 : -0.5 - Math.random() * 0.9,
      spin: (Math.random() - 0.5) * 0.12,
      angle: Math.random() * Math.PI * 2,
      sway: 0.6 + Math.random() * 1.6,
      phase: Math.random() * Math.PI * 2,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      alpha: burst ? 1 : 0.55 + Math.random() * 0.45,
      burst: burst
    };
  }

  function drawPetal(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    // 一片花瓣：兩條對稱曲線收在尖端
    ctx.beginPath();
    ctx.moveTo(0, -p.size / 2);
    ctx.bezierCurveTo(p.size / 2, -p.size / 3, p.size / 2.4, p.size / 3, 0, p.size / 2);
    ctx.bezierCurveTo(-p.size / 2.4, p.size / 3, -p.size / 2, -p.size / 3, 0, -p.size / 2);
    ctx.fill();
    ctx.restore();
  }

  function tick() {
    if (!running) return;
    ctx.clearRect(0, 0, W, H);

    for (var i = petals.length - 1; i >= 0; i--) {
      var p = petals[i];
      p.phase += 0.03;
      p.y += p.vy;
      p.x += p.vx + Math.sin(p.phase) * p.sway;
      p.angle += p.spin;
      if (p.burst) p.alpha -= 0.004;

      var gone = p.y > H + 40 || p.x < -80 || p.alpha <= 0;
      if (gone) {
        // 常駐花瓣從頂端回收再利用，暴風雨花瓣直接消失
        if (p.burst) petals.splice(i, 1);
        else { petals[i] = makePetal({ y: -20 }); }
        continue;
      }
      drawPetal(p);
    }

    // 常駐數量不足就補
    var ambientCount = 0;
    for (var j = 0; j < petals.length; j++) if (!petals[j].burst) ambientCount++;
    if (ambientCount < ambient) petals.push(makePetal());

    requestAnimationFrame(tick);
  }

  function start() {
    if (running) return;
    running = true;
    requestAnimationFrame(tick);
  }

  /** 開啟常駐飄落的櫻花（count = 同時在畫面上的花瓣數） */
  function sakura(count) {
    ambient = count || 0;
    if (ambient === 0) {
      petals = petals.filter(function (p) { return p.burst; });
    } else {
      for (var i = petals.length; i < ambient; i++) petals.push(makePetal());
    }
    start();
  }

  /** 花瓣暴風雨：從右上角灌進來一大片 */
  function petalStorm(amount) {
    amount = amount || 160;
    for (var i = 0; i < amount; i++) {
      petals.push(makePetal({
        burst: true,
        x: W * 0.35 + Math.random() * (W * 0.85),
        y: -Math.random() * H * 0.9
      }));
    }
    start();
  }

  /** 全部清空（換場景時用） */
  function clear() {
    ambient = 0;
    petals = [];
    if (ctx) ctx.clearRect(0, 0, W, H);
  }

  /** 白色閃光一下
   *  注意：這裡刻意用 setTimeout 而不是 requestAnimationFrame。分頁切到背景時
   *  瀏覽器會凍結 rAF，畫面就會卡在全白蓋版。setTimeout 至少一定會被執行。 */
  function flash(strength, ms) {
    var el = document.getElementById('flash');
    el.style.transitionDuration = '0ms';
    el.style.opacity = strength == null ? 0.75 : strength;
    setTimeout(function () {
      el.style.transitionDuration = (ms || 450) + 'ms';
      el.style.opacity = 0;
    }, 20);
  }

  /**
   * 一顆光玉從畫面某處飛向計數器。
   * done 一定會被呼叫 —— 這個 callback 負責發光玉並解除熱區鎖定，
   * 所以整段流程只用 setTimeout 排程，絕不能依賴 rAF（背景分頁會被凍結）。
   * @param {number} x,y 起點（stage 座標）
   * @param {function} done 飛到之後的 callback
   */
  function orbFly(x, y, done) {
    var stage = document.getElementById('stage');
    var slot = document.querySelector('#orbBar .orb:not(.filled)');
    var el = document.createElement('div');
    el.className = 'orb-fly';
    el.style.left = (x - 13) + 'px';
    el.style.top = (y - 13) + 'px';
    stage.appendChild(el);

    var finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      el.remove();
      if (done) done();
    }

    // 先向上浮一下再飛過去，動作比較有生命感
    setTimeout(function () {
      el.style.transitionDuration = '300ms';
      el.style.top = (y - 60) + 'px';
      el.style.transform = 'scale(1.5)';
    }, 20);

    setTimeout(function () {
      var tx = 40, ty = 34;
      if (slot) {
        // orbBar 在 stage 座標系裡的位置是固定的，直接量 offset 就好
        var bar = document.getElementById('orbBar');
        tx = bar.offsetLeft + slot.offsetLeft;
        ty = bar.offsetTop + slot.offsetTop;
      }
      el.style.transitionDuration = '650ms';
      el.style.left = tx + 'px';
      el.style.top = ty + 'px';
      el.style.transform = 'scale(.7)';
    }, 340);

    setTimeout(finish, 1040);
  }

  /** 在畫面某處亮起一團柔光，然後淡掉 */
  function glow(x, y, radius, ms) {
    radius = radius || 180;
    ms = ms || 1600;
    var stage = document.getElementById('stage');
    var el = document.createElement('div');
    el.style.cssText =
      'position:absolute;left:' + (x - radius) + 'px;top:' + (y - radius) + 'px;' +
      'width:' + (radius * 2) + 'px;height:' + (radius * 2) + 'px;' +
      'border-radius:50%;pointer-events:none;z-index:14;opacity:0;' +
      'background:radial-gradient(circle,rgba(255,244,204,.85) 0%,rgba(255,226,150,.45) 35%,rgba(255,214,120,0) 70%);' +
      'transition:opacity ' + (ms / 3) + 'ms ease';
    stage.appendChild(el);

    setTimeout(function () { el.style.opacity = '1'; }, 20);
    setTimeout(function () { el.style.opacity = '0'; }, ms * 0.55);
    setTimeout(function () { el.remove(); }, ms + 200);
  }

  /** 塗鴉：糰子大家族的圖案，用 SVG 畫，不需要圖檔 */
  function dangoDoodle(x, y) {
    var stage = document.getElementById('stage');
    var wrap = document.createElement('div');
    wrap.style.cssText = 'position:absolute;left:' + (x - 130) + 'px;top:' + (y - 90) +
      'px;width:260px;height:180px;pointer-events:none;z-index:15;opacity:0;' +
      'transition:opacity .6s ease, transform .6s ease;transform:scale(.8)';

    var dangos = '';
    var spots = [[70, 96], [120, 78], [172, 92], [96, 132], [148, 132]];
    for (var i = 0; i < spots.length; i++) {
      var cx = spots[i][0], cy = spots[i][1];
      dangos +=
        '<g>' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="26" fill="#fff3f6" stroke="#e8a9bd" stroke-width="3"/>' +
        '<circle cx="' + (cx - 9) + '" cy="' + (cy - 3) + '" r="2.6" fill="#5a4a52"/>' +
        '<circle cx="' + (cx + 9) + '" cy="' + (cy - 3) + '" r="2.6" fill="#5a4a52"/>' +
        '<path d="M' + (cx - 6) + ' ' + (cy + 9) + ' q6 6 12 0" stroke="#5a4a52" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
        '<circle cx="' + (cx - 17) + '" cy="' + (cy + 5) + '" r="4" fill="#ffc2d2" opacity=".85"/>' +
        '<circle cx="' + (cx + 17) + '" cy="' + (cy + 5) + '" r="4" fill="#ffc2d2" opacity=".85"/>' +
        '</g>';
    }

    wrap.innerHTML =
      '<svg viewBox="0 0 260 180" width="260" height="180">' +
      '<defs><filter id="dangoGlow" x="-50%" y="-50%" width="200%" height="200%">' +
      '<feGaussianBlur stdDeviation="6" result="b"/>' +
      '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>' +
      '</filter></defs>' +
      '<g filter="url(#dangoGlow)">' + dangos + '</g>' +
      '</svg>';

    stage.appendChild(wrap);
    setTimeout(function () {
      wrap.style.opacity = '1';
      wrap.style.transform = 'scale(1)';
    }, 20);

    return {
      remove: function () {
        wrap.style.opacity = '0';
        setTimeout(function () { wrap.remove(); }, 620);
      }
    };
  }

  return {
    init: init,
    sakura: sakura,
    petalStorm: petalStorm,
    clear: clear,
    flash: flash,
    glow: glow,
    orbFly: orbFly,
    dangoDoodle: dangoDoodle
  };
})();
