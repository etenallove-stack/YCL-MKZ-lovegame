/* ========================================================================
   遊戲引擎 — 一般情況下不需要改這個檔案，劇情請改 story/story.js
   ======================================================================== */

var Game = (function () {

  'use strict';

  var TYPE_SPEED = 28;        // 每個字的間隔（毫秒）
  var AUTO_BASE  = 900;       // 自動模式每句最少停留
  var AUTO_PER   = 55;        // 自動模式每個字再多停留
  var SAVE_KEY   = 'love_game_save_v1';

  var el = {};                // DOM 快取
  var state;                  // 進度（會被存檔）
  var seq = null;             // 目前正在播的一串台詞
  var typing = null;          // 打字機的計時器
  var autoTimer = null;
  var autoOn = false;
  var backlog = [];
  var scene = null;           // 目前場景物件
  var pendingComplete = false;

  /* ---------------- 初始化 ---------------- */

  function init() {
    ['viewport', 'stage', 'bg', 'fx', 'chars', 'propsBack', 'propsFront', 'hotspots', 'orbBar', 'hint',
     'box', 'who', 'text', 'next', 'choices', 'card', 'cardText', 'menu',
     'backlog', 'backlogList', 'backlogClose', 'toast']
      .forEach(function (id) { el[id] = document.getElementById(id); });

    Effects.init(el.fx);
    fitStage();
    window.addEventListener('resize', fitStage);
    window.addEventListener('orientationchange', fitStage);
    document.addEventListener('visibilitychange', fitStage);
    // resize 事件不一定會發生（例如頁面是在隱藏的容器裡載入，之後才被顯示出來），
    // 直接盯著容器本身的尺寸變化才可靠。
    if (window.ResizeObserver) new ResizeObserver(fitStage).observe(el.viewport);

    el.stage.addEventListener('click', onStageClick);
    // 捕獲階段：熱區和選項會擋掉冒泡，但這裡照樣收得到，
    // 所以不管玩家第一下點在哪，被擋掉的背景音樂都能補放。
    el.stage.addEventListener('click', function () {
      if (audio && audio.paused) tryPlay();
    }, true);
    el.menu.addEventListener('click', onMenuClick);
    el.backlogClose.addEventListener('click', function (e) {
      e.stopPropagation();
      el.backlog.hidden = true;
    });
    document.addEventListener('keydown', onKey);

    newState();
    goto(STORY.start);
  }

  function newState() {
    state = {
      scene: null,
      line: 0,
      orbs: 0,
      affection: 0,
      names: {},
      flags: {},
      done: {}          // 已探索過的熱區，key 是 "場景id:熱區id"
    };
  }

  /** 把 1280x720 的畫布等比縮放到視窗大小 */
  function fitStage() {
    var w = window.innerWidth || document.documentElement.clientWidth;
    var h = window.innerHeight || document.documentElement.clientHeight;
    var s = Math.min(w / 1280, h / 720);
    // 頁面如果是在還沒顯示出來的容器裡載入（隱藏的分頁、尺寸還沒算出來的 iframe），
    // 量到的視窗會是 0，縮放比就變成 0，整個畫面被縮成一個點而且再也回不來。
    // 這種情況先當 1，等真的量得到尺寸時上面的 ResizeObserver 會再校正。
    if (!isFinite(s) || s <= 0) s = 1;
    el.stage.style.transform = 'translate(-50%, -50%) scale(' + s + ')';
  }

  /* ---------------- 背景與立繪 ---------------- */

  function setBackground(bgId) {
    if (!bgId) return;
    var def = BACKGROUNDS[bgId] || {};
    el.bg.style.opacity = '0';

    // 先試著載入真的圖檔，沒有就退回 CSS 色塊
    var probe = new Image();
    probe.onload = function () { applyBg('url("' + probe.src + '")'); };
    probe.onerror = function () { applyBg(def.fallback || '#1a1f2e'); };
    probe.src = 'assets/backgrounds/' + bgId + '.jpg';

    function applyBg(value) {
      el.bg.style.background = value;
      el.bg.style.backgroundSize = 'cover';
      el.bg.style.backgroundPosition = 'center';
      el.bg.style.opacity = '1';
    }
  }

  function faceSrc(charId, face) {
    var c = CHARACTERS[charId];
    if (!c) return null;
    var i = c.faces.indexOf(face);
    if (i < 0) {
      console.warn('找不到表情：' + charId + ' / ' + face + '，改用第一個表情');
      i = 0;
    }
    var n = (i + 1) < 10 ? '0' + (i + 1) : String(i + 1);
    return c.dir + '/' + n + '_' + c.faces[i] + '.png';
  }

  /**
   * 顯示角色立繪。opts 可以是場景的 char 設定，或一行台詞的 {face, pos}。
   *
   *   opts.image   全身姿勢圖的路徑（從專案根目錄算起）
   *   opts.height  姿勢圖要畫多高（stage 上的像素，畫布是 1280x720）
   *   opts.bottom  腳底離畫面底部多遠，用來把人站在地面線上
   *   opts.x       站位，畫面寬度的百分比（圖片的水平中心）
   *   opts.face    半身表情圖的名稱
   *
   * 全身姿勢用來撐場景，一旦角色開口說話（台詞帶 face）就換成半身表情，
   * 像鏡頭從遠景推到特寫；換回來時再套用場景原本的姿勢設定。
   */
  function showChar(charId, opts) {
    opts = opts || {};
    var img = el.chars.querySelector('[data-char="' + charId + '"]');
    if (!img) {
      img = document.createElement('img');
      img.dataset.char = charId;
      img.className = 'hidden';
      el.chars.appendChild(img);
      // 讓 class 先套上再改，才會有淡入效果（用 setTimeout，背景分頁不會卡住）
      setTimeout(function () { img.classList.remove('hidden'); }, 20);
    }

    if (opts.image) {
      // 姿勢圖還沒放進來時，退回這個角色的表情素材，不要留一張破圖
      img.onerror = function () {
        img.onerror = null;
        console.warn('找不到姿勢圖 ' + opts.image + '，改用表情素材');
        showChar(charId, { face: opts.face || CHARACTERS[charId].faces[0], pos: opts.pos });
      };
      img.src = opts.image;
      img.style.height = (opts.height || 620) + 'px';
      img.style.bottom = (opts.bottom || 0) + 'px';
      if (opts.x != null) {
        img.style.left = opts.x + '%';
        img.style.transform = 'translateX(-50%)';
      }
    } else if (opts.face) {
      img.onerror = null;
      img.src = faceSrc(charId, opts.face);
      // 半身表情圖：清掉姿勢圖的行內樣式，回到 CSS 的預設框法
      img.style.height = '';
      img.style.bottom = '';
      img.style.left = '';
      img.style.transform = '';
    }

    if (!(opts.image && opts.x != null)) {
      // 站位的優先順序：台詞指定 > 場景的 positions 覆寫 > 角色預設 > 置中。
      // 場景覆寫是給「這一幕的人站的位置和平常相反」用的，
      // 例如她在左邊的黑板前，男主從右邊的門口探頭進來。
      var pos = opts.pos
             || (scene && scene.positions && scene.positions[charId])
             || (CHARACTERS[charId] || {}).pos
             || 'center';
      img.className = img.className.replace(/pos-\w+/g, '').trim();
      img.classList.add('pos-' + pos);
    }
    img.classList.remove('hidden');
    return img;
  }

  function clearChars() {
    el.chars.innerHTML = '';
  }

  /**
   * 幫探索熱區放上它的道具圖。
   * 素材還沒放進來就靜靜地不顯示，不會讓遊戲壞掉 —— 這樣可以先玩到流程，
   * 之後把 PNG 丟進 assets/props/ 就自動出現，不用改任何程式。
   */
  function addProp(h) {
    if (!h.image) return;
    var box = h.imageBox || { x: h.x, y: h.y, w: h.w, h: h.h };
    var img = document.createElement('img');
    img.className = 'prop';
    img.dataset.prop = h.id;
    img.style.left = box.x + '%';
    img.style.top = box.y + '%';
    img.style.width = box.w + '%';
    if (box.h) img.style.height = box.h + '%';
    img.onload = function () { img.classList.add('shown'); };
    img.onerror = function () { img.remove(); };
    img.src = 'assets/props/' + h.image;
    (h.layer === 'front' ? el.propsFront : el.propsBack).appendChild(img);
  }

  function clearProps() {
    el.propsBack.innerHTML = '';
    el.propsFront.innerHTML = '';
  }

  /** 說話的人亮起來，其他人壓暗 */
  function focusChar(charId) {
    Array.prototype.forEach.call(el.chars.children, function (img) {
      img.classList.toggle('dim', !!charId && img.dataset.char !== charId);
    });
  }

  /* ---------------- 音樂 ---------------- */

  var audio = null;
  var audioId = null;
  var muted = false;

  var missingBgm = {};

  /**
   * 換背景音樂。新曲子確定載得到才會把舊的停掉 ——
   * 音檔還沒放進 assets/bgm/ 的時候，畫面不會突然變安靜，
   * 而是讓上一首繼續播下去。
   */
  function playBgm(id) {
    if (!id) return;

    // 幾個劇本名稱可以指向同一個檔案；audioId 記的是實際檔名，
    // 所以兩幕共用同一首時不會被當成換曲而重播。
    var file = (typeof BGM_ALIAS !== 'undefined' && BGM_ALIAS[id]) || id;
    if (file === audioId || missingBgm[file]) return;

    var prev = audio, prevId = audioId;
    var a = new Audio(BGM_DIR + file + '.mp3');
    a.loop = true;
    a.volume = 0.45;

    a.addEventListener('canplay', function () {
      if (prev) prev.pause();
      audio = a;
      audioId = file;
      tryPlay();
    }, { once: true });

    a.addEventListener('error', function () {
      missingBgm[file] = true;        // 記起來，別每次進這一幕都重試
      audio = prev;
      audioId = prevId;
      console.warn('找不到音樂 ' + BGM_DIR + file + '.mp3，繼續播放上一首');
    }, { once: true });

    a.load();
  }

  /**
   * 瀏覽器規定使用者還沒和頁面互動過就不准自動播放，play() 會被拒絕。
   * 被擋下來不算錯 —— init() 註冊了一個捕獲階段的點擊監聽，
   * 玩家第一次點畫面時就會再試一次。音檔不存在時同樣安靜地放棄。
   */
  function tryPlay() {
    if (!audio || muted) return;
    var p = audio.play();
    if (p && p.catch) p.catch(function () {});
  }

  function toggleMusic() {
    muted = !muted;
    if (muted) { if (audio) audio.pause(); }
    else tryPlay();
    return !muted;
  }

  /* ---------------- 台詞播放 ---------------- */

  function displayName(charId) {
    if (state.names[charId]) return state.names[charId];
    return (CHARACTERS[charId] || {}).name || '';
  }

  /**
   * 依序播完一串台詞，播完呼叫 onDone。
   * 探索階段點熱區、場景本身的對白都走這裡。
   */
  function playLines(lines, onDone) {
    if (!lines || !lines.length) { if (onDone) onDone(); return; }
    seq = { lines: lines, i: -1, onDone: onDone };
    advance();
  }

  function advance() {
    clearAuto();
    if (!seq) return;
    seq.i++;
    if (seq.i >= seq.lines.length) {
      var cb = seq.onDone;
      seq = null;
      if (cb) cb();
      return;
    }
    showLine(seq.lines[seq.i]);
  }

  function showLine(line) {
    if (line.rename && line.who) state.names[line.who] = line.rename;
    if (line.bg) setBackground(line.bg);

    // hide: 'charId' 讓某個角色從畫面上退場（配合 vanish 特效就是憑空消失）
    if (line.hide) {
      var gone = el.chars.querySelector('[data-char="' + line.hide + '"]');
      if (gone) gone.classList.add('hidden');
    }

    if (line.effect) runEffect(line.effect, 640, 360);

    var isNarration = !line.who || line.who === 'narration';

    if (!isNarration) {
      // 台詞可以直接指定一張姿勢圖（連同 height/bottom/x），沒指定就用表情素材
      if (line.image) showChar(line.who, line);
      else if (line.face) showChar(line.who, { face: line.face, pos: line.pos });
      focusChar(line.who);
    } else {
      focusChar(null);
    }

    el.box.hidden = false;
    el.box.classList.toggle('narration', isNarration);
    el.who.textContent = isNarration ? '' : displayName(line.who);
    el.next.hidden = true;

    backlog.push({ who: isNarration ? '' : displayName(line.who), text: line.text });

    // 打字機
    var full = line.text || '';
    var n = 0;
    el.text.textContent = '';
    clearInterval(typing);
    typing = setInterval(function () {
      n++;
      el.text.textContent = full.slice(0, n);
      if (n >= full.length) finishTyping(full);
    }, TYPE_SPEED);
  }

  function finishTyping(full) {
    clearInterval(typing);
    typing = null;
    if (full != null) el.text.textContent = full;
    el.next.hidden = false;
    if (autoOn) {
      autoTimer = setTimeout(advance, AUTO_BASE + el.text.textContent.length * AUTO_PER);
    }
  }

  function isTyping() { return typing !== null; }

  function clearAuto() {
    clearTimeout(autoTimer);
    autoTimer = null;
  }

  function hideBox() {
    el.box.hidden = true;
    el.next.hidden = true;
  }

  /* ---------------- 特效派發 ---------------- */

  var doodle = null;

  function runEffect(name, x, y) {
    if (name === 'petalStorm') {
      Effects.petalStorm(170);
    } else if (name === 'glow') {
      // 讓背景圖上原本就有的東西亮起來
      Effects.glow(x, y, 200);
    } else if (name === 'dango') {
      // 背景沒有糰子圖案時，用 SVG 直接畫一個
      if (doodle) doodle.remove();
      doodle = Effects.dangoDoodle(x, y);
      Effects.flash(0.35, 600);
    } else if (name === 'flash') {
      Effects.flash();
    } else if (name === 'shake') {
      Effects.shake();
    } else if (name === 'vanish') {
      // 憑空消失：白光一閃再震一下
      Effects.flash(0.9, 700);
      Effects.shake(10, 420);
    }
  }

  /* ---------------- 場景切換 ---------------- */

  function goto(sceneId) {
    var s = STORY.scenes[sceneId];
    if (!s) { console.error('找不到場景：' + sceneId); return; }

    // 標記 reset 的場景代表「一輪的起點」（標題畫面）。
    // 沒有這個的話，玩完一輪回到標題再開始，光玉和好感度還留著，
    // 探索階段會因為光玉已經集滿而直接被跳過。
    if (s.reset) {
      newState();
      backlog = [];
      choiceSnapshot = null;
      jumpToChoices = false;
      updateRedoBtn();
    }

    scene = s;
    state.scene = sceneId;
    state.line = 0;

    seq = null;
    clearAuto();
    clearInterval(typing);
    typing = null;
    el.choices.hidden = true;
    el.card.hidden = true;
    el.card.className = '';
    clearTimeout(cardTimer);
    cardTimer = null;
    el.hotspots.innerHTML = '';
    el.hotspots.hidden = false;
    clearProps();
    el.orbBar.hidden = true;
    el.hint.hidden = true;
    if (doodle) { doodle.remove(); doodle = null; }

    if (s.bg) setBackground(s.bg);
    if (s.bgm) playBgm(s.bgm);

    Effects.clear();
    Effects.sakura(s.sakura || 0);

    if (s.char) {
      clearChars();
      showChar(s.char.id, s.char);
    } else if (s.clearChars) {
      clearChars();
    }

    if (s.type === 'explore') startExplore();
    else if (s.type === 'card') startCard();
    else startDialogue();
  }

  /* ---------------- 字卡場景 ----------------
     黑幕標題、結尾 CG 都走這裡：
       type:'card', text:'我們的故事由此開始', duration:3000, next:'下一幕'
     有 bg 就顯示背景圖，沒有就是全黑。
     duration 到了自動前進；玩家點畫面可以提早跳過。
     沒有 next 就停在這裡（用來收尾）。 */

  var cardTimer = null;

  function startCard() {
    clearChars();
    hideBox();
    el.card.className = '';
    if (scene.bg) el.card.classList.add('over-image');
    if (scene.align === 'bottom') el.card.classList.add('align-bottom');
    if (scene.pulse) el.card.classList.add('pulse');
    el.cardText.textContent = scene.text || '';
    el.card.hidden = false;
    setTimeout(function () { el.card.classList.add('shown'); }, 40);

    if (scene.text) backlog.push({ who: '', text: scene.text });

    // duration: 0 代表不自動前進，等玩家點畫面（標題畫面用的就是這個）
    if (scene.next && scene.duration !== 0) {
      cardTimer = setTimeout(function () { goto(scene.next); },
                             scene.duration == null ? 3000 : scene.duration);
    }
  }

  function skipCard() {
    if (!scene.next) return;
    clearTimeout(cardTimer);
    cardTimer = null;
    goto(scene.next);
  }

  /* ---------------- 對話場景 ---------------- */

  function startDialogue() {
    // 從「重選」回來的：跳過整段對白，直接把選項擺出來
    if (jumpToChoices) {
      jumpToChoices = false;
      if (scene.choices && scene.choices.length) {
        if (choiceSnapshot && choiceSnapshot.charsHtml != null) {
          el.chars.innerHTML = choiceSnapshot.charsHtml;
        }
        showChoices(scene.choices);
        return;
      }
    }
    playLines(scene.lines || [], endOfDialogue);
  }

  function endOfDialogue() {
    if (scene.choices && scene.choices.length) {
      showChoices(scene.choices);
    } else if (scene.next) {
      goto(scene.next);
    } else {
      finishTyping(null);   // 沒有下一幕就停在最後一句
    }
  }

  /**
   * 記下「做選擇的當下」的完整進度，右上角的「重選」就是回到這裡。
   * 存的是整份 state 的複本，所以回來時好感度、旗標、光玉都會一起還原，
   * 不會因為重選而重複加分。立繪也一起記，免得回來時表情跳掉。
   */
  var choiceSnapshot = null;
  var jumpToChoices = false;

  function updateRedoBtn() {
    var b = el.menu.querySelector('[data-act="redo"]');
    if (b) b.disabled = !choiceSnapshot;
  }

  function redoChoice() {
    if (!choiceSnapshot) return;
    state = JSON.parse(JSON.stringify(choiceSnapshot.state));
    jumpToChoices = true;
    goto(choiceSnapshot.scene);
  }

  function showChoices(choices) {
    hideBox();
    choiceSnapshot = {
      scene: state.scene,
      state: JSON.parse(JSON.stringify(state)),
      charsHtml: el.chars.innerHTML
    };
    updateRedoBtn();
    el.choices.innerHTML = '';
    choices.forEach(function (c) {
      var b = document.createElement('button');
      b.textContent = c.text;
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        el.choices.hidden = true;
        if (c.affection) state.affection += c.affection;
        if (c.set) Object.keys(c.set).forEach(function (k) { state.flags[k] = c.set[k]; });
        backlog.push({ who: '選擇', text: '→ ' + c.text });
        goto(c.goto);
      });
      el.choices.appendChild(b);
    });
    el.choices.hidden = false;
  }

  /* ---------------- 探索場景 ---------------- */

  function startExplore() {
    state.orbs = countOrbs();
    renderOrbBar();
    el.orbBar.hidden = false;

    // 開場白播完才讓玩家開始點
    playLines(scene.intro || [], function () {
      hideBox();
      buildHotspots();
      showHint();
      checkExploreComplete();
    });
  }

  function countOrbs() {
    var n = 0;
    (scene.hotspots || []).forEach(function (h) {
      if (h.orb && state.done[state.scene + ':' + h.id]) n++;
    });
    return n;
  }

  function renderOrbBar() {
    var need = scene.requiredOrbs || 0;
    var html = '<span class="label">光玉</span>';
    for (var i = 0; i < need; i++) {
      html += '<div class="orb' + (i < state.orbs ? ' filled' : '') + '"></div>';
    }
    el.orbBar.innerHTML = html;
  }

  function buildHotspots() {
    el.hotspots.innerHTML = '';
    clearProps();
    (scene.hotspots || []).forEach(function (h) {
      addProp(h);

      var d = document.createElement('div');
      d.className = 'hotspot';
      d.style.left   = h.x + '%';
      d.style.top    = h.y + '%';
      d.style.width  = h.w + '%';
      d.style.height = h.h + '%';
      d.title = h.label || '';
      if (h.secret) d.classList.add('secret');   // 彩蛋：不發光，讓玩家自己找
      if (state.done[state.scene + ':' + h.id] && !h.repeatable) d.classList.add('done');

      d.addEventListener('click', function (e) {
        e.stopPropagation();
        onHotspot(h, d);
      });

      // 滑到熱區時，讓對應的道具圖也跟著亮起來
      var prop = document.querySelector('.prop[data-prop="' + h.id + '"]');
      if (prop) {
        d.addEventListener('mouseenter', function () { prop.classList.add('glow'); });
        d.addEventListener('mouseleave', function () { prop.classList.remove('glow'); });
      }

      el.hotspots.appendChild(d);
    });
  }

  function showHint() {
    var left = (scene.requiredOrbs || 0) - state.orbs;
    if (left > 0) {
      el.hint.textContent = (scene.hint || '點擊畫面中發光的地方') + '　（還差 ' + left + ' 顆光玉）';
      el.hint.hidden = false;
    } else {
      el.hint.hidden = true;
    }
  }

  function onHotspot(h, node) {
    var key = state.scene + ':' + h.id;
    if (state.done[key] && !h.repeatable) return;
    if (seq) return;                     // 正在播台詞就別受理

    // 播台詞時整層熱區收起來。只把 pointerEvents 關掉的話，
    // 那些呼吸的光點還會亮在畫面上，跟登場的人物疊在一起。
    el.hotspots.hidden = true;
    el.hint.hidden = true;
    el.orbBar.hidden = true;

    // 熱區中心（stage 座標），特效和光玉都從這裡發生
    var cx = (h.x + h.w / 2) / 100 * 1280;
    var cy = (h.y + h.h / 2) / 100 * 720;

    if (h.effect) runEffect(h.effect, cx, cy);

    var firstTime = !state.done[key];
    state.done[key] = true;

    playLines(h.lines || [], function () {
      hideBox();

      // 台詞可能把立繪換成半身表情、也可能讓別的角色登場，
      // 播完要收掉其他人並把場景原本的全身姿勢放回去
      if (scene.char && scene.char.image) {
        Array.prototype.forEach.call(el.chars.children, function (im) {
          if (im.dataset.char !== scene.char.id) im.classList.add('hidden');
        });
        showChar(scene.char.id, scene.char);
        focusChar(null);
      }

      var giveOrb = h.orb && firstTime;
      if (!h.repeatable) node.classList.add('done');

      // 光玉要飛回計數器，所以先把計數器放回畫面上
      el.orbBar.hidden = false;

      // 會發光但不給光玉的地方，要講清楚，不然玩家會以為是 bug。
      // 彩蛋（secret）本來就不發光，玩家沒有在期待光玉，所以不提示。
      if (!h.orb && !h.secret) {
        toast(h.missHint || '……好像不是這個。');
      }

      if (giveOrb) {
        Effects.orbFly(cx, cy, function () {
          state.orbs++;
          renderOrbBar();
          afterHotspot();
        });
      } else {
        afterHotspot();
      }
    });

    function afterHotspot() {
      el.hotspots.hidden = false;
      if (!checkExploreComplete()) showHint();
    }
  }

  function checkExploreComplete() {
    if (pendingComplete) return true;
    if (state.orbs < (scene.requiredOrbs || 0)) return false;

    pendingComplete = true;
    el.hint.hidden = true;
    el.hotspots.innerHTML = '';
    Effects.flash(0.85, 900);

    setTimeout(function () {
      playLines(scene.outro || [], function () {
        pendingComplete = false;
        if (scene.next) goto(scene.next);
        else hideBox();
      });
    }, 500);
    return true;
  }

  /* ---------------- 互動 ---------------- */

  function onStageClick() {
    if (!el.choices.hidden) return;      // 有選項時只能點選項
    if (!el.backlog.hidden) return;
    if (scene && scene.type === 'card') { skipCard(); return; }
    if (!seq) return;                    // 探索中沒有台詞在播，點空白處不做事

    if (isTyping()) finishTyping(seq.lines[seq.i].text);
    else advance();
  }

  function onMenuClick(e) {
    var btn = e.target.closest('button');
    if (!btn) return;
    e.stopPropagation();
    var act = btn.dataset.act;

    if (act === 'redo') {
      redoChoice();
    } else if (act === 'music') {
      btn.classList.toggle('on', toggleMusic());
    } else if (act === 'auto') {
      autoOn = !autoOn;
      btn.classList.toggle('on', autoOn);
      if (autoOn && seq && !isTyping()) finishTyping(null);
      else clearAuto();
    } else if (act === 'log') {
      openBacklog();
    } else if (act === 'save') {
      save();
    } else if (act === 'load') {
      load();
    }
  }

  function onKey(e) {
    if (e.key === 'Enter' || e.key === ' ') { onStageClick(); e.preventDefault(); }
    if (e.key === 'Escape') el.backlog.hidden = true;
  }

  function openBacklog() {
    el.backlogList.innerHTML = backlog.map(function (b) {
      var cls = b.who ? '' : ' narration';
      var name = b.who ? '<b>' + esc(b.who) + '</b>' : '';
      return '<div class="entry' + cls + '">' + name + esc(b.text) + '</div>';
    }).join('');
    el.backlog.hidden = false;
    el.backlogList.scrollTop = el.backlogList.scrollHeight;
  }

  function esc(s) {
    return String(s).replace(/[&<>]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c];
    });
  }

  /* ---------------- 存讀檔 ---------------- */

  function save() {
    // 對話場景記到「目前這句」，探索場景記已探索的熱區
    var snapshot = JSON.parse(JSON.stringify(state));
    snapshot.line = seq ? seq.i : 0;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        state: snapshot, backlog: backlog, choiceSnapshot: choiceSnapshot
      }));
      toast('已存檔');
    } catch (err) {
      toast('存檔失敗');
    }
  }

  function load() {
    var raw;
    try { raw = localStorage.getItem(SAVE_KEY); } catch (err) { raw = null; }
    if (!raw) { toast('沒有存檔'); return; }

    var data = JSON.parse(raw);
    state = data.state;
    backlog = data.backlog || [];
    choiceSnapshot = data.choiceSnapshot || null;
    updateRedoBtn();
    pendingComplete = false;
    autoOn = false;
    el.menu.querySelector('[data-act="auto"]').classList.remove('on');

    var resumeAt = state.line || 0;
    goto(state.scene);

    // 對話場景可以直接跳回存檔當時那一句
    if (scene.type === 'dialogue' && seq && resumeAt > 0 && resumeAt < seq.lines.length) {
      seq.i = resumeAt - 1;
      advance();
    }
    toast('已讀取');
  }

  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.toast.hidden = true; }, 1600);
  }

  /* ---------------- 對外 ---------------- */

  document.addEventListener('DOMContentLoaded', init);

  return {
    goto: goto,
    getState: function () { return state; },
    reset: function () {
      newState();
      backlog = [];
      choiceSnapshot = null;
      jumpToChoices = false;
      updateRedoBtn();
      goto(STORY.start);
    },
    // 音樂沒聲音時，在瀏覽器主控台輸入 Game.audioState() 就能看出是哪一關卡住
    audioState: function () {
      if (!audio) return { track: audioId, loaded: false };
      return {
        track: audioId,
        muted: muted,
        paused: audio.paused,
        readyState: audio.readyState,   // 4 = 可以播了，0 = 還沒載到東西
        duration: audio.duration,
        at: Math.round(audio.currentTime * 10) / 10,
        error: audio.error ? audio.error.code : null
      };
    }
  };
})();
