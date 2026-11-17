(function () {
  "use strict";

  // ---------- config ----------
  var STREAMS = {
    mubeen:  { url: "http://45.89.237.183/mubeen/index.m3u8",                   title: "مبين نيوز",            audio: false },
    alalam:  { url: "https://ncdn.telewebion.ir/alalam/live/playlist.m3u8",     title: "قناة العالم",          audio: false },
    irinn:   { url: "https://ncdn.telewebion.ir/irinn/live/playlist.m3u8",      title: "قناة الخبر",            audio: false },
    presstv: { url: "https://ncdn.telewebion.ir/presstv/live/playlist.m3u8",    title: "Press TV",              audio: false },
    ifilm:   { url: "https://ncdn.telewebion.ir/ifilm/live/playlist.m3u8",      title: "آي فيلم",               audio: false },
    kawthar: { url: "https://ncdn.telewebion.ir/kawthar/live/playlist.m3u8",    title: "قناة الكوثر",          audio: false },
    quran:   { url: "https://ncdn.telewebion.ir/radioquran/live/playlist.m3u8", title: "إذاعة القرآن الكريم", audio: true },
    // النسخة الداخلية: بث مبين نيوز نفسه الموجود على mubeennews.com/live
    mubeenDom: { url: "https://stream.qatifiyoon.com/master.m3u8",               title: "مبين نيوز",            audio: false }
  };

  var LANG = (function () { try { return localStorage.getItem("mbn_lang") === "fa" ? "fa" : "ar"; } catch (e) { return "ar"; } })();
  // النسخة: "ir" = إيراني (كما كانت) ، "dom" = داخلي (أخبار mubeennews.com). المستخدم يختار والتطبيق يتذكّر.
  var ED = (function () { try { return localStorage.getItem("mbn_ed") === "dom" ? "dom" : "ir"; } catch (e) { return "ir"; } })();

  var SOURCES_BY_LANG = {
    ar: [
      { id: "mubeen", type: "wp",  url: "https://mubeennews.com/wp-json/wp/v2/posts?categories=12&per_page=20&_embed=1", external: true },
      { id: "mehr",   type: "rss", url: "https://ar.mehrnews.com/rss" },
      { id: "irna",   type: "rss", url: "https://ar.irna.ir/rss" },
      { id: "tasnim", type: "rss", url: "https://www.tasnimnews.ir/ar/rss/feed/0/0/8/1/TopStories" },
      { id: "iranar", type: "tg",  url: "https://t.me/s/iraninarabic_ir", external: true },
      { id: "srv",    type: "srv", url: "http://45.89.237.183/news/news-ar.json" }
    ],
    fa: [
      { id: "mubeen", type: "rss", url: "https://mubeennews.com/fa/feed/", external: true },
      { id: "mehr",   type: "rss", url: "https://www.mehrnews.com/rss" },
      { id: "irna",   type: "rss", url: "https://www.irna.ir/rss" },
      { id: "tasnim", type: "rss", url: "https://www.tasnimnews.ir/fa/rss/feed/0/0/8/1/TopStories" },
      { id: "isna",   type: "rss", url: "https://www.isna.ir/rss" },
      { id: "mashregh", type: "rss", url: "https://www.mashreghnews.ir/rss" },
      { id: "srv",    type: "srv", url: "http://45.89.237.183/news/news-fa.json" }
    ]
  };
  var SOURCES = SOURCES_BY_LANG[LANG];
  var REELS_URL = "http://45.89.237.183/reels/reels.json";
  var MUBEEN_BREAKING = "https://mubeennews.com/wp-json/mbn/v1/breaking" + (LANG === "fa" ? "?lang=fa" : "");

  var TICKER_MAX = 20;          // عاجل: only the 20 newest items from all channels
  var PER_SOURCE_BREAKING = 50; // newest items taken from each source into عاجل (then cut to TICKER_MAX)
  var NEWS_CACHE_MAX = 150;
  var REFRESH_MS = 3 * 60 * 1000;
  var TICKER_SPEED = 70;        // px per second

  var SRC_NAMES = {
    ar: { mubeen: "مبين نيوز", mehr: "مهر", irna: "إرنا", tasnim: "تسنيم", iranar: "إيران بالعربية", isna: "إيسنا", mashregh: "مشرق", all: "الكل" },
    fa: { mubeen: "مبین نیوز", mehr: "مهر", irna: "ایرنا", tasnim: "تسنیم", iranar: "ایران بالعربیه", isna: "ایسنا", mashregh: "مشرق", all: "همه" }
  };
  var SRC_NAME = SRC_NAMES[LANG];
  SOURCES.forEach(function (s) { s.name = SRC_NAME[s.id]; });

  var T = {
    ar: { breaking: "عاجل", news: "الأخبار", allday: "بث على مدار الساعة", radio: "إذاعة", quran: "القرآن الكريم", quranTab: "القرآن الكريم",
          quranRadio: "إذاعة القرآن الكريم", quranSub: "تلاوات مباشرة على مدار الساعة", liveBadge: "مباشر", live: "البث المباشر",
          liveSub: "مبين نيوز • العالم • الخبر • آي فيلم",
          irinnShort: "الخبر", irinn: "قناة الخبر الإيرانية", irinnSub: "إخبارية • بث مباشر",
          presstvShort: "Press TV", presstv: "برس تي في", presstvSub: "إخبارية بالإنجليزية • بث مباشر",
          ifilmShort: "iFilm", ifilm: "آي فيلم", ifilmSub: "أفلام ومسلسلات • بث مباشر", mubeenShort: "مبين", mubeen: "مبين نيوز", mubeenSub: "بث مباشر على مدار الساعة",
          alalamShort: "العالم", alalam: "قناة العالم", alalamSub: "إخبارية • بث مباشر", kawtharShort: "الكوثر", kawthar: "قناة الكوثر",
          kawtharSub: "منوعة • بث مباشر", reels: "ريلز", reelsLoading: "جارٍ تحميل المقاطع…", reelsEmpty: "لا توجد مقاطع حالياً",
          back: "→ رجوع", share: "مشاركة", tickerLoading: "جارٍ تحميل الأخبار العاجلة…", noBreaking: "لا توجد أخبار عاجلة بعد",
          noNews: "لا توجد أخبار حالياً — اضغط زر التحديث", readSrc: "قراءة الخبر في المصدر", source: "المصدر:", like: "إعجاب", internal: "الشبكة الداخلية", offline: "غير متصل",
          failed: "تعذّر الاتصال — تُعرض آخر أخبار محفوظة", newBreaking: "أخبار عاجلة جديدة: ", updated: "تم التحديث", sign: "— مبين نيوز", langBtn: "فا",
          edIr: "إيراني", edDom: "داخلي", press: "صحافة", opp: "منبر المعارضة", oppTab: "المعارضة", pris: "معتقلو الرأي", prisTab: "معتقلو الرأي",
          latest: "آخر الأخبار" },
    fa: { breaking: "فوری", news: "اخبار", allday: "پخش شبانه‌روزی", radio: "رادیو", quran: "قرآن کریم", quranTab: "قرآن کریم",
          quranRadio: "رادیو قرآن", quranSub: "تلاوت زنده به‌صورت شبانه‌روزی", liveBadge: "زنده", live: "پخش زنده",
          liveSub: "مبین نیوز • العالم • خبر • آی‌فیلم",
          irinnShort: "خبر", irinn: "شبکه خبر", irinnSub: "خبری • پخش زنده",
          presstvShort: "Press TV", presstv: "پرس تی‌وی", presstvSub: "خبری انگلیسی • پخش زنده",
          ifilmShort: "iFilm", ifilm: "آی‌فیلم", ifilmSub: "فیلم و سریال • پخش زنده", mubeenShort: "مبین", mubeen: "مبین نیوز", mubeenSub: "پخش زنده شبانه‌روزی",
          alalamShort: "العالم", alalam: "شبکه العالم", alalamSub: "خبری • پخش زنده", kawtharShort: "الکوثر", kawthar: "شبکه الکوثر",
          kawtharSub: "عمومی • پخش زنده", reels: "ریلز", reelsLoading: "در حال بارگذاری ویدیوها…", reelsEmpty: "فعلاً ویدیویی نیست",
          back: "→ بازگشت", share: "اشتراک", tickerLoading: "در حال بارگذاری اخبار فوری…", noBreaking: "هنوز خبر فوری‌ای نیست",
          noNews: "فعلاً خبری نیست — دکمه به‌روزرسانی را بزنید", readSrc: "خواندن خبر در منبع", source: "منبع:", like: "پسندیدن", internal: "شبکه داخلی", offline: "آفلاین",
          failed: "اتصال برقرار نشد — آخرین اخبار ذخیره‌شده نمایش داده می‌شود", newBreaking: "اخبار فوری جدید: ", updated: "به‌روز شد", sign: "— مبین نیوز", langBtn: "ع",
          edIr: "ایرانی", edDom: "داخلی", press: "مطبوعات", opp: "تریبون اپوزیسیون", oppTab: "اپوزیسیون", pris: "زندانیان عقیدتی", prisTab: "زندانیان",
          latest: "آخرین اخبار" }
  }[LANG];
  function applyLang() {
    document.documentElement.lang = LANG;
    Array.prototype.forEach.call(document.querySelectorAll("[data-i18n]"), function (el) {
      var k = el.getAttribute("data-i18n"); if (T[k]) el.textContent = T[k];
    });
    document.getElementById("langBtn").textContent = T.langBtn;
    if (LANG === "fa") document.body.classList.add("lang-fa");
    document.body.classList.add("ed-" + ED);
    Array.prototype.forEach.call(document.querySelectorAll("#edSwitch .ed"), function (b) { b.classList.toggle("on", b.getAttribute("data-ed") === ED); });
    if (ED === "dom") $("tickerLabel").textContent = T.latest;
  }

  // ---------- storage ----------
  function load(key, def) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch (e) { return def; }
  }
  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  var KEY_SFX = LANG === "fa" ? "_fa" : "";
  var breaking = load("mbn_breaking" + KEY_SFX, []).slice(0, TICKER_MAX);
  var news = load("mbn_news" + KEY_SFX, []);
  var filter = "all";
  var seenBreaking = {};
  breaking.forEach(function (b) { seenBreaking[b.key] = 1; });

  // ---------- native bridge ----------
  var pending = {}, seq = 0;
  window.__nativeCb = function (id, ok, b64) {
    var p = pending[id]; if (!p) return;
    delete pending[id];
    var bytes = b64ToBytes(b64);
    if (ok) p.resolve(decodeUtf8(bytes)); else p.reject(new Error(decodeUtf8(bytes)));
  };
  function b64ToBytes(b64) {
    var bin = atob(b64), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function decodeUtf8(bytes) {
    if (window.TextDecoder) return new TextDecoder("utf-8").decode(bytes);
    var s = ""; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    try { return decodeURIComponent(escape(s)); } catch (e) { return s; }
  }
  function get(url, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var t = setTimeout(function () { if (!done) { done = true; reject(new Error("timeout")); } }, timeoutMs || 25000);
      function ok(v) { if (!done) { done = true; clearTimeout(t); resolve(v); } }
      function bad(e) { if (!done) { done = true; clearTimeout(t); reject(e); } }
      if (window.Android && Android.fetch) {
        var id = "r" + (++seq);
        pending[id] = { resolve: ok, reject: bad };
        Android.fetch(id, url);
      } else {
        fetch(url).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); }).then(ok, bad);
      }
    });
  }

  // ---------- helpers ----------
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function htmlToText(html) {
    if (!html) return "";
    var d = new DOMParser().parseFromString("<div>" + html + "</div>", "text/html");
    return (d.body.textContent || "").replace(/\s+/g, " ").trim();
  }
  function htmlToParas(html) {
    if (!html) return [];
    var d = new DOMParser().parseFromString("<div>" + html + "</div>", "text/html");
    Array.prototype.forEach.call(d.querySelectorAll("script,style,iframe,figure,figcaption,noscript"), function (n) { n.remove(); });
    var ps = d.querySelectorAll("p,h2,h3,h4,li,blockquote");
    var out = [];
    if (ps.length) {
      Array.prototype.forEach.call(ps, function (p) { var t = (p.textContent || "").replace(/\s+/g, " ").trim(); if (t) out.push(t); });
    } else {
      (d.body.innerText || d.body.textContent || "").split(/\n+/).forEach(function (t) { t = t.trim(); if (t) out.push(t); });
    }
    return out;
  }
  function normKey(s) {
    return String(s || "").replace(/[ً-ٰٟ]/g, "").replace(/[^؀-ۿa-zA-Z0-9]/g, "").slice(0, 80);
  }
  function cleanTitle(s) {
    return String(s || "").replace(/^\s*(عاجل|عاجل\s*[|:\-–]|\u{1F534})\s*[|:\-–]?\s*/u, "").replace(/\s+/g, " ").trim();
  }
  function parseTs(v) {
    if (v == null || v === "") return Date.now();
    if (typeof v === "number") return v < 1e12 ? v * 1000 : v;
    if (/^\d+$/.test(v)) { var n = +v; return n < 1e12 ? n * 1000 : n; }
    var t = Date.parse(v);
    if (isNaN(t)) t = Date.parse(String(v).replace(" ", "T"));
    return isNaN(t) ? Date.now() : t;
  }
  function ago(ts) {
    var s = Math.max(0, (Date.now() - ts) / 1000);
    if (LANG === "fa") {
      if (s < 60) return "اکنون";
      if (s < 3600) return Math.floor(s / 60) + " دقیقه پیش";
      if (s < 86400) return Math.floor(s / 3600) + " ساعت پیش";
      return Math.floor(s / 86400) + " روز پیش";
    }
    if (s < 60) return "الآن";
    var m = Math.floor(s / 60);
    if (m < 60) return "منذ " + (m === 1 ? "دقيقة" : m === 2 ? "دقيقتين" : m + (m <= 10 ? " دقائق" : " دقيقة"));
    var h = Math.floor(m / 60);
    if (h < 24) return "منذ " + (h === 1 ? "ساعة" : h === 2 ? "ساعتين" : h + (h <= 10 ? " ساعات" : " ساعة"));
    var d = Math.floor(h / 24);
    return "منذ " + (d === 1 ? "يوم" : d === 2 ? "يومين" : d + " أيام");
  }
  function clock(ts) {
    var d = new Date(ts), h = d.getHours(), m = d.getMinutes();
    return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
  }
  function toast(msg) {
    var t = $("toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.hidden = true; }, 2600);
  }

  // ---------- parsers ----------
  function parseRss(xml, src) {
    var doc = new DOMParser().parseFromString(xml, "text/xml");
    var items = doc.getElementsByTagName("item");
    var out = [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var txt = function (tag) { var n = it.getElementsByTagName(tag)[0]; return n ? n.textContent : ""; };
      var title = cleanTitle(txt("title"));
      if (!title) continue;
      var desc = txt("description");
      var img = "";
      var enc = it.getElementsByTagName("enclosure")[0];
      if (enc && /image|jpe?g|png|webp/i.test((enc.getAttribute("type") || "") + enc.getAttribute("url"))) img = enc.getAttribute("url");
      if (!img) {
        var media = it.getElementsByTagNameNS("*", "content")[0] || it.getElementsByTagNameNS("*", "thumbnail")[0];
        if (media && media.getAttribute("url")) img = media.getAttribute("url");
      }
      if (!img) { var m = /<img[^>]+src=["']([^"']+)/i.exec(desc); if (m) img = m[1]; }
      out.push({
        key: normKey(title), src: src.id, title: title,
        summary: htmlToText(desc).slice(0, 400), html: desc,
        img: img, url: (txt("link") || "").trim(), ts: parseTs(txt("pubDate") || txt("date"))
      });
    }
    return out;
  }
  function parseWp(json, src) {
    var arr = JSON.parse(json);
    return arr.map(function (p) {
      var title = cleanTitle(htmlToText(p.title && p.title.rendered));
      var img = "";
      try { img = p._embedded["wp:featuredmedia"][0].source_url; } catch (e) {}
      if (!img && p.jetpack_featured_media_url) img = p.jetpack_featured_media_url;
      return {
        key: normKey(title), src: src.id, title: title,
        summary: htmlToText(p.excerpt && p.excerpt.rendered).slice(0, 400),
        html: p.content && p.content.rendered, img: img, url: p.link,
        ts: parseTs(p.date_gmt ? p.date_gmt + "Z" : p.date)
      };
    }).filter(function (x) { return x.title; });
  }

  function parseTg(html, src) {
    var d = new DOMParser().parseFromString(html, "text/html");
    var out = [];
    Array.prototype.forEach.call(d.querySelectorAll(".tgme_widget_message[data-post]"), function (m) {
      var tx = m.querySelector(".tgme_widget_message_text");
      if (!tx) return;
      var raw = htmlToText(tx.innerHTML.replace(/<br\s*\/?>/gi, "\u0001")).split("\u0001").join("\n");
      var lines = raw.split(/\n+/).map(function (l) { return l.replace(/https?:\/\/\S+/g, "").replace(/[@#]\S+/g, "").trim(); }).filter(function (l) { return l.length > 3; });
      if (!lines.length) return;
      var title = cleanTitle(lines[0].replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu, "").trim());
      if (!title) return;
      var tm = m.querySelector("time[datetime]");
      var ph = m.querySelector(".tgme_widget_message_photo_wrap");
      var img = ""; if (ph) { var mm = /url\(['"]?([^'")]+)/.exec(ph.getAttribute("style") || ""); if (mm) img = mm[1]; }
      out.push({ key: normKey(title), src: src.id, title: title, summary: lines.slice(1).join(" ").slice(0, 400),
        html: lines.map(function (l) { return "<p>" + esc(l) + "</p>"; }).join(""), img: img,
        url: "https://t.me/" + m.getAttribute("data-post"), ts: parseTs(tm ? tm.getAttribute("datetime") : "") });
    });
    return out;
  }

  // news collected on the Iranian server (mubeen + Telegram via the phone tunnel) — works during shutdown
  function parseSrv(body) {
    var d = JSON.parse(body), arr = (d && d.items) || [];
    return arr.map(function (n) {
      var title = cleanTitle(n.title);
      return { key: normKey(title), src: n.src, title: title, summary: n.summary || "", html: n.html || "",
               img: n.img || "", url: n.url || "", ts: parseTs(n.ts) };
    }).filter(function (x) { return x.title && !(LANG === "fa" && x.src === "iranar"); });
  }

  // ---------- breaking store ----------
  function addBreaking(list) {
    var added = 0;
    list.forEach(function (b) {
      if (!b.key || seenBreaking[b.key]) return;
      seenBreaking[b.key] = 1;
      b.fresh = Date.now();
      breaking.push(b);
      added++;
    });
    breaking.sort(function (a, b) { return b.ts - a.ts; });
    if (breaking.length > TICKER_MAX) {
      breaking.splice(TICKER_MAX).forEach(function (b) { delete seenBreaking[b.key]; });
    }
    save("mbn_breaking" + KEY_SFX, breaking);
    return added;
  }

  // ---------- likes & share ----------
  var likes = load("mbn_likes", {});
  function actions(key) {
    var on = !!likes[key];
    return '<div class="acts"><span class="act like' + (on ? " on" : "") + '" data-like="' + esc(key) + '">' + (on ? "♥" : "♡") + " " + T.like + '</span>' +
      '<span class="act share" data-share="' + esc(key) + '">⤴ ' + T.share + '</span></div>';
  }
  function findItem(key) {
    for (var i = 0; i < news.length; i++) if (news[i].key === key) return news[i];
    for (var j = 0; j < breaking.length; j++) if (breaking[j].key === key) return breaking[j];
    return null;
  }
  function shareItem(it) {
    if (!it) return;
    var text = it.title + (it.summary && it.summary !== it.title ? "\n\n" + it.summary.slice(0, 300) : "") + "\n" + T.sign;
    if (window.Android && Android.share) Android.share(text);
    else if (navigator.share) navigator.share({ text: text }).catch(function () {});
  }
  function toggleLike(key) {
    if (likes[key]) delete likes[key]; else likes[key] = Date.now();
    save("mbn_likes", likes);
    Array.prototype.forEach.call(document.querySelectorAll('[data-like]'), function (el) {
      if (el.getAttribute("data-like") !== key) return;
      var on = !!likes[key]; el.classList.toggle("on", on); el.textContent = (on ? "♥" : "♡") + " " + T.like;
    });
  }
  document.addEventListener("click", function (e) {
    var l = e.target.closest("[data-like]"); if (l) { e.stopPropagation(); e.preventDefault(); toggleLike(l.getAttribute("data-like")); return; }
    var sh = e.target.closest("[data-share]"); if (sh) { e.stopPropagation(); e.preventDefault(); shareItem(findItem(sh.getAttribute("data-share"))); }
  }, true);

  // ---------- render ----------
  function renderTicker() {
    var track = $("tickerTrack"), win = $("tickerWindow");
    var items = breaking.slice(0, TICKER_MAX);
    if (!items.length) {
      track.innerHTML = '<span class="item">' + T.tickerLoading + '</span>';
      track.classList.remove("run");
      return;
    }
    track.innerHTML = items.map(function (b) {
      return '<span class="sep">' + (ED === "dom" ? "●" : T.breaking) + '</span><span class="item">' + esc(b.title) + "</span>";
    }).join("");
    track.classList.remove("run");
    void track.offsetWidth;
    var tw = track.scrollWidth, ww = win.clientWidth;
    // RTL news ticker: text enters from the left edge and moves right
    track.style.setProperty("--from", (-tw) + "px");
    track.style.setProperty("--to", ww + "px");
    track.style.setProperty("--dur", Math.max(20, (tw + ww) / TICKER_SPEED) + "s");
    track.classList.add("run");
  }

  function renderBreaking() {
    var ol = $("breakingList");
    if (!breaking.length) { ol.innerHTML = '<li class="empty" style="border:0;background:none">' + T.noBreaking + '</li>'; return; }
    var now = Date.now();
    ol.innerHTML = breaking.map(function (b, i) {
      return '<li data-i="' + i + '"' + (b.fresh && now - b.fresh < 4000 ? ' class="new"' : "") + '>' +
        '<div class="t">' + esc(b.title) + "</div>" +
        '<div class="meta"><span class="src">' + esc(SRC_NAME[b.src] || b.src) + "</span><span>" + clock(b.ts) + "</span><span>" + ago(b.ts) + "</span></div>" + actions(b.key) + "</li>";
    }).join("");
  }

  function renderChips() {
    var avail = { all: 1 };
    news.forEach(function (n) { avail[n.src] = 1; });
    var list = [{ id: "all", name: SRC_NAME.all }].concat(SOURCES.map(function (s) { return { id: s.id, name: s.name }; }))
      .filter(function (c) { return avail[c.id]; });
    $("chips").innerHTML = list.map(function (c) {
      return '<button class="chip' + (filter === c.id ? " active" : "") + '" data-f="' + c.id + '">' + esc(c.name) + "</button>";
    }).join("");
  }

  function renderNews() {
    renderChips();
    var box = $("newsList");
    var list = news.filter(function (n) { return filter === "all" || n.src === filter; });
    if (!list.length) {
      box.innerHTML = loading ? '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>' : '<div class="empty">' + T.noNews + '</div>';
      return;
    }
    box.innerHTML = list.slice(0, 120).map(function (n, i) {
      var img = n.img ? '<div class="img" style="background-image:url(\'' + esc(n.img).replace(/'/g, "%27") + '\')"></div>'
                      : '<div class="img ph"><svg><use href="#flame"/></svg></div>';
      return '<div class="card' + (i === 0 && n.img ? " lead" : "") + '" role="button" data-key="' + esc(n.key) + '">' + img +
        '<div class="body"><div class="title">' + esc(n.title) + "</div>" +
        '<div class="meta"><span class="src">' + esc(SRC_NAME[n.src] || n.src) + "</span><span>" + ago(n.ts) + "</span></div>" + actions(n.key) + "</div></div>";
    }).join("");
  }

  // ---------- detail ----------
  var current = null;
  function openDetail(item) {
    current = item;
    var paras = htmlToParas(item.html);
    if (!paras.length && item.summary) paras = [item.summary];
    if (paras.length === 1 && paras[0] === item.title) paras = [];
    $("detailBody").innerHTML =
      (item.img ? '<img class="hero" src="' + esc(item.img) + '" alt="" onerror="this.remove()">' : "") +
      '<div class="inner"><h2>' + esc(item.title) + "</h2>" +
      '<div class="meta"><span class="src">' + esc(SRC_NAME[item.src] || item.src) + "</span><span>" + clock(item.ts) + "</span><span>" + ago(item.ts) + "</span></div>" +
      '<div class="txt" style="margin-top:12px">' + paras.map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("") + "</div>" +
      '<div class="src-line">' + T.source + ' ' + esc(SRC_NAME[item.src] || item.src) + '</div>' + actions(item.key) + "</div>";
    $("detail").hidden = false;
    $("detail").scrollTop = 0;
    var os = $("openSrc");
    if (os) os.onclick = function () { openUrl(item.url); };
  }
  function closeDetail() { $("detail").hidden = true; current = null; }
  function openUrl(u) {
    if (window.Android && Android.openExternal) Android.openExternal(u); else window.open(u, "_blank");
  }

  // ---------- loading ----------
  var loading = false;
  function refresh(manual) {
    if (ED === "dom") return refreshDom(manual);
    if (loading) return;
    loading = true;
    $("refreshBtn").classList.add("spin");
    if (!news.length) renderNews();

    var mubeenOk = false, iranOk = false;
    var collected = [], newBreaking = [];

    var jobs = SOURCES.map(function (src) {
      return get(src.url).then(function (body) {
        var items = src.type === "rss" ? parseRss(body, src) : src.type === "tg" ? parseTg(body, src) : src.type === "srv" ? parseSrv(body) : parseWp(body, src);
        if (!items.length) return;
        if (src.external) mubeenOk = true; else iranOk = true;
        collected = collected.concat(items);
        if (!src.external || src.type === "tg") {
          items.filter(function (it) { return src.type !== "srv" || it.src === "iranar"; }).slice().sort(function (a, b) { return b.ts - a.ts; }).slice(0, PER_SOURCE_BREAKING)
            .forEach(function (it) { newBreaking.push(it); });
        }
      }).catch(function () {});
    });

    jobs.push(get(MUBEEN_BREAKING).then(function (body) {
      var arr = JSON.parse(body);
      if (!Array.isArray(arr)) arr = arr.items || [];
      arr.forEach(function (b) {
        var t = cleanTitle(b.text || b.title);
        if (t) newBreaking.push({ key: normKey(t), src: "mubeen", title: t, url: b.url || "", ts: parseTs(b.ts || b.date), summary: "", html: "" });
      });
      if (arr.length) mubeenOk = true;
    }).catch(function () {}));

    Promise.all(jobs).then(function () {
      loading = false;
      $("refreshBtn").classList.remove("spin");

      if (collected.length) {
        var map = {};
        collected.concat(news).forEach(function (n) { if (n.key && !map[n.key]) map[n.key] = n; });
        news = Object.keys(map).map(function (k) { return map[k]; })
          .sort(function (a, b) { return b.ts - a.ts; }).slice(0, NEWS_CACHE_MAX);
        save("mbn_news" + KEY_SFX, news);
      }
      var added = addBreaking(newBreaking);

      var badge = $("netBadge");
      if (!mubeenOk && iranOk) { badge.textContent = T.internal; badge.hidden = false; }
      else if (!mubeenOk && !iranOk) { badge.textContent = T.offline; badge.hidden = false; }
      else badge.hidden = true;

      renderTicker(); renderBreaking(); renderNews();
      if (manual) toast(!mubeenOk && !iranOk ? T.failed : added ? (T.newBreaking + added) : T.updated);
    });
  }

  // ---------- النسخة الداخلية (mubeennews.com) ----------
  var DOM_SECTIONS = [
    { id: "dnews", cat: { ar: 12,  fa: 40  } },   // الأخبار
    { id: "press", cat: { ar: 68,  fa: 73  } },   // صحافة
    { id: "opp",   cat: { ar: 86,  fa: 91  } },   // منبر المعارضة
    { id: "pris",  cat: { ar: 124, fa: 129 } }    // معتقلو الرأي
  ];
  var DOM_PER_SECTION = 40;
  var domData = {};
  DOM_SECTIONS.forEach(function (sec) { domData[sec.id] = load("mbn_dom_" + sec.id + "_" + LANG, []); });

  function domAll() {
    var all = [];
    DOM_SECTIONS.forEach(function (sec) { all = all.concat(domData[sec.id]); });
    return all.sort(function (a, b) { return b.ts - a.ts; });
  }
  function syncDom() {
    news = domAll();                       // للمشاركة وفتح الخبر
    breaking = news.slice(0, TICKER_MAX);  // شريط «آخر الأخبار»
  }
  function renderDomList(secId) {
    var box = $("list-" + secId), list = domData[secId];
    if (!list.length) {
      box.innerHTML = loading ? '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>' : '<div class="empty">' + T.noNews + '</div>';
      return;
    }
    box.innerHTML = list.map(function (n, i) {
      var img = n.img ? '<div class="img" style="background-image:url(\'' + esc(n.img).replace(/'/g, "%27") + '\')"></div>'
                      : '<div class="img ph"><svg><use href="#flame"/></svg></div>';
      return '<div class="card' + (i === 0 && n.img ? " lead" : "") + '" role="button" data-key="' + esc(n.key) + '">' + img +
        '<div class="body"><div class="title">' + esc(n.title) + "</div>" +
        '<div class="meta"><span>' + ago(n.ts) + "</span></div>" + actions(n.key) + "</div></div>";
    }).join("");
  }
  function renderDom() {
    syncDom();
    renderTicker();
    DOM_SECTIONS.forEach(function (sec) { renderDomList(sec.id); });
  }
  function refreshDom(manual) {
    if (loading) return;
    loading = true;
    $("refreshBtn").classList.add("spin");
    var okAny = false;
    var jobs = DOM_SECTIONS.map(function (sec) {
      var url = "https://mubeennews.com/wp-json/wp/v2/posts?categories=" + sec.cat[LANG] + "&per_page=" + DOM_PER_SECTION + "&_embed=1";
      return get(url).then(function (body) {
        var items = parseWp(body, { id: "mubeen" });
        if (!items.length) return;
        okAny = true;
        items.forEach(function (it) { it.key = sec.id + ":" + it.key; it.sec = sec.id; });
        domData[sec.id] = items.sort(function (a, b) { return b.ts - a.ts; }).slice(0, DOM_PER_SECTION);
        save("mbn_dom_" + sec.id + "_" + LANG, domData[sec.id]);
      }).catch(function () {});
    });
    Promise.all(jobs).then(function () {
      loading = false;
      $("refreshBtn").classList.remove("spin");
      renderDom();
      if (manual) toast(okAny ? T.updated : T.failed);
    });
  }
  Array.prototype.forEach.call(document.querySelectorAll(".dom-list"), function (box) {
    box.addEventListener("click", function (e) {
      var c = e.target.closest(".card"); if (!c) return;
      var it = findItem(c.getAttribute("data-key")); if (it) openDetail(it);
    });
  });
  var HOME = ED === "dom" ? "dnews" : "breaking";

  // ---------- events ----------
  function showView(name) {
    Array.prototype.forEach.call(document.querySelectorAll(".view"), function (v) { v.classList.toggle("active", v.id === "view-" + name); });
    Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (t) { t.classList.toggle("active", t.getAttribute("data-view") === name); });
    window.scrollTo(0, 0);
    save("mbn_tab_" + ED, name);
    document.body.classList.toggle("reels-mode", name === "reels");
    if (name === "reels") loadReels(); else pauseReels();
  }

  // ---------- reels ----------
  var reels = load("mbn_reels", []), reelsLoaded = false, reelObs = null, reelSound = !!load("mbn_reel_sound", false);
  function renderReels() {
    var box = $("reelsBox");
    if (!reels.length) { box.innerHTML = '<div class="empty">' + T.reelsEmpty + '</div>'; return; }
    box.innerHTML = reels.map(function (r, i) {
      return '<div class="reel" data-i="' + i + '"><video playsinline loop' + (reelSound ? "" : " muted") + ' preload="' + (i < 2 ? "auto" : "none") + '" poster="' + esc(r.poster || "") + '" data-src="' + esc(r.video) + '"></video>' +
        '<span class="reel-mute">' + (reelSound ? "🔊" : "🔇") + '</span><span class="reel-count">' + (i + 1) + " / " + reels.length + "</span>" +
        (r.text ? '<div class="reel-cap">' + esc(r.text) + "</div>" : "") + "</div>";
    }).join("");
    if (reelObs) reelObs.disconnect();
    reelObs = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) {
        var v = en.target.querySelector("video");
        if (en.isIntersecting && en.intersectionRatio > 0.6) {
          if (!v.src) v.src = v.getAttribute("data-src");
          v.muted = !reelSound;
          en.target.querySelector(".reel-mute").textContent = reelSound ? "🔊" : "🔇";
          var p = v.play(); if (p && p.catch) p.catch(function () { v.muted = true; v.play(); });
          var nx = en.target.nextElementSibling; if (nx) { var nv = nx.querySelector("video"); if (nv && !nv.src) { nv.src = nv.getAttribute("data-src"); nv.preload = "auto"; } }
        } else { v.pause(); }
      });
    }, { threshold: [0, 0.6, 1] });
    Array.prototype.forEach.call(box.querySelectorAll(".reel"), function (el) { reelObs.observe(el); });
  }
  function loadReels() {
    if (!reelsLoaded) { renderReels(); }
    get(REELS_URL, 20000).then(function (body) {
      var d = JSON.parse(body), list = (d && d.reels) || [];
      var g = {}, o = [], m = 0;
      list.forEach(function (r) { var k = Math.floor((+r.id || 0) / 1000000); (g[k] = g[k] || []).push(r); });
      var ks = Object.keys(g); ks.forEach(function (k) { m = Math.max(m, g[k].length); });
      for (var i = 0; i < m; i++) ks.forEach(function (k) { if (g[k][i]) o.push(g[k][i]); });
      var changed = JSON.stringify(o.map(function (r) { return r.id; })) !== JSON.stringify(reels.map(function (r) { return r.id; }));
      reels = o; save("mbn_reels", reels);
      if (changed || !reelsLoaded) renderReels();
      reelsLoaded = true;
    }).catch(function () { if (!reelsLoaded) { renderReels(); reelsLoaded = true; } });
  }
  function pauseReels() {
    Array.prototype.forEach.call(document.querySelectorAll("#reelsBox video"), function (v) { v.pause(); });
  }
  $("reelsBox").addEventListener("click", function (e) {
    var el = e.target.closest(".reel"); if (!el) return;
    var v = el.querySelector("video");
    reelSound = v.muted; save("mbn_reel_sound", reelSound);
    Array.prototype.forEach.call(document.querySelectorAll("#reelsBox .reel"), function (r) {
      r.querySelector("video").muted = !reelSound;
      r.querySelector(".reel-mute").textContent = reelSound ? "🔊" : "🔇";
    });
    if (v.paused) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
  });

  document.querySelector(".tabs").addEventListener("click", function (e) {
    var b = e.target.closest(".tab"); if (b) showView(b.getAttribute("data-view"));
  });
  $("chips").addEventListener("click", function (e) {
    var c = e.target.closest(".chip"); if (!c) return;
    filter = c.getAttribute("data-f"); renderNews();
  });
  $("newsList").addEventListener("click", function (e) {
    var c = e.target.closest(".card"); if (!c) return;
    var k = c.getAttribute("data-key");
    for (var i = 0; i < news.length; i++) if (news[i].key === k) { openDetail(news[i]); break; }
  });
  $("breakingList").addEventListener("click", function (e) {
    var li = e.target.closest("li[data-i]"); if (!li) return;
    var b = breaking[+li.getAttribute("data-i")];
    if (!b) return;
    var full = null;
    for (var i = 0; i < news.length; i++) if (news[i].key === b.key) { full = news[i]; break; }
    openDetail(full || b);
  });
  $("tickerWindow").addEventListener("click", function () {
    if (ED === "dom") { if (breaking[0]) openDetail(breaking[0]); return; }
    showView("breaking");
  });
  $("refreshBtn").addEventListener("click", function () { refresh(true); });
  $("langBtn").addEventListener("click", function () {
    try { localStorage.setItem("mbn_lang", LANG === "fa" ? "ar" : "fa"); } catch (e) {}
    location.reload();
  });
  $("edSwitch").addEventListener("click", function (e) {
    var b = e.target.closest(".ed"); if (!b) return;
    var ed = b.getAttribute("data-ed"); if (ed === ED) return;
    try { localStorage.setItem("mbn_ed", ed); } catch (err) {}
    location.reload();
  });
  $("detailBack").addEventListener("click", closeDetail);
  $("detailShare").addEventListener("click", function () {
    if (!current) return;
    var text = current.title + (current.url ? "\n" + current.url : "") + "\n" + T.sign;
    if (window.Android && Android.share) Android.share(text);
  });
  Array.prototype.forEach.call(document.querySelectorAll(".stream-card"), function (card) {
    card.addEventListener("click", function () {
      var id = card.getAttribute("data-stream"), s = STREAMS[id];
      var title = { mubeen: T.mubeen, mubeenDom: T.mubeen, alalam: T.alalam, kawthar: T.kawthar, irinn: T.irinn, presstv: T.presstv, ifilm: T.ifilm, quran: T.quranRadio }[id] || s.title;
      if (window.Android && Android.play) Android.play(s.url, title, s.audio);
      else window.open(s.url, "_blank");
    });
  });

  window.onBack = function () {
    if (!$("detail").hidden) { closeDetail(); return true; }
    if (!document.getElementById("view-" + HOME).classList.contains("active")) { showView(HOME); return true; }
    return false;
  };

  function layout() {
    var h = document.querySelector(".top").offsetHeight;
    $("ticker").style.top = h + "px";
  }
  window.addEventListener("resize", function () { layout(); renderTicker(); });

  // ---------- start ----------
  applyLang();
  layout();
  var lastTab = load("mbn_tab_" + ED, ED === "ir" ? load("mbn_tab", HOME) : HOME);
  if (!document.getElementById("view-" + lastTab) || !document.querySelector('.tab.' + ED + '[data-view="' + lastTab + '"]')) lastTab = HOME;
  showView(lastTab);
  if (ED === "dom") renderDom(); else { renderTicker(); renderBreaking(); renderNews(); }
  refresh(false);
  setInterval(function () { refresh(false); }, REFRESH_MS);
  setInterval(function () { if (ED === "dom") renderDom(); else renderBreaking(); }, 60000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) refresh(false); });
})();
