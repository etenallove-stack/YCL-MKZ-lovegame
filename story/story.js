/* ========================================================================
   劇本檔 — 這是你之後唯一需要動的檔案
   ------------------------------------------------------------------------
   寫法速查：
     台詞    { who: 'heroine', face: 'shy', text: '……嗯。' }
     旁白    { who: 'narration', text: '風把花瓣吹了進來。' }
     改稱呼  { who: 'heroine', face: 'smile', text: '我叫孟格。', rename: '孟格' }
     選項    choices: [{ text: '老實回答', goto: '場景id', affection: 1 }]
   表情名稱請看 README.md 的對照表。
   ======================================================================== */

/* ---------- 登場人物 ---------- */

var CHARACTERS = {
  hero: {
    name: '昱岑',
    dir: 'assets/characters/hero',
    pos: 'left',                 // 預設站位，台詞沒特別指定時就用這個

    // 順序必須和 assets/characters/hero/ 底下的檔名編號一致
    faces: ['smile', 'laugh', 'shy', 'troubled', 'confused', 'thinking', 'surprised', 'nervous',
            'crying', 'sad', 'angry', 'neutral', 'rage', 'flustered', 'smirk', 'deadpan']
  },
  heroine: {
    // 目前的劇本裡她沒有自我介紹的橋段，所以名字一開始就顯示出來。
    // 想保留「？？？」的懸念，把這裡改回 '？？？'，
    // 再在她報上名字那句台詞加 rename: '孟格' 就行。
    name: '孟格',
    dir: 'assets/characters/heroine',
    pos: 'right',
    faces: ['smile', 'happy', 'laugh', 'surprised', 'pout', 'shy', 'sad', 'awkward',
            'crying', 'worried', 'sobbing', 'disappointed', 'annoyed', 'angry', 'smug', 'flustered']
  }
};

/* ---------- 背景 ----------
   把真正的圖檔放到 assets/backgrounds/<id>.jpg 就會自動取代 fallback 的色塊。 */

var BACKGROUNDS = {
  school_gate_spring: {
    label: '校門口・春天的早晨',
    fallback:
      // 地面的陰影，把視線壓回中央
      'radial-gradient(ellipse 130% 34% at 50% 104%, rgba(60,50,44,.34), rgba(60,50,44,0) 62%),' +
      // 樹梢的櫻花冠
      'radial-gradient(circle at 7% 9%,  rgba(255,170,201,.95) 0 9%,  rgba(255,170,201,0) 25%),' +
      'radial-gradient(circle at 19% 2%, rgba(255,198,219,.92) 0 10%, rgba(255,198,219,0) 27%),' +
      'radial-gradient(circle at 32% 11%,rgba(255,178,207,.88) 0 8%,  rgba(255,178,207,0) 23%),' +
      'radial-gradient(circle at 45% 1%, rgba(255,207,226,.82) 0 9%,  rgba(255,207,226,0) 25%),' +
      'radial-gradient(circle at 60% 8%, rgba(255,186,213,.84) 0 8%,  rgba(255,186,213,0) 23%),' +
      'radial-gradient(circle at 76% 1%, rgba(255,202,222,.78) 0 9%,  rgba(255,202,222,0) 25%),' +
      'radial-gradient(circle at 91% 10%,rgba(255,182,209,.85) 0 8%,  rgba(255,182,209,0) 23%),' +
      // 天空 → 遠景 → 地面
      'linear-gradient(180deg,#a7d8f0 0%,#cfe9f6 28%,#e6eff1 48%,#d3cdbf 53%,#b6ad9e 68%,#9b9183 100%)'
  },
  title: {
    label: '標題畫面',
    fallback:
      'radial-gradient(circle at 22% 40%, rgba(255,170,205,.95) 0 22%, rgba(255,170,205,0) 52%),' +
      'linear-gradient(180deg,#f79a86 0%,#f7bfa6 26%,#f0c6d2 50%,#d9b8c6 72%,#a08e9c 100%)'
  },
  topofsakura: {
    label: '櫻花長坡頂端・朝陽',
    fallback:
      'radial-gradient(circle at 50% 78%, rgba(255,220,170,.9) 0 18%, rgba(255,220,170,0) 46%),' +
      'linear-gradient(180deg,#ffb87a 0%,#ffd0a0 30%,#f4c9cf 52%,#d8bcc4 70%,#a89aa0 100%)'
  },
  finalendingscene: {
    label: '結尾 CG・並肩走上坡道',
    fallback:
      'linear-gradient(180deg,#f8a97e 0%,#f7c8a6 28%,#efc3cd 52%,#d0b2bd 74%,#9d8f97 100%)'
  },
  sakuramoring: {
    label: '櫻花長坡・清晨',
    fallback:
      'radial-gradient(circle at 18% 22%, rgba(255,170,205,.95) 0 20%, rgba(255,170,205,0) 46%),' +
      'linear-gradient(180deg,#5c86c9 0%,#9db6e0 26%,#e7c7cf 46%,#d9c3cd 58%,#9a93a6 72%,#7b7686 100%)'
  },
  classroom_evening: {
    label: '舊校舍教室・傍晚',
    fallback:
      'radial-gradient(ellipse 60% 80% at 88% 30%, rgba(255,190,120,.75), rgba(255,190,120,0) 70%),' +
      'linear-gradient(180deg,#6b5340 0%,#8d6b4e 30%,#b08a63 55%,#8a6a4c 78%,#5f4834 100%)'
  },
  courtyard_noon: {
    label: '中庭長椅・午休',
    fallback:
      'radial-gradient(circle at 22% 12%, rgba(255,186,212,.9) 0 16%, rgba(255,186,212,0) 40%),' +
      'radial-gradient(circle at 76% 22%, rgba(255,200,222,.7) 0 11%, rgba(255,200,222,0) 30%),' +
      'linear-gradient(180deg,#a9dcf2 0%,#dfeef7 30%,#e9e6e0 52%,#bfcaa4 62%,#9db184 80%,#8a9c74 100%)'
  }
};

/* ---------- 音樂（檔案還沒有也不會壞，只是沒聲音） ---------- */

var BGM_DIR = 'assets/bgm/';

/* 讓劇本裡不同的音樂名稱共用同一個檔案。
   除了檔案只要放一份，更重要的是：兩幕之間如果是同一個檔案，
   音樂會接著播下去，不會從頭重來。 */
var BGM_ALIAS = {
  warm_daily:     'quiet_afternoon',  // 「溫馨的日常」＝「安靜的午後」
  gentle_miracle: 'sunset_memory',    // 「溫柔的奇蹟」＝「夕陽色的回憶」
  warm_light:     'sunset_memory',    // 「溫暖的光」　＝「夕陽色的回憶」

  // 第 5 幕之後都用「糰子大家族」。玩家如果是走第 4 幕 C 過來的，
  // 因為解析後是同一個檔案，音樂會直接延續下去、不會重播。
  sakura_slope:     'dango_family',   // 「櫻花飛舞的坡道」
  hikarizaka_slope: 'dango_family'    // 「光坂高校的坡道」
};

/* ---------- 劇本本體 ---------- */

var STORY = {

  start: 'title_screen',

  scenes: {

    /* ===================================================================
       標題畫面。duration: 0 代表不自動前進，等玩家點畫面。
       這一下點擊同時也解除瀏覽器的自動播放限制，音樂才會響。
       =================================================================== */
    title_screen: {
      type: 'card',
      bg: 'title',
      bgm: 'spring_wind',
      text: '點擊開始遊戲',
      align: 'bottom',
      pulse: true,
      duration: 0,
      next: 'explore_gate'
    },

    /* ===================================================================
       第 0 幕：探索階段 — 集滿 3 顆光玉才會進入對話劇情
       =================================================================== */
    explore_gate: {
      type: 'explore',
      bg: 'school_gate_spring',
      bgm: 'spring_wind',
      sakura: 34,                                   // 常駐飄落的花瓣數量

      // 全身立繪。height/bottom 讓她站在背景的人行道上，x 是水平中心。
      // 她一開口說話會自動換成半身表情，說完再變回這張。
      char: {
        id: 'heroine',
        image: 'assets/characters/heroine/pose_bag.png',
        height: 560, bottom: 120, x: 72
      },

      intro: [
        { who: 'narration', text: '四月的風裡，還留著一點冬天沒帶走的涼意。' },
        { who: 'narration', text: '我在校門口停下腳步——\n不是因為遲到，是因為那個站在櫻花樹下、一動也不動的女生。' },
        { who: 'narration', text: '離上課還有一點時間。\n……再看一下下好了。' }
      ],

      hint: '點擊畫面中發光的地方',
      requiredOrbs: 3,

      hotspots: [
        {
          id: 'sakura_branch',
          label: '飄落的櫻花枝',
          // 直接對準背景圖左側那片櫻花樹冠（座標是畫面寬高的百分比）
          x: 1, y: 12, w: 14, h: 28,
          effect: 'petalStorm',
          repeatable: true,                          // 這個可以一直點，純粹好看
          lines: [
            { who: 'narration', text: '一陣風掃過樹梢，花瓣整片整片地捲了下來。' },
            { who: 'narration', text: '漫天櫻花下，時間彷彿停滯了……' }
          ]
        },
        {
          id: 'paper_bag',
          label: '少女胸前的紙袋',
          // 對準立繪上她抱著的那個紙袋
          x: 68.5, y: 25, w: 6.5, h: 17,
          orb: true,
          lines: [
            { who: 'narration', text: '她雙手抱著一個紙袋，抱得很緊，像是怕誰搶走。' },
            { who: 'hero', face: 'smile', text: '「那個……你手上拿的是？」' },
            { who: 'heroine', face: 'shy', text: '「……！裡、裡面是紅豆麵包。」' },
            { who: 'heroine', face: 'flustered', text: '「能給我勇氣的食物。」' },
            { who: 'narration', text: '她說完就把紙袋抱得更緊了。' }
          ]
        },
        {
          id: 'graffiti',
          label: '圍牆邊的塗鴉',
          // 對準背景圖上那面畫著糰子大家族的看板
          x: 16, y: 43, w: 22, h: 27,
          effect: 'glow',
          orb: true,
          lines: [
            { who: 'narration', text: '圍牆的角落，有人用粉筆畫了一排圓滾滾的東西。' },
            { who: 'narration', text: '這是……糰子大家族的圖案？' },
            { who: 'narration', text: '畫得歪歪扭扭的，卻擠在一起笑得很開心。' }
          ]
        },
        {
          // 彩蛋：不給光玉、不影響通關，也不會發光。
          // 玩家要自己注意到看板上多了一隻貓才找得到。
          id: 'secret_cat',
          label: '看板上的貓',
          secret: true,
          repeatable: true,
          // 貓的比例是 359x420，寬 9% 換算出來高 18.7%，
          // y 取 25.8% 讓牠的腳底剛好落在看板上緣（約 44.5%）
          x: 19.3, y: 25.8, w: 9, h: 18.7,
          image: 'cat.png',
          imageBox: { x: 19.3, y: 25.8, w: 9 },
          layer: 'back',
          lines: [
            { who: 'narration', text: '糰子看板的上面，蹲著一隻打扮得莫名隆重的貓。' },
            { who: 'hero',    face: 'confused',  text: '「……這隻貓好像在哪裡見過。」' },
            { who: 'heroine', face: 'surprised', text: '「啊，牠住在這附近喔。大家都叫牠糰子貓。」' },
            { who: 'heroine', face: 'awkward',   text: '「上次牠把我的紅豆麵包叼走了一半……」' },
            { who: 'hero',    face: 'deadpan',   text: '「所以妳今天才帶了一整袋？」' },
            { who: 'heroine', face: 'flustered', text: '「那、那是兩件不同的事情！」' },
            { who: 'narration', text: '貓伸了個懶腰，一副事不關己的樣子。' }
          ]
        },
        {
          id: 'the_girl',
          label: '沉思的少女',
          // 蓋在立繪的臉上
          x: 69.5, y: 11.5, w: 6, h: 12.5,
          orb: true,
          lines: [
            { who: 'narration', text: '她一直望著校門裡面，卻沒有踏進去。' },
            { who: 'hero', face: 'nervous', text: '「……你不進去嗎？」' },
            { who: 'heroine', face: 'surprised', text: '「！」' },
            { who: 'heroine', face: 'awkward', text: '「……嗯。再一下下就好。」' },
            { who: 'heroine', face: 'sad', text: '「等我把今天要說的話，在心裡練完。」' }
          ]
        }
      ],

      // 集滿之後放的話，然後跳到 next
      outro: [
        { who: 'narration', text: '三件零零碎碎的小事，在心裡串成了一條線。' },
        { who: 'narration', text: '我好像，稍微看懂了她一點。' }
      ],
      next: 'act1_courtyard'
    },

    /* ===================================================================
       第 1 幕：落櫻的中庭
       =================================================================== */
    act1_courtyard: {
      type: 'dialogue',
      bg: 'courtyard_noon',
      bgm: 'quiet_afternoon',
      sakura: 26,
      // 這一幕她是「坐在長椅上」，但目前只有站姿的全身立繪，
      // 放上去會和台詞矛盾，所以整幕都用半身像（看不到腿就沒這個問題）。
      // 之後如果生了一張坐姿的全身圖，再換成 image 那種寫法就好。
      char: { id: 'heroine', face: 'sad', pos: 'right' },
      lines: [
        { who: 'narration', text: '午休時的中庭很安靜，風一吹，櫻花花瓣就落得滿地都是。' },
        { who: 'narration', text: '早上校門口那個怯生生的女生正獨自坐在長椅上，捧著早上的紙袋發呆。' },
        { who: 'hero',    face: 'smile',     text: '「這裡有人坐嗎？」' },
        { who: 'heroine', face: 'surprised', text: '「啊……！沒、沒有的，請坐。」' },
        { who: 'narration', text: '她有些慌張地挪了挪位置，小心翼翼地把紙袋抱在胸前。' },
        { who: 'heroine', face: 'shy',   text: '「那個……早上謝謝你叫住我。」' },
        { who: 'hero',    face: 'smile', text: '「我好像還沒有自我介紹，我叫昱岑。」' },
        { who: 'heroine', face: 'smile', text: '「昱岑同學也是一個人吃午餐嗎？如果不嫌棄的話……這個分你一半。」' },
        { who: 'narration', text: '孟格從紙袋裡拿出那個紅豆麵包，輕輕掰開了一半遞過來。' }
      ],
      choices: [
        { text: '開心地接過來並道謝',     goto: 'act2a_bread', affection: 2 },
        { text: '說自己不餓但陪她聊天',   goto: 'act2b_bench', affection: 1 },
        { text: '我要吃旭集',             goto: 'act2c_fail',  affection: 0 }
      ]
    },

    /* ===================================================================
       第 2 幕：三條分歧
       =================================================================== */
    act2a_bread: {
      type: 'dialogue',
      bg: 'courtyard_noon',
      bgm: 'warm_daily',
      sakura: 26,
      lines: [
        { who: 'hero',    face: 'laugh',        text: '「謝謝，正好肚子有點餓了。」' },
        { who: 'heroine', face: 'laugh',        text: '「太好了……！其實我休學了一年，以前的同班同學都畢業了。」' },
        { who: 'heroine', face: 'disappointed', text: '「在班上總覺得格格不入……只要一緊張，我就會想吃紅豆麵包。」' },
        { who: 'hero',    face: 'shy',          text: '「沒事的，只要慢慢習慣就好了。」' },
        { who: 'heroine', face: 'smile',        text: '「嗯！聽昱岑同學這麼說，我好像又有勇氣了。」' }
      ],
      next: 'act3_classroom'
    },

    act2b_bench: {
      type: 'dialogue',
      bg: 'courtyard_noon',
      bgm: 'warm_daily',
      sakura: 26,
      lines: [
        { who: 'hero',    face: 'smile',        text: '「妳自己吃吧，我陪妳聊聊天就好。」' },
        { who: 'heroine', face: 'shy',          text: '「昱岑同學真是溫柔的人呢。」' },
        { who: 'heroine', face: 'disappointed', text: '「其實……我因為身體不好休學了一年。今天回到學校，發現身邊全是不認識的人，稍微有點害怕。」' },
        { who: 'hero',    face: 'smile',        text: '「這很正常，換成誰都會害怕的。」' },
        { who: 'heroine', face: 'smile',        text: '「謝謝你聽我說這些，心情放鬆多了。」' }
      ],
      next: 'act3_classroom'
    },

    act2c_fail: {
      type: 'dialogue',
      bg: 'courtyard_noon',
      bgm: 'warm_daily',
      sakura: 26,
      lines: [
        { who: 'hero',    face: 'thinking', text: '「午餐只吃這個，下午會肚子餓吧？」' },
        { who: 'hero',    face: 'crying',   text: '「我好想吃旭集喔！」' },
        { who: 'heroine', face: 'angry',    text: '「攻殺小，欠揍是不是？？」' }
      ],
      next: 'ending_fail'
    },

    /* ===================================================================
       結局
       =================================================================== */
    ending_fail: {
      type: 'dialogue',
      bgm: 'ending_fail',
      clearChars: true,
      lines: [
        { who: 'narration', text: '—— 挑戰失敗 ——' },
        { who: 'narration', text: '有些話，說出口之前最好先想三秒。' }
      ],
      choices: [
        { text: '回到中庭重選一次', goto: 'act1_courtyard', affection: 0 }
      ]
    },

    /* ===================================================================
       第 3 幕：黃昏的空教室
       =================================================================== */
    act3_classroom: {
      type: 'dialogue',
      bg: 'classroom_evening',
      bgm: 'sunset_memory',
      // 黑板在畫面左側，她站在黑板前，男主從右邊探頭進來
      positions: { heroine: 'left', hero: 'right' },
      char: { id: 'heroine', face: 'shy' },
      lines: [
        { who: 'narration', text: '放學後的舊校舍染上了一層橘紅色的夕陽。' },
        { who: 'narration', text: '路過空教室時，我看見孟格正站在黑板前，笨拙地畫著一個圓滾滾的圖案。' },
        { who: 'heroine', face: 'shy',       text: '「啊，昱岑同學！我、我在想重新建立演劇部的事情……」' },
        { who: 'hero',    face: 'surprised', text: '「演劇部？」' },
        { who: 'heroine', face: 'shy',       text: '「嗯！雖然以前的部員都畢業了，但我還是想試試看。只是……不知道會不會有人想加入。」' },
        { who: 'heroine', face: 'shy',       text: '「那個……昱岑同學，你覺得像我這樣的人，能做到嗎？」' }
      ],
      choices: [
        { text: '一定沒問題，我也會幫妳',       goto: 'act4a_promise',   affection: 2 },
        { text: '雖然很難，但試試看也不錯',     goto: 'act4b_firststep', affection: 1 },
        { text: '指著黑板問「這是糰子嗎」',     goto: 'act4c_dango',     affection: 2 }
      ]
    },

    /* ===================================================================
       第 4 幕：三條分歧
       =================================================================== */
    act4a_promise: {
      type: 'dialogue',
      bg: 'classroom_evening',
      bgm: 'gentle_miracle',
      positions: { heroine: 'left', hero: 'right' },
      lines: [
        { who: 'hero',    face: 'smirk',     text: '「一定沒問題的，如果需要幫忙，我也算上一份。」' },
        { who: 'heroine', face: 'surprised', text: '「真、真的嗎？！太感謝你了……！」' },
        { who: 'heroine', face: 'laugh',     text: '「今天能遇見昱岑同學，真的太好了……」' },
        { who: 'narration', text: '夕陽照在她的笑臉上，顯得格外耀眼。' }
      ],
      next: 'act5_slope'
    },

    act4b_firststep: {
      type: 'dialogue',
      bg: 'classroom_evening',
      bgm: 'warm_light',
      positions: { heroine: 'left', hero: 'right' },
      lines: [
        { who: 'hero',    face: 'smile', text: '「雖然不容易，但不踏出第一步的話什麼都不會開始。」' },
        { who: 'heroine', face: 'smile', text: '「嗯！昱岑同學說得對。哪怕只有我一個人，我也想努力看看。」' },
        { who: 'heroine', face: 'shy',   text: '「只要有人願意看著我，我就不會放棄。」' }
      ],
      next: 'act5_slope'
    },

    act4c_dango: {
      type: 'dialogue',
      bg: 'classroom_evening',
      bgm: 'dango_family',
      positions: { heroine: 'left', hero: 'right' },
      lines: [
        { who: 'hero',    face: 'smile',     text: '「比起演劇部，黑板上畫的這是一大群糰子吧？」' },
        { who: 'heroine', face: 'surprised', text: '「昱岑同學也知道《糰子大家族》嗎？！」' },
        // 「興奮」沒有對應的表情素材，用最接近的「開懷大笑」
        { who: 'heroine', face: 'laugh',     text: '「大糰子、小糰子……只要聚在一起就是最幸福的家族喔！」' },
        { who: 'narration', text: '她興高采烈地哼起歌來，原本沉悶的空教室瞬間充滿了歡笑聲。' }
      ],
      next: 'act5_slope'
    },

    /* ===================================================================
       第 5 幕：櫻花飛舞的坡道
       =================================================================== */
    act5_slope: {
      type: 'dialogue',
      bg: 'sakuramoring',
      bgm: 'sakura_slope',
      sakura: 46,
      char: { id: 'heroine', face: 'shy' },
      lines: [
        { who: 'narration', text: '隔天清晨，陽光灑滿了通往學校的漫長坡道。' },
        { who: 'narration', text: '無數櫻花花瓣在微風中捲起，形成一陣絢爛的花瓣雨。', effect: 'petalStorm' },
        { who: 'narration', text: '孟格正站在坡道的最底端，仰望著望不到盡頭的長坡。' },
        { who: 'heroine', face: 'shy',          text: '「昱岑同學……早安。」' },
        { who: 'hero',    face: 'smile',        text: '「早啊，今天也在這裡發呆？」' },
        { who: 'heroine', face: 'disappointed', text: '「這所學校……你喜歡嗎？我很喜歡……但是，所有的一切，都無法一直保持不變。」' },
        { who: 'heroine', face: 'disappointed', text: '「快樂的事、開心的回憶，總有一天都會改變……就算這樣，也能繼續往前走嗎？」' }
      ],
      choices: [
        { text: '只要去尋找下一個快樂的事就好了', goto: 'act6a_tomorrow', affection: 2 },
        { text: '別害怕，我會一直在妳身邊',       goto: 'act6b_together', affection: 2 },
        { text: '牽起她的手直接邁步',             goto: 'act6c_hand',     affection: 3 }
      ]
    },

    /* ===================================================================
       第 6 幕：三條分歧
       =================================================================== */
    act6a_tomorrow: {
      type: 'dialogue',
      bg: 'sakuramoring',
      bgm: 'hikarizaka_slope',
      sakura: 46,
      lines: [
        { who: 'hero',    face: 'smile', text: '「只要去找到下一個快樂的事就好了吧？無論如何改變，我們一起去找新的回憶。」' },
        { who: 'heroine', face: 'shy',   text: '「下一個……快樂的事……」' },
        { who: 'heroine', face: 'smile', text: '「嗯！有昱岑同學這句話，我就不再害怕了。」' }
      ],
      next: 'card_begins'
    },

    act6b_together: {
      type: 'dialogue',
      bg: 'sakuramoring',
      bgm: 'hikarizaka_slope',
      sakura: 46,
      lines: [
        { who: 'hero',    face: 'smile', text: '「就算一切都會改變，我也會一直在這裡陪妳走上去。」' },
        { who: 'heroine', face: 'laugh', text: '「昱岑同學……」' },
        { who: 'heroine', face: 'shy',   text: '「謝謝你……這是我聽過最安心的話了。」' }
      ],
      next: 'card_begins'
    },

    act6c_hand: {
      type: 'dialogue',
      bg: 'sakuramoring',
      bgm: 'hikarizaka_slope',
      sakura: 46,
      lines: [
        { who: 'narration', text: '我沒有多說什麼，只是輕輕握住了她微微發顫的手。' },
        { who: 'heroine', face: 'flustered', text: '「啊……林昱岑？！」' },
        { who: 'hero',    face: 'smile',     text: '「走吧，兩個人一起走的話，坡道就沒那麼長了。」' },
        { who: 'heroine', face: 'shy',       text: '「……嗯！手好溫暖。」' }
      ],
      next: 'card_begins'
    },

    /* ===================================================================
       第 7 幕：我們的故事由此開始
       這三幕都不指定 bgm，音樂就會從第 5、6 幕一路接著播下去。
       =================================================================== */

    // 黑幕字卡，三秒後自動進場（點畫面可以提早跳過）
    card_begins: {
      type: 'card',
      text: '我們的故事由此開始',
      duration: 3000,
      next: 'act7_top'
    },

    act7_top: {
      type: 'dialogue',
      bg: 'topofsakura',
      sakura: 52,
      char: { id: 'heroine', face: 'smile' },
      lines: [
        { who: 'narration', text: '一陣強風拂過，整條坡道的櫻花漫天飛舞，宛如祝福的雨絲。', effect: 'petalStorm' },
        {
          who: 'heroine', text: '「那麼……我們一起走吧！」',
          // 轉身微笑的全身姿勢圖。檔案還沒放進來的話會自動退回微笑的半身圖。
          image: 'assets/characters/heroine/pose_turn.png',
          face: 'smile', height: 600, bottom: 60, x: 70
        },
        { who: 'narration', text: '她邁出了停滯已久的腳步，與我並肩走上了這條長長的坡道。' },
        { who: 'narration', text: '坡道的頂端是滿開的櫻花與明亮的校舍，而我們的故事，才剛剛開始——' }
      ],
      next: 'card_end'
    },

    // 結尾 CG。沒有 next，停在這裡收尾。
    card_end: {
      type: 'card',
      bg: 'finalendingscene',
      text: 'TO BE CONTINUED...',
      align: 'bottom',
      sakura: 30
    }
  }
};
