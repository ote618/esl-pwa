/**
 * SÚPER SONIDOS — the game, as delivered.
 *
 * Everything below the WRAPPER block is the original standalone script, ported
 * verbatim. Content, physics constants, level recipes and sprites are locked:
 * this file exists to give that script a mount point and an off switch, not to
 * change what it does. Five seams were opened, and only five:
 *
 *   1. TEST / SHOW_TAIL read `location` in the standalone file. They are props
 *      now, so one build can serve both the child-facing route and the test
 *      route without the URL deciding behaviour behind React's back.
 *   2. Clip URLs. The standalone file guessed `{ENTRY-ID}_{part}.mp3`. The real
 *      files carry a descriptive tail — LTR-A-NAME_sound__A_name.mp3 — so that
 *      guess 404s on every clip and the game falls back to browser speech for
 *      all of Set 1. clipUrl() asks the registry, which knows the filenames,
 *      and keeps the original guess for entries the registry does not carry
 *      (sets 7-12, which have no recordings yet).
 *   3. getElementById -> $, scoped to the mounted root, so nothing reaches
 *      across into the rest of the app.
 *   4. Window and document listeners are tracked, and setTimeout is wrapped,
 *      so unmount leaves nothing running.
 *   5. The rAF loop is cancellable.
 *
 * Nothing else was touched.
 */

import { clip } from '../../lib/audio.js'

export function startSuperSonidos (root, { testMode = false, showTail = false } = {}) {
  /* ---------- WRAPPER ---------- */
  let stopped = false
  let raf = 0

  const $ = id => root.querySelector('#' + id)

  const winListeners = []
  const docListeners = []
  const onWin = (type, fn, opts) => { window.addEventListener(type, fn, opts); winListeners.push([type, fn, opts]) }
  const onDoc = (type, fn, opts) => { document.addEventListener(type, fn, opts); docListeners.push([type, fn, opts]) }
  const offDoc = (type, fn) => document.removeEventListener(type, fn)

  // A pending "say the next round" must not fire into a screen the child has
  // already left. Shadowing setTimeout catches every call site at once.
  const timers = new Set()
  const setTimeout = (fn, ms) => {
    const id = window.setTimeout(() => { timers.delete(id); if (!stopped) fn() }, ms)
    timers.add(id)
    return id
  }

  /**
   * The URL for one clip, or the standalone file's guess when the registry has
   * no entry for that id — sets 7-12 are unrecorded, and their rounds are meant
   * to fall through to speech.
   */
  const clipUrl = (id, part, setN) =>
    clip(id, part) || ('/audio/group' + setN + '/' + id + '_' + part + '.mp3')

  /* ---------- THE GAME, AS DELIVERED ---------- */
  /* =====================================================================
     SÚPER SONIDOS — 12 sets × 5 levels, 60 fixed maps, driven by the curriculum registry.
     Section 1: CONTENT (mirrors the Group recording lists + tail units)
     Section 2: LEVEL LADDER (type + difficulty per level, seeded)
     Section 3: ENGINE
     ===================================================================== */

  /* ---------- 1. CONTENT ---------- */
  // Letter names in Spanish orthography (no IPA anywhere)
  const NAME={A:'ei',B:'bi',C:'si',D:'di',E:'i',F:'ef',G:'yi',H:'eich',I:'ai',J:'yei',K:'kei',L:'el',
   M:'em',N:'en',O:'ou',P:'pi',Q:'kiu',R:'ar',S:'es',T:'ti',U:'iu',V:'vi',W:'dabol iu',X:'eks',Y:'uai',Z:'zi'};

  // Sounds per letter: guide + example words, from the recording lists
  const SOUND={
   A:[{s:'a',w:['apple','ant']},{s:'ei',w:['angel','ape']}],
   B:[{s:'b',w:['banana','ball']}],
   C:[{s:'k',w:['color','cat']},{s:'s',w:['cell','city']}],
   D:[{s:'d',w:['doctor','dog']}],
   E:[{s:'e',w:['elephant','elbow']},{s:'i',w:['eat','eagle']}],
   F:[{s:'f',w:['flower','face']}],
   G:[{s:'g',w:['gorilla','goat']},{s:'y',w:['giant','giraffe']}],
   H:[{s:'j',w:['hotel','human']}],
   I:[{s:'i',w:['insect','igloo']},{s:'ai',w:['island','ice']}],
   J:[{s:'y',w:['juice','jump']}],
   K:[{s:'k',w:['kilo','key']}],
   L:[{s:'l',w:['lion','leaf']}],
   M:[{s:'m',w:['mango','moon']}],
   N:[{s:'n',w:['note','nose']}],
   O:[{s:'o',w:['octopus','office']},{s:'ou',w:['ocean','open']}],
   P:[{s:'p',w:['piano','pig']}],
   Q:[{s:'ku',w:['quick','question']}],
   R:[{s:'r',w:['radio','rain']}],
   S:[{s:'s',w:['sofa','submarine']},{s:'z',w:['is','has']}],
   T:[{s:'t',w:['tomato','table']}],
   U:[{s:'a',w:['uncle','umbrella']},{s:'iu',w:['uniform','unicorn']}],
   V:[{s:'v',w:['violin','volleyball']}],
   W:[{s:'u',w:['water','window']}],
   X:[{s:'ks',w:['box','fox']}],
   Y:[{s:'y',w:['yellow','yogurt']}],
   Z:[{s:'z',w:['zebra','zoo']}]
  };

  // CV syllables per letter with an anchor word each (recording lists)
  const CV={
   B:{ba:'bat',be:'bed',bi:'big',bo:'bot',bu:'bus'},
   C:{ca:'cat',ce:'cell',ci:'city',co:'color',cu:'cup'},
   D:{da:'dad',de:'desk',di:'dig',do:'dog',du:'duck'},
   F:{fa:'fan',fe:'fence',fi:'fish',fo:'fog',fu:'fun'},
   G:{ga:'gas',ge:'gem',gi:'ginger',go:'golf',gu:'gum'},
   H:{ha:'hat',he:'hen',hi:'hit',ho:'hot',hu:'hug'},
   J:{ja:'jam',je:'jet',ji:'jigsaw',jo:'jog',ju:'jug'},
   K:{ke:'kettle',ki:'kid'},
   L:{la:'lamp',le:'leg',li:'lip',lo:'lock',lu:'lunch'},
   M:{ma:'map',me:'melon',mi:'milk',mo:'mop',mu:'mud'},
   N:{na:'nap',ne:'nest',ni:'ninja',no:'not',nu:'nut'},
   P:{pa:'pan',pe:'pen',pi:'pig',po:'pot',pu:'puppy'},
   Q:{qu:'queen'},
   R:{ra:'rabbit',re:'red',ri:'ring',ro:'rock',ru:'run'},
   S:{sa:'sand',se:'seven',si:'sister',so:'sock',su:'sun'},
   T:{ta:'tap',te:'ten',ti:'ticket',to:'top',tu:'tub'},
   V:{va:'van',ve:'vest'},
   W:{wa:'wagon',we:'wet',wi:'wind',wo:'won'},
   Y:{ya:'yak',ye:'yes',yu:'young'},
   Z:{zi:'zip'}
  };
  // vowel-led combinations (A E I O U rows)
  const VC={A:{at:'',an:'',am:''},E:{egg:''},I:{in:'',it:'',if:''},O:{on:'',ox:''},U:{up:'',us:''}};

  const DIGRAPH=[
   {L:'CH',s:'ch',w:['chair','cheese']},{L:'SH',s:'sh',w:['ship','shoe']},
   {L:'TH',s:'z (lengua fuera)',w:['think','three']},{L:'TH',s:'d (lengua fuera)',w:['this','that']},
   {L:'WH',s:'u',w:['what','when']},{L:'PH',s:'f',w:['phone','photo']},{L:'NG',s:'ng',w:['ring','sing']}];

  const RIME=[{r:'at',w:['bat','cat','hat','mat','rat','sat']},{r:'an',w:['can','fan','man','pan','ran','van']},
   {r:'am',w:['jam','ham','ram','yam']},{r:'in',w:['bin','fin','pin','tin','win']},{r:'it',w:['bit','fit','hit','kit','sit']},
   {r:'on',w:['on','son','ton']},{r:'ox',w:['box','fox','ox']},{r:'up',w:['cup','pup','up']},{r:'ug',w:['bug','hug','jug','mug','rug']},
   {r:'op',w:['hop','mop','pop','top']},{r:'ig',w:['big','dig','fig','pig','wig']},{r:'en',w:['hen','men','pen','ten']},
   {r:'ot',w:['dot','hot','not','pot']},{r:'ed',w:['bed','fed','red','wed']}];

  const CVC=['bat','cat','hat','sat','dog','big','bus','cup','pen','ten','sun','red','hot','pig','fox','box','mud','hug','nut','top','pot','wet','zip','man','bed','fan','jam','kid','leg','map','net','pan','rug','six','tub','van','web','yak','zoo'];
  const CVV=[{w:'bee',g:'bii'},{w:'see',g:'sii'},{w:'tree',g:'trii'},{w:'feet',g:'fiit'},{w:'rain',g:'rein'},{w:'boat',g:'bout'},
   {w:'moon',g:'muun'},{w:'seed',g:'siid'},{w:'sail',g:'seil'},{w:'team',g:'tiim'},{w:'road',g:'roud'},{w:'food',g:'fuud'},{w:'meat',g:'miit'},{w:'coat',g:'cout'}];
  const BLEND=['stop','plan','hand','milk','frog','drum','flag','jump','desk','nest','crab','spin','swim','glad','trip','belt','clap','slip','grab','tent'];
  const RCTRL=[{w:'car',g:'car'},{w:'bird',g:'berd'},{w:'her',g:'jer'},{w:'farm',g:'farm'},{w:'corn',g:'corn'},{w:'fork',g:'fork'},{w:'star',g:'star'},
   {w:'park',g:'park'},{w:'fern',g:'fern'},{w:'girl',g:'guerl'},{w:'hurt',g:'jert'},{w:'turn',g:'tern'},{w:'barn',g:'barn'},{w:'shark',g:'shark'}];

  /* ---------- 2. THE SETS AND THE LADDER ---------- */
  const SETS=[
   {n:1,title:'A B C D',sub:'Grupo 1',kind:'group',L:['A','B','C','D']},
   {n:2,title:'E F G H',sub:'Grupo 2 · la G es difícil',kind:'group',L:['E','F','G','H']},
   {n:3,title:'I J K L',sub:'Grupo 3',kind:'group',L:['I','J','K','L']},
   {n:4,title:'M N O P',sub:'Grupo 4',kind:'group',L:['M','N','O','P']},
   {n:5,title:'Q R S T',sub:'Grupo 5 · la S que suena z',kind:'group',L:['Q','R','S','T']},
   {n:6,title:'U V W X Y Z',sub:'Grupos 6+7 · la V · fin del abecedario',kind:'group',L:['U','V','W','X','Y','Z']},
   {n:7,title:'CH SH TH WH PH NG',sub:'Grupo 8 · dos letras, un sonido',kind:'digraph',tail:1},
   {n:8,title:'Familias',sub:'Unidad 9 · rimas -at -in -op',kind:'rime',tail:1},
   {n:9,title:'Palabras',sub:'Unidad 10 · CVC',kind:'cvc',tail:1},
   {n:10,title:'Dos vocales',sub:'Unidad 11 · CVV',kind:'cvv',tail:1},
   {n:11,title:'Combinaciones',sub:'Unidad 12 · st pl fr',kind:'blend',tail:1},
   {n:12,title:'Vocal + R',sub:'Unidad 13 · car bird her',kind:'rctrl',tail:1}
  ];
  const TEST = !!testMode;
  const SHOW_TAIL = !!showTail;
  const VISIBLE_SETS = SETS.filter(x=>!x.tail || SHOW_TAIL);
  // Level type ladder per set kind. round counts rise with the level.
  const LADDER={
   group:  [['name',4],['sound',5],['cv',6],['first',6],['boss',8]],
   digraph:[['dname',4],['dsound',5],['dsound',6],['dfirst',6],['boss',8]],
   rime:   [['rime',4],['rword',5],['ronset',6],['ronset',7],['boss',8]],
   cvc:    [['word',4],['build',2],['mid',6],['end',6],['boss',8]],
   cvv:    [['word',4],['build',2],['mid',6],['word',7],['boss',8]],
   blend:  [['word',4],['build',2],['bstart',6],['end',7],['boss',8]],
   rctrl:  [['word',4],['build',2],['mid',6],['end',7],['boss',8]]
  };

  /* ---------- VENUES: one look per set ---------- */
  const VENUE=[
   {sky:['#7FD8F3','#5EC7EC'],hill:'#4CAE72',bush:'#3E9E5C',grass:'#3E9E5C',dirt:'#C98A45',dirt2:'#A76F33',back:'fence'},
   {sky:['#8ED7F0','#6CC4E8'],hill:'#5FB27A',bush:'#4A9E62',grass:'#56B36A',dirt:'#B9B9B9',dirt2:'#8E8E8E',back:'school'},
   {sky:['#9EDDF5','#71C8EC'],hill:'#3F9C5F',bush:'#2E7D4F',grass:'#49A85E',dirt:'#8B5E34',dirt2:'#6B4424',back:'trees'},
   {sky:['#FFD9A0','#F7B96A'],hill:'#C98A45',bush:'#B5562E',grass:'#C9A15C',dirt:'#A0714A',dirt2:'#7B5233',back:'stalls'},
   {sky:['#1E2F5A','#2F4A86'],hill:'#2C5E3F',bush:'#25753F',grass:'#3E9E5C',dirt:'#5A6B7E',dirt2:'#3D4A5A',back:'stands'},
   {sky:['#A9E4F7','#7FD8F3'],hill:'#6FD1E8',bush:'#F1D9A0',grass:'#F1D9A0',dirt:'#E1C48A',dirt2:'#C9A96A',back:'beach'},
   {sky:['#0E1330','#232A5E'],hill:'#2B2F55',bush:'#3A3F70',grass:'#555B80',dirt:'#3A3F5A',dirt2:'#24283D',back:'city'},
   {sky:['#8A8F9A','#B7BBC4'],hill:'#6E7480',bush:'#5A606C',grass:'#7A8090',dirt:'#5E6470',dirt2:'#444955',back:'factory'},
   {sky:['#6FC3F5','#4FA9E0'],hill:'#2E7D4F',bush:'#256640',grass:'#2E9E5C',dirt:'#C98A45',dirt2:'#A76F33',back:'stadium'},
   {sky:['#B9E8F7','#8FD3EE'],hill:'#4CAE72',bush:'#3E9E5C',grass:'#4CAE72',dirt:'#9AA59C',dirt2:'#6E7A70',back:'river'},
   {sky:['#D9C9B0','#B9A27F'],hill:'#8E6F4E',bush:'#6E5238',grass:'#7A8A5A',dirt:'#6B5B4B',dirt2:'#4D4136',back:'train'},
   {sky:['#3A2A0A','#7A5A1A'],hill:'#8A6A20',bush:'#B8891F',grass:'#3E9E5C',dirt:'#B8891F',dirt2:'#8A6A20',back:'cup'}
  ];

  /* ---------- THE 60 MAPS: one recipe per level ----------
     segs = the fixed sequence of segment templates; the level's rounds walk it in order.
     f = per-level flags (wind, flash, keepers, star, fast, low ceiling …)             */
  const LEVELS=[
   [ {nm:'Primer toque',segs:['flat','flat','flat','flat'],f:{}},
     {nm:'El muro',segs:['wall','pipe','shelf','wall','pipe'],f:{}},
     {nm:'Los conos',segs:['gap2','gapplat','flat','gap2','gapplat','flat'],f:{}},
     {nm:'La banca',segs:['bench','tree','bench','tree','bench','tree'],f:{}},
     {nm:'Jefe del barrio',segs:['wall','pipe','wall','pipe','wall','pipe','wall','pipe'],f:{keep:1,ball:1}} ],
   [ {nm:'El recreo',segs:['wide','wide','wide','wide'],f:{}},
     {nm:'Los columpios',segs:['mover','mover','mover','mover','mover'],f:{}},
     {nm:'El pasillo',segs:['pipetop','pipetop','pipetop','pipetop','pipetop','pipetop'],f:{}},
     {nm:'La G',segs:['corridor','corridor','corridor','corridor','corridor','corridor'],f:{}},
     {nm:'Jefe de la escuela',segs:['maze','maze','maze','maze','maze','maze','maze','maze'],f:{keep:1,ball:1,balldrop:1}} ],
   [ {nm:'El sendero',segs:['bush','bush','bush','bush'],f:{}},
     {nm:'El estanque',segs:['pond','pond','pond','pond','pond'],f:{}},
     {nm:'El quiosco',segs:['kiosk','kiosk','kiosk','kiosk','kiosk','kiosk'],f:{}},
     {nm:'Los árboles',segs:['tree','tree','tree','tree','tree','tree'],f:{}},
     {nm:'Jefe del parque',segs:['pond','gap2','pond','gap2','pond','gap2','pond','gap2'],f:{keep:1,ball:2}} ],
   [ {nm:'Los puestos',segs:['stalls','stalls','stalls','stalls'],f:{}},
     {nm:'El toldo',segs:['awning','awning','awning','awning','awning'],f:{}},
     {nm:'El carrito',segs:['cart','cart','cart','cart','cart','cart'],f:{}},
     {nm:'El callejón',segs:['alley','alley','alley','alley','alley','alley'],f:{}},
     {nm:'Jefe del mercado',segs:['cart','awning','cart','awning','cart','awning','cart','awning'],f:{keep:1,ball:1,def:2}} ],
   [ {nm:'El túnel',segs:['tunnel','flat','tunnel','flat'],f:{}},
     {nm:'Las gradas',segs:['stairs','stairs','stairs','stairs','stairs'],f:{}},
     {nm:'Doble hueco',segs:['gap2','gapplat','gap2','gapplat','gap2','gapplat'],f:{gap2x:1}},
     {nm:'El banquillo',segs:['bench','bench','bench','bench','bench','bench'],f:{benchdef:1}},
     {nm:'Jefe del estadio',segs:['stairs','gap2','stairs','gap2','stairs','gap2','stairs','gap2'],f:{keep:1,ball:1,gap2x:1}} ],
   [ {nm:'La arena',segs:['wide','wide','wide','wide'],f:{def:2}},
     {nm:'Las olas',segs:['waves','waves','waves','waves','waves'],f:{}},
     {nm:'El muelle',segs:['pier','pier','pier','pier','pier','pier'],f:{}},
     {nm:'La V',segs:['corridor','corridor','corridor','corridor','corridor','corridor'],f:{vsb:1}},
     {nm:'Jefe de la playa',segs:['pier','waves','pier','waves','pier','waves','pier','waves'],f:{keep:1,ball:1}} ],
   [ {nm:'Los letreros',segs:['flat','stalls','flat','stalls'],f:{def:2}},
     {nm:'Las azoteas',segs:['roof','roof','roof','roof','roof'],f:{}},
     {nm:'El metro',segs:['tunnel','tunnel','tunnel','tunnel','tunnel','tunnel'],f:{}},
     {nm:'El puente',segs:['bench','bench','bench','bench','bench','bench'],f:{balldrop:1}},
     {nm:'Jefe de la ciudad',segs:['roof','tunnel','roof','tunnel','roof','tunnel','roof','tunnel'],f:{keep:1,ball:2}} ],
   [ {nm:'La cinta',segs:['mover','mover','mover','mover'],f:{}},
     {nm:'La prensa',segs:['press','press','press','press','press'],f:{}},
     {nm:'Doble cinta',segs:['movers2','movers2','movers2','movers2','movers2','movers2'],f:{}},
     {nm:'La bodega',segs:['maze','maze','maze','maze','maze','maze','maze'],f:{}},
     {nm:'Jefe de la fábrica',segs:['mover','press','movers2','maze','mover','press','movers2','maze'],f:{keep:1,ball:1}} ],
   [ {nm:'El césped',segs:['wide','wide','wide','wide'],f:{fast:1}},
     {nm:'Los pasillos',segs:['corridor','corridor','corridor','corridor','corridor','corridor'],f:{def:3}},
     {nm:'Las gradas altas',segs:['tree','stairs','tree','stairs','tree','stairs'],f:{}},
     {nm:'El área',segs:['bench','bench','bench','bench','bench','bench'],f:{benchdef:1,def:3,ball:1}},
     {nm:'Jefe nacional',segs:['tree','corridor','stairs','bench','tree','corridor','stairs','bench'],f:{keep:2,ball:1}} ],
   [ {nm:'La orilla',segs:['gapplat','gapplat','gapplat','gapplat'],f:{}},
     {nm:'El puente de cuerda',segs:['rope','rope','rope','rope','rope','rope'],f:{}},
     {nm:'Las piedras',segs:['stones','stones','stones','stones','stones','stones'],f:{}},
     {nm:'La cascada',segs:['falls','falls','falls','falls','falls','falls','falls'],f:{}},
     {nm:'Jefe del río',segs:['stones','rope','stones','rope','stones','rope','stones','rope'],f:{keep:1,ball:2}} ],
   [ {nm:'El andén',segs:['flat','carriage','flat','carriage'],f:{}},
     {nm:'Los vagones',segs:['carriage','carriage','carriage','carriage','carriage','carriage'],f:{}},
     {nm:'El techo',segs:['bench','bench','bench','bench','bench','bench'],f:{ball:1,balldrop:1}},
     {nm:'El túnel del tren',segs:['ceiling','carriage','ceiling','carriage','ceiling','carriage','ceiling'],f:{}},
     {nm:'Jefe del tren',segs:['carriage','carriage','carriage','carriage','carriage','carriage','carriage','carriage'],f:{keep:1,ball:1,fastmover:1}} ],
   [ {nm:'La entrada',segs:['wide','wide','wide','wide'],f:{fast:1,def:2,ball:1}},
     {nm:'La vuelta olímpica',segs:['stairs','gap2','mover','stairs','gap2','mover'],f:{fast:1}},
     {nm:'El VAR',segs:['flat','shelf','flat','shelf','flat','shelf'],f:{flash:1}},
     {nm:'Los penales',segs:['bench','bench','bench','bench','bench','bench','bench'],f:{benchdef:1,def:4,keepeach:1}},
     {nm:'La final',segs:['stairs','pier','mover','corridor','press','tree','waves','bench'],f:{keep:2,ball:2,star:1,fast:1}} ]
  ];

  // Difficulty by set / level (enemy counts come from the recipe flags now)
  function diff(si,li){
   const g=si*5+li;
   return {
    defenders: 1+(si>=3?1:0)+(li>=3?1:0)+(si>=9?1:0),
    balls: (si>=2&&li>=2)?1:0,
    gaps: (si>=2||li>=2)?1+((si>=5)?1:0):0,
    gapW: si>=8?3:2,
    platforms: li>=2?1:0,
    mover: (si>=4&&li>=2)?1:0,
    keeper: (li===4||si>=10)?1:0,
    speed: 0.36+si*0.025+li*0.03,
    powers: Math.max(0, 2-Math.floor(si/5)),
    timeBonus: si>=6
   };
  }

  /* seeded rng so each level is fixed and repeatable */
  function rng(seed){let s=seed|0||1;return()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return((s>>>0)%100000)/100000;};}
  function pick(r,a){return a[Math.floor(r()*a.length)];}
  function shuf(r,a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
  function others(r,pool,ans,n){const o=shuf(r,pool.filter(x=>x!==ans));return o.slice(0,n);}
  const ALL=Object.keys(NAME);

  // Build the rounds for one level. A round = {say, prompt, options[], answer, word?}
  function makeRounds(set,li,r){
   const [type,count]=LADDER[set.kind][li];
   const rounds=[];
   const gN=x=>{const g=NAME[x]||x;return g;};
   const consonants=ALL.filter(x=>CV[x]);
   const allCV=[];consonants.forEach(c=>Object.keys(CV[c]).forEach(k=>allCV.push(k)));
   const allDig=DIGRAPH.map(d=>d.L).filter((v,i,a)=>a.indexOf(v)===i);

   function addName(L){rounds.push({say:NAME[L],prompt:'¿Cuál letra se llama',options:[L,...others(r,ALL,L,2)],answer:L,clip:{id:'LTR-'+L+'-NAME',part:'sound'}});}
   function addSound(L){const si=Math.floor(r()*SOUND[L].length),so=SOUND[L][si];const pool=set.L||ALL;rounds.push({say:so.s,prompt:'¿Qué letra hace',options:[L,...others(r,pool.length>2?pool:ALL,L,2)],answer:L,clip:{id:'LTR-'+L+'-S'+(si+1),part:'sound'}});}
   function addCV(L){const ks=Object.keys(CV[L]||{});if(!ks.length)return addSound(L);const k=pick(r,ks);
     const pool=allCV.filter(x=>x[0]===k[0]);const dis=pool.length>2?others(r,pool,k,2):others(r,allCV,k,2);
     rounds.push({say:k,prompt:'Encuentra',options:[k.toUpperCase(),...dis.map(x=>x.toUpperCase())],answer:k.toUpperCase(),clip:{id:'U2-'+k.toUpperCase(),part:'sound'}});}
   function addFirst(L){const si=Math.floor(r()*SOUND[L].length),so=SOUND[L][si];const wi=Math.floor(r()*so.w.length),w=so.w[wi];const pool=(set.L&&set.L.length>2)?set.L:ALL;rounds.push({say:w,lang:'en',prompt:'¿Con qué letra empieza',options:[L,...others(r,pool,L,2)],answer:L,show:w,clip:{id:'LTR-'+L+'-S'+(si+1),part:'word'+(wi+1)}});}
   function addDName(){const d=pick(r,DIGRAPH);rounds.push({say:d.L.split('').join(' '),prompt:'¿Cuál es',options:[d.L,...others(r,allDig,d.L,2)],answer:d.L});}
   function addDSound(){const d=pick(r,DIGRAPH);rounds.push({say:d.s,prompt:'¿Qué combinación hace',options:[d.L,...others(r,allDig,d.L,2)],answer:d.L});}
   function addDFirst(){const d=pick(r,DIGRAPH);const w=pick(r,d.w);rounds.push({say:w,lang:'en',prompt:'¿Con qué empieza',options:[d.L,...others(r,allDig,d.L,2)],answer:d.L,show:w});}
   function addRime(){const R=pick(r,RIME);rounds.push({say:R.r,prompt:'Encuentra la familia',options:[R.r.toUpperCase(),...others(r,RIME.map(x=>x.r),R.r,2).map(x=>x.toUpperCase())],answer:R.r.toUpperCase()});}
   function addRWord(){const R=pick(r,RIME);const w=pick(r,R.w);const pool=RIME.map(x=>x.r);
     rounds.push({say:w,lang:'en',prompt:'¿Qué familia es',options:[R.r.toUpperCase(),...others(r,pool,R.r,2).map(x=>x.toUpperCase())],answer:R.r.toUpperCase(),show:w});}
   function addROnset(){const R=pick(r,RIME);const w=pick(r,R.w.filter(x=>x.length===3));if(!w)return addRWord();const on=w[0].toUpperCase();
     rounds.push({say:w,lang:'en',prompt:'¿Qué letra falta? _'+R.r.toUpperCase(),options:[on,...others(r,consonants,on,2)],answer:on,show:'_'+R.r.toUpperCase()});}
   function wordPool(){return set.kind==='cvc'?CVC:set.kind==='cvv'?CVV.map(x=>x.w):set.kind==='blend'?BLEND:RCTRL.map(x=>x.w);}
   function guide(w){const t=(set.kind==='cvv'?CVV:set.kind==='rctrl'?RCTRL:[]).find(x=>x.w===w);return t?t.g:w;}
   function addWord(){const pool=wordPool();const w=pick(r,pool);const dis=others(r,pool.filter(x=>x.length===w.length),w,2);
     rounds.push({say:w,lang:'en',prompt:'Encuentra la palabra',options:[w.toUpperCase(),...(dis.length===2?dis:others(r,pool,w,2)).map(x=>x.toUpperCase())],answer:w.toUpperCase()});}
   function addBuild(){const pool=wordPool();const w=pick(r,pool);
     w.split('').forEach((ch,i)=>{const C=ch.toUpperCase();rounds.push({say:w,lang:'en',prompt:'Arma la palabra',options:[C,...others(r,ALL,C,2)],answer:C,word:w.toUpperCase(),idx:i});});}
   function addMid(){const pool=wordPool();const w=pick(r,pool);const i=Math.floor(w.length/2);const C=w[i].toUpperCase();
     const shown=w.toUpperCase().split('');shown[i]='_';rounds.push({say:w,lang:'en',prompt:'¿Qué falta?',options:[C,...others(r,'AEIOU'.split(''),C,2)],answer:C,show:shown.join('')});}
   function addEnd(){const pool=wordPool();const w=pick(r,pool);const i=w.length-1;const C=w[i].toUpperCase();
     const shown=w.toUpperCase().split('');shown[i]='_';rounds.push({say:w,lang:'en',prompt:'¿Qué falta?',options:[C,...others(r,consonants,C,2)],answer:C,show:shown.join('')});}
   function addBStart(){const w=pick(r,BLEND);const bl=w.slice(0,2).toUpperCase();const pool=['ST','PL','FR','DR','FL','CR','SP','SW','GL','TR','CL','SL','GR','BR'];
     rounds.push({say:w,lang:'en',prompt:'¿Con qué empieza',options:[bl,...others(r,pool,bl,2)],answer:bl,show:'_ _'+w.slice(2).toUpperCase()});}

   const L=set.L||[];
   for(let i=0;i<count;i++){
    const Li=L.length?L[i%L.length]:null;
    switch(type){
     case 'name':addName(Li);break;
     case 'sound':addSound(Li);break;
     case 'cv':addCV(Li);break;
     case 'first':addFirst(Li);break;
     case 'dname':addDName();break;
     case 'dsound':addDSound();break;
     case 'dfirst':addDFirst();break;
     case 'rime':addRime();break;
     case 'rword':addRWord();break;
     case 'ronset':addROnset();break;
     case 'word':addWord();break;
     case 'build':addBuild();break;
     case 'mid':addMid();break;
     case 'end':addEnd();break;
     case 'bstart':addBStart();break;
     case 'boss':{
       if(set.kind==='group'){[addName,addSound,addCV,addFirst][i%4](Li);}
       else if(set.kind==='digraph'){[addDName,addDSound,addDFirst][i%3]();}
       else if(set.kind==='rime'){[addRime,addRWord,addROnset][i%3]();}
       else if(set.kind==='blend'){[addWord,addBStart,addEnd][i%3]();}
       else {[addWord,addMid,addEnd][i%3]();}
       break;}
    }
   }
   return rounds.map(x=>({...x,options:shuf(r,x.options)}));
  }

  /* ---------- 3. ENGINE ---------- */
  const T=16,ROWS=15,VW=400,VH=240,FL=ROWS-2;
  const cv=$('cv'),ctx=cv.getContext('2d');ctx.imageSmoothingEnabled=false;

  const PAL={'.':0,k:'#141422',s:'#e3a878',d:'#c4885c',h:'#2c1a10',r:'#E5484D',w:'#ffffff',b:'#27385f',y:'#FFC93C',n:'#1b1b1b',
   B:'#2F6FD0',L:'#1B4E9E',G:'#37A05C',E:'#1E7A40',F:'#E9E9F2',o:'#F2872B',p:'#B26BE0'};
  const spr=a=>a.map(r=>r.split('').map(c=>PAL[c]));
  const HI=spr(["...hhhhh....","..hhhhhhh...","..hssssssh..","..skssksss..","..ssssssss..","...ssssss...","....ssss....","..rrrwwrrr..",".drrrwwrrrd.",".drrrwwrrrd.","..rrrwwrrr..","..bbbbbbbb..","..bbb..bbb..","..sss..sss..","..yyy..yyy..",".kkkk..kkkk."]);
  const H1=spr(["...hhhhh....","..hhhhhhh...","..hssssssh..","..skssksss..","..ssssssss..","...ssssss...","....ssss....","..rrrwwrrr..","..rrrwwrrrd.",".drrrwwrrr..","..rrrwwrrr..","..bbbbbbbb..","..bbb.bbb...","..sss..sss..",".yyy....yy..","kkkk....kkk."]);
  const H2=spr(["...hhhhh....","..hhhhhhh...","..hssssssh..","..skssksss..","..ssssssss..","...ssssss...","....ssss....","..rrrwwrrr..",".drrrwwrrr..","..rrrwwrrrd.","..rrrwwrrr..","..bbbbbbbb..","...bbb.bbb..","..sss..sss..","..yy....yyy.",".kkk....kkkk"]);
  const HJ=spr([".d.hhhhh..d.",".dhhhhhhh.d.",".dhssssssh.d","..sskssksss.","..ssssssss..","...ssssss...","....ssss....","..rrrwwrrr..","..rrrwwrrr..","..rrrwwrrr..","..rrrwwrrr..","..bbbbbbbb..","..bbbbbbbb..","..sss..sss..","..yyy..yyy..","..kkk..kkk.."]);
  const DA=spr(["...hhhhh....","..hhhhhhh...","..hssssssh..","..skssksss..","..ssssssss..","...ssssss...","....ssss....","..BBBLLBBB..",".dBBBLLBBBd.",".dBBBLLBBBd.","..BBBLLBBB..","..nnnnnnnn..","..nnn..nnn..","..sss..sss..","..www..www..",".kkkk..kkkk."]);
  const DB=spr(["...hhhhh....","..hhhhhhh...","..hssssssh..","..skssksss..","..ssssssss..","...ssssss...","....ssss....","..BBBLLBBB..","..BBBLLBBBd.",".dBBBLLBBB..","..BBBLLBBB..","..nnnnnnnn..","..nnn.nnn...","..sss..sss..",".www....ww..","kkkk....kkk."]);
  const DF=spr(["..BBBBBBBB..","BBLLLLLLLLBB","nnnnnnnnnnnn",".kkkkkkkkkk."]);
  const KA=spr(["...hhhhh....","..hhhhhhh...","..hssssssh..","..skssksss..","..ssssssss..","...ssssss...","....ssss....",".FGGGEEGGGF.","FFGGGEEGGGFF",".FGGGEEGGGF.","..GGGEEGGG..","..nnnnnnnn..","..nnn..nnn..","..sss..sss..","..yyy..yyy..",".kkkk..kkkk."]);
  const KB=spr(["............","...hhhhh....","..hhhhhhh...","..hssssssh..","..skssksss..","..ssssssss..","...ssssss...","....ssss....","FFGGGEEGGGFF",".FGGGEEGGGF.","..GGGEEGGG..","..nnnnnnnn..",".nnn....nnn.",".sss....sss.",".yyy....yyy.","kkkk....kkkk"]);
  const BA=spr(["...wwww...",".wwwwwwww.",".wkkwwwww.","wwkkkkwwww","wwwkkwwwww","wwwwwwkkww","wwwwwkkkkw",".wwwwwkkw.",".wwwwwwww.","...wwww..."]);
  const BB=spr(["...wwww...",".wwwwwwww.",".wwwwwkkw.","wwwwwkkkkw","wwwwwwkkww","wwwkkwwwww","wwkkkkwwww",".wkkwwwww.",".wwwwwwww.","...wwww..."]);
  const BOOT=spr(["....yy....","...yyyy...","...yyyy...","...yyyyy..","...yyyyyy.","yyyyyyyyyy","yyyyyyyyyy","kkkkkkkkkk"]);
  const WHIS=spr(["..FFFF....",".FFFFFF...",".FFkkFFFFF",".FFFFFFFFF","..FFFF.FFF","..........","..........","..........",]);
  const STAR=spr(["....yy....","....yy....","...yyyy...","yyyyyyyyyy",".yyyyyyyy.","..yyyyyy..","..yyyyyy..",".yyy..yyy."]);
  function blit(s,x,y,f){x=Math.round(x);y=Math.round(y);const h=s.length,w=s[0].length;
   for(let r=0;r<h;r++)for(let c=0;c<w;c++){const q=s[r][c];if(!q)continue;ctx.fillStyle=q;ctx.fillRect(x+(f?w-1-c:c),y+r,1,1);}}

  // tiles: 0 air 1 ground 2 brick 3 letter block 4 pipe 5 platform(one-way top)
  let map=[],W=0,G=null;
  const keys={l:0,r:0,j:0};let coy=0,buf=0,held=0;
  const GRAV=.42,MAXF=7.5,ACC=.3,FRIC=.8,MAXR=2.5,JUMP=-6.6,HOLD=.2,HOLDF=10;
  const solid=t=>t===1||t===2||t===3||t===4;
  const tileAt=(x,y)=>y<0||y>=ROWS?0:x<0?1:x>=W?0:map[y][x];

  function moveAxis(o,dx,dy,isP){
   if(dx){o.x+=dx;const a=Math.floor(o.x/T),b=Math.floor((o.x+o.w-1)/T),p=Math.floor(o.y/T),q=Math.floor((o.y+o.h-1)/T);
    for(let y=p;y<=q;y++){if(dx>0&&solid(tileAt(b,y))){o.x=b*T-o.w;o.vx=0;}if(dx<0&&solid(tileAt(a,y))){o.x=(a+1)*T;o.vx=0;}}}
   if(dy){const oy=o.y;o.y+=dy;const a=Math.floor(o.x/T),b=Math.floor((o.x+o.w-1)/T),p=Math.floor(o.y/T),q=Math.floor((o.y+o.h-1)/T);
    for(let x=a;x<=b;x++){
     const tb=tileAt(x,q);
     if(dy>0&&(solid(tb)||(tb===5&&oy+o.h<=q*T+1))){o.y=q*T-o.h;o.vy=0;o.g=true;}
     if(dy<0&&solid(tileAt(x,p))){o.y=(p+1)*T;o.vy=0;if(isP)headbutt(x,p);}
    }
    // moving platforms
    if(G)for(const m of G.movers){if(dy>0&&o.x+o.w>m.x&&o.x<m.x+m.w&&oy+o.h<=m.y+1&&o.y+o.h>=m.y){o.y=m.y-o.h;o.vy=0;o.g=true;o.ride=m;}}
   }
  }

  function buildLevel(set,li){
   const si=set.n-1, d=diff(si,li), R=LEVELS[si][li], f=R.f, seed=set.n*100+li*7+13, r=rng(seed);
   const rounds=makeRounds(set,li,rng(seed+1));
   const SEG=26; W=8+SEG*rounds.length+22;
   map=Array.from({length:ROWS},()=>new Array(W).fill(0));
   for(let x=0;x<W;x++){map[FL][x]=1;map[FL+1][x]=1;}
   const blocks=[],enemies=[],gates=[],coinItems=[],movers=[],powers=[],timed=[],winds=[];
   const setT=(x,y,t)=>{if(x>=0&&x<W&&y>=0&&y<ROWS)map[y][x]=t;};
   const row=(x0,x1,y,t)=>{for(let x=x0;x<=x1;x++)setT(x,y,t);};
   const col=(x,y0,y1,t)=>{for(let y=y0;y<=y1;y++)setT(x,y,t);};
   const gap=(x0,w)=>{for(let k=0;k<w;k++){setT(x0+k,FL,0);setT(x0+k,FL+1,0);}};
   const spd=d.speed*(f.fast?1.35:1);
   rounds.forEach((rd,i)=>{
    const b=8+i*SEG, tpl=R.segs[i%R.segs.length], bx0=b+SEG-12;
    let blockRow=FL-3, defY=FL*T, defRow=null;
    switch(tpl){
     case 'flat': break;
     case 'wide': break;
     case 'wall': col(b+3,FL-2,FL-1,2); break;
     case 'pipe': col(b+4,FL-2,FL-1,4); col(b+5,FL-2,FL-1,4); break;
     case 'shelf': row(b+2,b+5,FL-4,2); break;
     case 'gap2': gap(b+5, f.gap2x?3:2); break;
     case 'gapplat': gap(b+5,3); row(b+4,b+7,FL-4,5); break;
     case 'stairs': row(b+2,b+3,FL-2,5); row(b+4,b+5,FL-3,5); row(b+6,b+7,FL-4,5); row(b+8,b+9,FL-3,5); row(b+10,b+11,FL-2,5); break;
     case 'bench': row(b+2,b+SEG-3,FL-3,5); blockRow=FL-6; defY=(FL-3)*T; break;
     case 'tree': row(b+2,b+4,FL-3,5); row(b+6,b+8,FL-5,5); row(bx0-1,bx0+9,FL-5,5); blockRow=FL-8; break;
     case 'mover': gap(b+4,6); movers.push({x:(b+3)*T,y:(FL-2)*T,w:48,h:6,x0:(b+3)*T,x1:(b+8)*T,vx:(f.fastmover?1.1:0.7)}); break;
     case 'movers2': gap(b+3,5); gap(b+9,4); movers.push({x:(b+2)*T,y:(FL-2)*T,w:40,h:6,x0:(b+2)*T,x1:(b+6)*T,vx:.7}); movers.push({x:(b+12)*T,y:(FL-3)*T,w:40,h:6,x0:(b+8)*T,x1:(b+12)*T,vx:-.7}); break;
     case 'pipetop': for(let k=0;k<3;k++){col(bx0+k*4,FL-2,FL-1,4);} blockRow=FL-5; break;
     case 'corridor': col(bx0-2,FL-3,FL-1,4); col(bx0+10,FL-3,FL-1,4); break;
     case 'maze': row(b+1,b+3,FL-4,2); row(b+5,b+7,FL-6,2); row(b+9,b+11,FL-4,2); break;
     case 'bush': row(b+2,b+3,FL-2,5); row(b+6,b+7,FL-2,5); row(b+10,b+11,FL-2,5); break;
     case 'pond': gap(b+3,7); movers.push({x:(b+2)*T,y:(FL-1)*T,w:48,h:6,x0:(b+2)*T,x1:(b+7)*T,vx:.6}); break;
     case 'kiosk': col(b+6,FL-5,FL-1,4); col(b+7,FL-5,FL-1,4); row(b+3,b+4,FL-3,5); row(b+9,b+10,FL-3,5); break;
     case 'stalls': row(b+1,b+2,FL-2,2); row(b+4,b+5,FL-2,2); row(b+7,b+8,FL-2,2); row(b+10,b+11,FL-2,2); break;
     case 'awning': row(b+2,b+SEG-3,FL-5,5); break;
     case 'cart': gap(b+5,4); movers.push({x:(b+2)*T,y:(FL-2)*T,w:48,h:6,x0:(b+1)*T,x1:(b+SEG-14)*T,vx:.8}); break;
     case 'alley': col(b+3,FL-2,FL-1,4); col(b+8,FL-2,FL-1,4); break;
     case 'tunnel': row(b+1,b+9,FL-4,2); break;
     case 'ceiling': row(b+1,b+SEG-2,FL-6,2); break;
     case 'waves': gap(b+3,2); gap(b+7,1); gap(b+10,2); break;
     case 'pier': for(let x=b+2;x<=b+12;x++){setT(x,FL,0);setT(x,FL+1,0);} row(b+2,b+4,FL-1,5); row(b+6,b+8,FL-1,5); row(b+10,b+12,FL-1,5); break;
     case 'roof': row(b+1,b+5,FL-1,2); row(b+1,b+5,FL-2,2); gap(b+6,2); row(b+8,b+12,FL-1,2); row(b+8,b+12,FL-2,2); break;
     case 'press': timed.push({x:b+3,y0:FL-3,y1:FL-1,period:120,phase:0}); timed.push({x:b+8,y0:FL-3,y1:FL-1,period:120,phase:60}); break;
     case 'rope': for(let x=b+2;x<=b+11;x++){setT(x,FL,0);setT(x,FL+1,0);} row(b+2,b+11,FL-1,5); movers.push({x:(b+4)*T,y:(FL-3)*T,w:32,h:6,x0:(b+3)*T,x1:(b+9)*T,vx:.5}); break;
     case 'stones': for(let x=b+2;x<=b+11;x++){setT(x,FL,0);setT(x,FL+1,0);} [b+3,b+6,b+9].forEach(x=>{setT(x,FL,1);setT(x,FL+1,1);}); break;
     case 'falls': timed.push({x:bx0-2,y0:FL-3,y1:FL-1,period:150,phase:0,gate:1}); break;
     case 'carriage': gap(b+2,10); movers.push({x:(b+2)*T,y:(FL-1)*T,w:64,h:8,x0:(b+1)*T,x1:(b+8)*T,vx:(f.fastmover?1.0:0.6),train:1}); break;
    }
    // coins
    for(let k=0;k<4;k++)coinItems.push({x:(b+5+k*2)*T+4,y:(blockRow-3-(k%2))*T,got:0,t:r()*6});
    // the three letter blocks
    rd.options.forEach((lab,k)=>{const cx=bx0+k*4;setT(cx,blockRow,3);blocks.push({r:i,cx,cy:blockRow,lab,ok:lab===rd.answer,hit:0,bp:0,bd:0});});
    // enemies from the recipe
    const nd=(f.def||[1,2,2,3,4][li])+(si>=8?1:0);
    for(let e=0;e<nd;e++)enemies.push(mk('def',(bx0-3+e*4)*T,defY,(e%2?1:-1)*spd));
    const nb=f.ball||0; for(let e=0;e<nb;e++)enemies.push(mk('ball',(bx0+2+e*5)*T,(FL-7)*T,0.9+spd));
    if(f.balldrop&&i%2===0)enemies.push(mk('ball',(b+10)*T,(FL-9)*T,0.6));
    if(f.keepeach)enemies.push(mk('keep',(bx0+12)*T,FL*T,0.9+spd));
    if(f.wind)winds.push({x0:b*T,x1:(b+SEG)*T,dir:i%2?1:-1});
    // powers
    const pw=si<=4?['boot','whistle','star','boot',null][li]:si<=9?['whistle',null,'star',null,null][li]:[null,null,'star',null,null][li];
    if(pw&&i===1)powers.push({x:(b+9)*T,y:(blockRow-3)*T,kind:pw,got:0,t:0});
    gates.push({r:i,cx:b+SEG-1,dr:0});
   });
   const nk=f.keep||0; for(let k=0;k<nk;k++)enemies.push(mk('keep',(W-13-k*4)*T,FL*T,0.9+spd+k*.3));
   return {rounds,blocks,enemies,gates,coinItems,movers,powers,timed,winds,goalX:(W-9)*T,d,R,venue:VENUE[si]};
  }
  const ESZ={def:{w:10,h:16},keep:{w:10,h:16},ball:{w:9,h:9}};
  function mk(kind,x,y,vx){const S=ESZ[kind];return {kind,x,y:y-S.h,vx,vy:0,w:S.w,h:S.h,g:0,an:0,dead:0,hop:0,home:x};}

  /* audio: registry clips by entry ID from /audio/group{n}/; browser speech only as fallback for entries without a clip */
  let voices=[];if(window.speechSynthesis){const lv=()=>voices=speechSynthesis.getVoices();lv();speechSynthesis.onvoiceschanged=lv;}
  function speak(t,l){if(!window.speechSynthesis)return;try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(t);u.lang=l==='en'?'en-US':'es-ES';u.rate=.72;
   const v=voices.find(v=>v.lang&&v.lang.toLowerCase().startsWith(u.lang.slice(0,2)));if(v)u.voice=v;speechSynthesis.speak(u);}catch(e){}}
  const MEDIA=(window.SS_MEDIA_BASE||'');const AUD=new Audio();
  function playClip(rd){
   if(!rd.clip){speak(rd.say,rd.lang);return;}
   const url=MEDIA+clipUrl(rd.clip.id,rd.clip.part,G.set.n);
   try{if(window.speechSynthesis)speechSynthesis.cancel();AUD.onerror=()=>speak(rd.say,rd.lang);AUD.src=url;AUD.play().catch(()=>speak(rd.say,rd.lang));}catch(e){speak(rd.say,rd.lang);}
  }
  function sayRound(){if(!G||G.done)return;const rd=G.rounds[G.rd];if(rd)playClip(rd);}

  /* progress */
  const PKEY='supersonidos_v1';
  let prog={done:{},best:{}};
  try{const s=localStorage.getItem(PKEY);if(s)prog=JSON.parse(s);}catch(e){}
  function save(){try{localStorage.setItem(PKEY,JSON.stringify(prog));}catch(e){}}
  function isDone(si,li){return !!prog.done[si+'-'+li];}
  function setOpen(si){return TEST||si===0||[0,1,2,3,4].every(l=>isDone(si-1,l));}
  function lvlOpen(si,li){return TEST||(setOpen(si)&&(li===0||isDone(si,li-1)));}

  /* game flow */
  function start(si,li){
   const set=SETS[si],L=buildLevel(set,li);
   G={si,li,set,...L,rd:0,score:0,coins:0,lives:3,cam:0,t:0,fx:[],done:0,lost:0,
     power:L.R.f.star?'star':null,pt:L.R.f.star?600:0,time:0,
     p:{x:32,y:FL*T-16,vx:0,vy:0,w:10,h:16,g:0,an:0,hu:0,fc:1,ride:null}};
   G.fx.push({t:'x',x:80,y:(FL-6)*T,s:set.n+'-'+(li+1)+' '+L.R.nm,l:110});
   $('screen').classList.remove('on');
   $('over').classList.remove('on');
   hud();setTimeout(sayRound,400);
  }
  function headbutt(cx,cy){
   const b=G.blocks.find(b=>b.cx===cx&&b.cy===cy&&!b.hit);if(!b)return;b.bp=1;
   if(b.r!==G.rd){b.bd=18;return;}
   if(b.ok){b.hit=1;G.score+=100;
    for(let i=0;i<6;i++)G.fx.push({t:'c',x:b.cx*T+8,y:b.cy*T,vx:(Math.random()-.5)*1.6,vy:-2-Math.random()*1.4,l:36});
    G.fx.push({t:'x',x:b.cx*T+8,y:b.cy*T-4,s:'¡SÍ!',l:40});
    const rd=G.rounds[G.rd];playClip(rd);
    G.rd++;if(G.rd<G.rounds.length)setTimeout(sayRound,900);hud();
   }else{b.bd=26;G.p.vy=1.6;G.score=Math.max(0,G.score-20);G.fx.push({t:'x',x:b.cx*T+8,y:b.cy*T-4,s:'✗',l:24,bad:1});setTimeout(sayRound,400);hud();}
  }
  function hurt(){const p=G.p;if(p.hu>0||G.power==='star')return;p.hu=70;p.vx=-2.6*p.fc;p.vy=-3.4;G.lives--;hud();
   if(G.lives<=0){G.lost=1;finish(false);}}

  function update(){
   if(!G||G.done)return;G.t++;G.time++;const p=G.p,d=G.d;
   if(G.pt>0){G.pt--;if(G.pt===0)G.power=null;}
   const dir=keys.r-keys.l;if(dir){p.vx+=dir*ACC;p.fc=dir;}else p.vx*=FRIC;
   p.vx=Math.max(-MAXR,Math.min(MAXR,p.vx));if(Math.abs(p.vx)<.05)p.vx=0;
   if(keys.j)buf=8;else if(buf>0)buf--;
   if(p.g)coy=7;else if(coy>0)coy--;
   const jm=G.power==='boot'?1.22:1;
   if(buf>0&&coy>0){p.vy=JUMP*jm;p.g=0;coy=0;buf=0;held=HOLDF;}
   if(held>0&&keys.j&&p.vy<0){p.vy-=HOLD*jm;held--;}else held=0;
   p.vy=Math.min(MAXF,p.vy+GRAV);
   if(p.ride){p.x+=p.ride.vx;p.ride=null;}
   p.g=0;moveAxis(p,p.vx,0,1);moveAxis(p,0,p.vy,1);
   if(p.x<0)p.x=0;if(p.hu>0)p.hu--;if(p.g&&Math.abs(p.vx)>.3)p.an+=Math.abs(p.vx)*.16;
   if(p.y>VH+30){p.x=Math.max(8,p.x-60);p.y=(FL-2)*T;p.vy=0;G.lives--;p.hu=60;hud();if(G.lives<=0){G.lost=1;finish(false);return;}}

   for(const m of G.movers){m.x+=m.vx;if(m.x<m.x0||m.x>m.x1)m.vx*=-1;}
   for(const tp of G.timed){const ph=((G.t+tp.phase)%tp.period)/tp.period;const up=ph<.5;
    for(let y=tp.y0;y<=tp.y1;y++)map[y][tp.x]= up?4:0;
    if(up&&p.x+p.w>tp.x*T&&p.x<tp.x*T+T&&p.y+p.h>tp.y0*T){p.x = p.x+p.w/2<tp.x*T+T/2 ? tp.x*T-p.w : tp.x*T+T;}}
   for(const wd of G.winds){if(p.x>wd.x0&&p.x<wd.x1)p.vx+=wd.dir*0.045;}
   for(const g of G.gates){const op=g.r<G.rd;if(!op){for(let y=FL-3;y<FL;y++)map[y][g.cx]=4;}
    else if(g.dr<1){g.dr+=.05;for(let y=FL-3;y<FL;y++)map[y][g.cx]=0;}}
   for(const c of G.coinItems){c.t+=.14;if(c.got)continue;if(p.x+p.w>c.x-4&&p.x<c.x+12&&p.y+p.h>c.y&&p.y<c.y+14){c.got=1;G.coins++;G.score+=10;G.fx.push({t:'c',x:c.x+4,y:c.y,vx:0,vy:-2.2,l:26});hud();}}
   for(const pw of G.powers){pw.t+=.1;if(pw.got)continue;if(p.x+p.w>pw.x&&p.x<pw.x+10&&p.y+p.h>pw.y&&p.y<pw.y+10){pw.got=1;G.power=pw.kind;G.pt=pw.kind==='star'?480:pw.kind==='whistle'?420:900;G.score+=50;
     G.fx.push({t:'x',x:pw.x+5,y:pw.y-6,s:pw.kind==='boot'?'¡BOTA!':pw.kind==='whistle'?'¡SILBATO!':'¡ESTRELLA!',l:50});hud();}}

   const frozen=G.power==='whistle';
   for(const e of G.enemies){
    if(e.dead){e.dead--;continue;}
    if(!frozen){
     e.vy=Math.min(MAXF,e.vy+GRAV);const want=e.x+e.vx;moveAxis(e,e.vx,0,0);
     const lim=e.kind==='keep'?46:60;
     if(Math.abs(e.x-want)>.01||e.x<e.home-lim||e.x>e.home+lim)e.vx*=-1;
     e.g=0;moveAxis(e,0,e.vy,0);
     if(e.kind==='ball'){if(e.g)e.vy=-4.4;e.an+=.22;}
     else if(e.kind==='keep'){e.hop--;if(e.g&&e.hop<=0){e.vy=-4.6;e.g=0;e.hop=40+Math.random()*30|0;}e.an+=.18;}
     else if(e.g){const ah=Math.floor((e.x+(e.vx>0?e.w+2:-2))/T),bw=Math.floor((e.y+e.h+2)/T);if(!solid(tileAt(ah,bw))&&tileAt(ah,bw)!==5)e.vx*=-1;e.an+=Math.abs(e.vx)*.16;}
    }
    if(p.x+p.w>e.x+1&&p.x<e.x+e.w-1&&p.y+p.h>e.y+2&&p.y<e.y+e.h){
     if(G.power==='star'||(p.vy>.8&&p.y+p.h<e.y+e.h*.6)){e.dead=110;p.vy=-5.4;G.score+=50;G.fx.push({t:'x',x:e.x+5,y:e.y-4,s:'+50',l:26});hud();}
     else hurt();
    }
   }
   G.fx.forEach(f=>{f.l--;if(f.t==='c'){f.x+=f.vx;f.y+=f.vy;f.vy+=.22;}else f.y-=.55;});G.fx=G.fx.filter(f=>f.l>0);
   if(!G.done&&p.x>G.goalX+8&&G.rd>=G.rounds.length){finish(true);}
   else if(!G.done&&p.x>G.goalX+8){p.x=G.goalX-4;p.vx=-2;G.fx.push({t:'x',x:p.x,y:p.y-8,s:'¡Falta un bloque!',l:50});}
   const want=Math.max(0,Math.min(W*T-VW,p.x-VW*.38));G.cam+=(want-G.cam)*.14;
  }

  function finish(win){
   G.done=1;const o=$('over');
   const h=$('ovh'),pp=$('ovp');
   if(win){const bonus=G.lives*200+(G.d.timeBonus?Math.max(0,3000-G.time*2):0);G.score+=bonus;
    prog.done[G.si+'-'+G.li]=1;const k=G.si+'-'+G.li;if(!prog.best[k]||G.score>prog.best[k])prog.best[k]=G.score;save();
    h.textContent='¡GOL!';pp.textContent=`Nivel ${G.li+1} de ${G.set.title} · ${G.score} puntos`;speak('¡Gol! ¡Muy bien!');
    $('ovnext').textContent=G.li<4?'Siguiente':'Siguiente set';
   }else{h.textContent='Sin vidas';pp.textContent='Otra vez — ya casi.';$('ovnext').textContent='Reintentar';}
   o.classList.add('on');
  }

  /* ---------- draw ---------- */
  function drawBack(kind,cam){
   const y=VH-70; ctx.save();
   if(kind==='fence'){ctx.strokeStyle='rgba(255,255,255,.35)';ctx.lineWidth=1;for(let i=0;i<30;i++){const x=((i*14)-cam*.6)%(VW+28)-14;ctx.beginPath();ctx.moveTo(x,y+10);ctx.lineTo(x,VH-32);ctx.stroke();}ctx.beginPath();ctx.moveTo(0,y+10);ctx.lineTo(VW,y+10);ctx.stroke();}
   else if(kind==='school'){ctx.fillStyle='#E8D8B0';ctx.fillRect(0,y-10,VW,40);ctx.fillStyle='#6CC4E8';for(let i=0;i<10;i++){const x=((i*44)-cam*.3)%(VW+44)-22;ctx.fillRect(x,y-2,14,14);}}
   else if(kind==='trees'){ctx.fillStyle='#2E6B3F';for(let i=0;i<10;i++){const x=((i*50)-cam*.35)%(VW+60)-30;ctx.fillRect(x+7,y+6,4,26);ctx.beginPath();ctx.arc(x+9,y+6,12,0,7);ctx.fill();}}
   else if(kind==='stalls'){for(let i=0;i<8;i++){const x=((i*60)-cam*.4)%(VW+70)-35;ctx.fillStyle=i%2?'#E5484D':'#F2F7F3';ctx.fillRect(x,y+4,40,10);ctx.fillStyle='#8B5E34';ctx.fillRect(x+2,y+14,3,16);ctx.fillRect(x+35,y+14,3,16);}}
   else if(kind==='stands'||kind==='stadium'||kind==='cup'){ctx.fillStyle=kind==='cup'?'#5A4210':'#3A4A6A';ctx.fillRect(0,y-16,VW,48);for(let r=0;r<4;r++){for(let i=0;i<60;i++){const x=((i*8)-cam*.15)%(VW+8)-4;ctx.fillStyle=['#E5484D','#FFC93C','#F2F7F3','#2F6FD0'][(i+r)%4];ctx.fillRect(x,y-12+r*10,4,4);}}}
   else if(kind==='beach'){ctx.fillStyle='#3FA9D8';ctx.fillRect(0,y+8,VW,26);ctx.fillStyle='rgba(255,255,255,.6)';for(let i=0;i<12;i++){const x=((i*40)-cam*.5+Math.sin(G.t*.05+i)*4)%(VW+40)-20;ctx.fillRect(x,y+12+(i%3)*6,18,2);}}
   else if(kind==='city'){for(let i=0;i<12;i++){const x=((i*44)-cam*.3)%(VW+50)-25,h=30+(i*17)%40;ctx.fillStyle='#1B2044';ctx.fillRect(x,VH-32-h,36,h);ctx.fillStyle='#FFC93C';for(let w=0;w<6;w++){if((i+w)%3)ctx.fillRect(x+4+(w%3)*10,VH-32-h+6+Math.floor(w/3)*10,4,4);}}}
   else if(kind==='factory'){for(let i=0;i<8;i++){const x=((i*64)-cam*.3)%(VW+70)-35;ctx.fillStyle='#4A505C';ctx.fillRect(x,y-4,48,36);ctx.fillStyle='#2E323B';ctx.fillRect(x+36,y-24,8,20);}}
   else if(kind==='river'){ctx.fillStyle='#3FA9D8';ctx.fillRect(0,y+14,VW,20);ctx.fillStyle='rgba(255,255,255,.5)';for(let i=0;i<10;i++){const x=((i*46)-cam*.55)%(VW+46)-23;ctx.fillRect(x,y+18+(i%2)*6,14,1);}}
   else if(kind==='train'){ctx.fillStyle='#6E5238';ctx.fillRect(0,y+22,VW,3);for(let i=0;i<30;i++){const x=((i*16)-cam*.9)%(VW+16)-8;ctx.fillRect(x,y+25,2,6);}}
   ctx.restore();
  }
  function draw(){
   const V=G?G.venue:VENUE[0];
   const sky=ctx.createLinearGradient(0,0,0,VH);sky.addColorStop(0,V.sky[0]);sky.addColorStop(1,V.sky[1]);ctx.fillStyle=sky;ctx.fillRect(0,0,VW,VH);
   if(!G){ctx.fillStyle='#2E7D4F';ctx.fillRect(0,VH-32,VW,32);return;}
   const cam=G.cam;
   if(V.back==='city'||V.back==='stands'){ctx.fillStyle='rgba(255,255,255,.75)';for(let i=0;i<40;i++){ctx.fillRect(((i*53)-cam*.05)%(VW+20)-10,(i*37)%90+8,1,1);}}
   else{ctx.fillStyle='rgba(255,255,255,.9)';for(let i=0;i<9;i++){const x=((i*137)-cam*.25)%(VW+140)-70,y=22+(i%3)*20;ctx.beginPath();ctx.arc(x,y,9,0,7);ctx.arc(x+10,y-4,11,0,7);ctx.arc(x+21,y,8,0,7);ctx.fill();}}
   drawBack(V.back,cam);
   ctx.fillStyle=V.hill;for(let i=0;i<8;i++){const x=((i*150)-cam*.45)%(VW+200)-100;ctx.beginPath();ctx.arc(x,VH-20,52,Math.PI,0);ctx.fill();}
   ctx.fillStyle=V.bush;for(let i=0;i<12;i++){const x=((i*88)-cam*.75)%(VW+120)-60;ctx.beginPath();ctx.arc(x,VH-30,13,Math.PI,0);ctx.arc(x+13,VH-30,17,Math.PI,0);ctx.arc(x+27,VH-30,12,Math.PI,0);ctx.fill();}
   ctx.save();ctx.translate(-Math.round(cam),0);
   const c0=Math.max(0,Math.floor(cam/T)-1),c1=Math.min(W-1,Math.ceil((cam+VW)/T)+1);
   for(let y=0;y<ROWS;y++)for(let x=c0;x<=c1;x++){const t=map[y][x];if(!t)continue;const px=x*T,py=y*T;
    if(t===1){ctx.fillStyle=V.dirt;ctx.fillRect(px,py,T,T);ctx.fillStyle=V.dirt2;ctx.fillRect(px,py+11,T,5);ctx.fillRect(px+7,py,2,11);if(y===FL||!solid(tileAt(x,y-1))){ctx.fillStyle=V.grass;ctx.fillRect(px,py,T,4);}}
    else if(t===2){ctx.fillStyle='#B5562E';ctx.fillRect(px,py,T,T);ctx.fillStyle='#8E3F1F';ctx.fillRect(px,py+7,T,2);ctx.fillRect(px+7,py,2,7);ctx.fillRect(px+3,py+9,2,7);}
    else if(t===4){ctx.fillStyle='#3FA45C';ctx.fillRect(px,py,T,T);ctx.fillStyle='#68D18A';ctx.fillRect(px+1,py,4,T);ctx.fillStyle='#25753F';ctx.fillRect(px+T-3,py,3,T);}
    else if(t===5){ctx.fillStyle='#8E6BA8';ctx.fillRect(px,py,T,6);ctx.fillStyle='#B592CC';ctx.fillRect(px,py,T,2);}}
   for(const m of G.movers){if(m.train){ctx.fillStyle='#8E3F1F';ctx.fillRect(m.x,m.y,m.w,m.h);ctx.fillStyle='#B5562E';ctx.fillRect(m.x,m.y,m.w,2);ctx.fillStyle='#141422';ctx.fillRect(m.x+6,m.y+m.h,6,4);ctx.fillRect(m.x+m.w-12,m.y+m.h,6,4);}
    else{ctx.fillStyle='#8E6BA8';ctx.fillRect(m.x,m.y,m.w,m.h);ctx.fillStyle='#B592CC';ctx.fillRect(m.x,m.y,m.w,2);}}
   for(const b of G.blocks){const px=b.cx*T,py=b.cy*T-Math.round(b.bp*6);b.bp*=.8;if(b.bd>0)b.bd--;
    ctx.fillStyle=b.hit?'#B0873A':b.bd>0?'#E5484D':'#FFC93C';ctx.fillRect(px,py,T,T);
    ctx.fillStyle='rgba(255,255,255,.45)';ctx.fillRect(px+1,py+1,T-2,2);ctx.fillStyle='rgba(0,0,0,.35)';ctx.fillRect(px,py+T-3,T,3);ctx.fillRect(px+T-3,py,3,T);
    ctx.fillStyle='#7A5A15';ctx.fillRect(px+2,py+2,2,2);ctx.fillRect(px+T-4,py+T-4,2,2);
    const flashOff=G.R.f.flash&&b.r===G.rd&&!b.hit&&((G.t>>4)%3===0);
    ctx.fillStyle=b.hit?'rgba(0,0,0,.35)':'#141422';ctx.font=(b.lab.length>2?'700 7px':b.lab.length>1?'700 9px':'700 11px')+' Verdana,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';if(!flashOff)ctx.fillText(b.lab,px+T/2,py+T/2+1);
    if(b.r===G.rd&&!b.hit&&(G.t>>3)%2){ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.strokeRect(px-1.5,py-1.5,T+3,T+3);}}
   for(const c of G.coinItems){if(c.got)continue;const wob=Math.abs(Math.cos(c.t))*6+2;ctx.fillStyle='#FFC93C';ctx.fillRect(c.x+(8-wob)/2,c.y+Math.sin(c.t)*1.5,wob,10);ctx.fillStyle='#E0A017';ctx.fillRect(c.x+(8-wob)/2,c.y+4+Math.sin(c.t)*1.5,wob,2);}
   for(const pw of G.powers){if(pw.got)continue;const yy=pw.y+Math.sin(pw.t)*2;blit(pw.kind==='boot'?BOOT:pw.kind==='whistle'?WHIS:STAR,pw.x,yy,0);}
   for(const e of G.enemies){if(e.dead){if(e.kind!=='ball'&&e.dead>70)blit(DF,e.x,e.y+12,0);continue;}
    if(e.kind==='ball')blit(Math.floor(e.an)%2?BA:BB,e.x,e.y,e.vx<0);else if(e.kind==='keep')blit(e.g?KA:KB,e.x-1,e.y,e.vx<0);else blit(Math.floor(e.an)%2?DA:DB,e.x-1,e.y,e.vx>0);}
   const gt=FL*T-70,gx=G.goalX;ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.strokeRect(gx,gt,56,70);ctx.lineWidth=.6;ctx.strokeStyle='rgba(255,255,255,.6)';
   for(let i=1;i<8;i++){ctx.beginPath();ctx.moveTo(gx+i*7,gt);ctx.lineTo(gx+i*7,gt+70);ctx.stroke();}for(let i=1;i<10;i++){ctx.beginPath();ctx.moveTo(gx,gt+i*7);ctx.lineTo(gx+56,gt+i*7);ctx.stroke();}
   const p=G.p;if(!(p.hu>0&&(G.t>>2)%2)){if(G.power==='star'&&(G.t>>2)%2){ctx.fillStyle='rgba(255,201,60,.35)';ctx.fillRect(p.x-3,p.y-3,16,22);}
    let s=HI;if(!p.g)s=HJ;else if(Math.abs(p.vx)>.3)s=Math.floor(p.an)%2?H1:H2;blit(s,p.x-1,p.y,p.fc<0);}
   for(const f of G.fx){ctx.globalAlpha=Math.min(1,f.l/22);if(f.t==='c'){ctx.fillStyle='#FFC93C';ctx.fillRect(f.x-3,f.y-4,6,8);}
    else{ctx.fillStyle=f.bad?'#E5484D':'#fff';ctx.font='700 10px Verdana,sans-serif';ctx.textAlign='center';ctx.fillText(f.s,f.x,f.y);}ctx.globalAlpha=1;}
   ctx.restore();
  }

  /* ---------- HUD / screens ---------- */
  const P=$('prompt');
  function hud(){
   if(!G)return;
   $('lives').textContent='♥'.repeat(Math.max(0,G.lives))+'♡'.repeat(Math.max(0,3-G.lives));
   $('score').textContent=G.score+(G.power?' · '+(G.power==='boot'?'👟':G.power==='whistle'?'❄️':'⭐'):'');
   if(G.rd>=G.rounds.length){P.textContent='¡Corre a la portería!';return;}
   const rd=G.rounds[G.rd];
   if(rd.word){const done=G.rounds.slice(0,G.rd).filter(x=>x.word===rd.word).map(x=>x.answer).join('');const shown=(done+'_'.repeat(rd.word.length-done.length)).split('').join(' ');
    P.innerHTML='Arma <b>'+shown+'</b>';}
   else if(rd.show){P.innerHTML=rd.prompt+' <b>'+rd.show+'</b>';}
   else P.innerHTML=rd.prompt+' <b>'+rd.say+'</b>?';
  }
  function showMap(){
   G=null;const sc=$('screen');sc.classList.add('on');$('over').classList.remove('on');
   let h='<h1>SÚPER SONIDOS</h1><h2>'+(TEST?'MODO PRUEBA · todo abierto'+(SHOW_TAIL?' · con sets 7–12':' · añade ?tail=1 para sets 7–12'):'12 sets · 60 niveles · toca un nivel')+'</h2>';
   SETS.forEach((s,si)=>{ if(s.tail&&!SHOW_TAIL)return;const open=setOpen(si),all=[0,1,2,3,4].every(l=>isDone(si,l));
    h+=`<div class="set ${open?'':'locked'} ${all?'done':''}"><div class="num">${s.n}</div><div class="nm"><b>${s.title}</b><small>${s.sub}</small></div><div class="dots">`;
    for(let l=0;l<5;l++){const o=lvlOpen(si,l),d=isDone(si,l);h+=`<button class="dot ${d?'done':o?'open':''}" title="${LEVELS[si][l].nm}" ${o?`data-s="${si}" data-l="${l}"`:'disabled'}>${l+1}</button>`;}
    h+='</div></div>';});
   h+='<div class="row"><button class="btn alt" id="reset">Borrar progreso</button></div>';
   sc.innerHTML=h;
   sc.querySelectorAll('.dot[data-s]').forEach(b=>b.onclick=()=>start(+b.dataset.s,+b.dataset.l));
   $('reset').onclick=()=>{if(confirm('¿Borrar todo el progreso?')){prog={done:{},best:{}};save();showMap();}};
   P.textContent='Elige un nivel';$('lives').textContent='♥♥♥';$('score').textContent='0';
  }
  $('menu').onclick=showMap;
  $('ovmap').onclick=showMap;
  $('ovnext').onclick=()=>{if(!G)return showMap();if(G.lost)return start(G.si,G.li);if(G.li<4)return start(G.si,G.li+1);const nx=SETS[G.si+1];if(nx&&(!nx.tail||SHOW_TAIL))return start(G.si+1,0);showMap();};
  $('say').onclick=sayRound;

  function bind(id,k){const e=$(id);const on=ev=>{ev.preventDefault();keys[k]=1;},off=ev=>{ev.preventDefault();keys[k]=0;};
   e.addEventListener('touchstart',on,{passive:false});e.addEventListener('touchend',off,{passive:false});e.addEventListener('touchcancel',off,{passive:false});
   e.addEventListener('mousedown',on);onWin('mouseup',off);}
  bind('left','l');bind('right','r');bind('jump','j');
  const KM={ArrowLeft:'l',ArrowRight:'r',a:'l',d:'r',' ':'j',ArrowUp:'j',w:'j'};
  onWin('keydown',e=>{const k=KM[e.key];if(k){keys[k]=1;e.preventDefault();}});
  onWin('keyup',e=>{const k=KM[e.key];if(k){keys[k]=0;e.preventDefault();}});
  onDoc('touchstart',function u(){if(window.speechSynthesis){const x=new SpeechSynthesisUtterance(' ');x.volume=0;speechSynthesis.speak(x);}offDoc('touchstart',u);},{once:true});

  (function loop(){if(stopped)return;update();draw();raf=requestAnimationFrame(loop);})();
  showMap();
  /* ---------- WRAPPER: teardown ---------- */
  return function stopSuperSonidos () {
    stopped = true
    cancelAnimationFrame(raf)
    for (const id of timers) window.clearTimeout(id)
    timers.clear()
    for (const [type, fn, opts] of winListeners) window.removeEventListener(type, fn, opts)
    for (const [type, fn, opts] of docListeners) document.removeEventListener(type, fn, opts)
    try { AUD.pause(); AUD.removeAttribute('src') } catch (e) {}
    try { if (window.speechSynthesis) speechSynthesis.cancel() } catch (e) {}
  }
}
