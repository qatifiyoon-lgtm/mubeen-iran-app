/* مبين نيوز — وضع تلفزيون أندرويد: تنقّل بالريموت (الأسهم + OK) وتصميم أفقي */
(function () {
  "use strict";
  var TV = /[?&]tv=1/.test(location.search);
  try { if (!TV && window.Android && Android.isTv) TV = !!Android.isTv(); } catch (e) {}
  if (!TV) return;
  document.documentElement.classList.add("tv");
  document.body.classList.add("tv");

  var SEL = [
    ".tab", "#edSwitch .ed", "#langBtn", "#refreshBtn", ".chip", ".card", ".stream-card",
    ".breaking-list li[data-i]", "#detailBack", "#detail .vblock", "#detail .act.like", ".reel"
  ].join(",");

  function visible(el) {
    if (!el || el.offsetParent === null && getComputedStyle(el).position !== "fixed") return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }
  function scope() {
    var d = document.getElementById("detail");
    return d && !d.hidden ? d : document;
  }
  function items() {
    return Array.prototype.filter.call(scope().querySelectorAll(SEL), function (el) {
      if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "0");
      return visible(el);
    });
  }
  var cur = null;
  function focus(el, noScroll) {
    if (!el) return;
    if (cur) cur.classList.remove("tv-focus");
    cur = el;
    el.classList.add("tv-focus");
    try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
    if (!noScroll && !el.closest(".tabs") && !el.closest(".top")) el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
  }
  function center(r) { return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }

  function move(dir) {
    var list = items();
    if (!cur || list.indexOf(cur) < 0) { focus(home(list)); return true; }
    var a = cur.getBoundingClientRect(), ca = center(a), best = null, bs = Infinity;
    list.forEach(function (el) {
      if (el === cur) return;
      var b = el.getBoundingClientRect(), cb = center(b);
      var dx = cb.x - ca.x, dy = cb.y - ca.y, main, side;
      if (dir === "up")    { if (b.bottom > a.top + 4) return;  main = a.top - b.bottom;  side = Math.abs(dx); }
      if (dir === "down")  { if (b.top < a.bottom - 4) return;  main = b.top - a.bottom;  side = Math.abs(dx); }
      if (dir === "left")  { if (b.right > a.left + 4) return;  main = a.left - b.right;  side = Math.abs(dy); }
      if (dir === "right") { if (b.left < a.right - 4) return;  main = b.left - a.right;  side = Math.abs(dy); }
      var s = Math.max(0, main) + side * 2.2;
      if (s < bs) { bs = s; best = el; }
    });
    if (best) { focus(best); return true; }
    return false;
  }
  function home(list) {
    list = list || items();
    var d = document.getElementById("detail");
    if (d && !d.hidden) return d.querySelector(".vblock") || document.getElementById("detailBack");
    var act = document.querySelector(".view.active");
    var first = act && Array.prototype.filter.call(act.querySelectorAll(SEL), visible)[0];
    return first || document.querySelector(".tab.active") || list[0];
  }

  function reelsMode() { return document.body.classList.contains("reels-mode"); }
  function reelStep(n) {
    var box = document.getElementById("reelsBox"); if (!box) return;
    var h = box.clientHeight; box.scrollBy({ top: n * h, behavior: "smooth" });
  }

  document.addEventListener("keydown", function (e) {
    var k = e.key, dir = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" }[k];
    var detailOpen = !document.getElementById("detail").hidden;
    if (dir) {
      e.preventDefault();
      if (reelsMode() && !detailOpen && (dir === "up" || dir === "down") && (!cur || !cur.closest(".tabs"))) {
        reelStep(dir === "down" ? 1 : -1); return;
      }
      if (!move(dir) && detailOpen && (dir === "up" || dir === "down")) {
        document.getElementById("detail").scrollBy({ top: dir === "down" ? 260 : -260, behavior: "smooth" });
      } else if (!detailOpen && (dir === "up" || dir === "down") && cur && !cur.closest(".tabs")) {
        /* nothing more in that direction: scroll the page a bit so long lists stay readable */
      }
      return;
    }
    if (k === "Enter" || k === " " ) {
      if (reelsMode() && !detailOpen && (!cur || !cur.closest(".tabs"))) {
        var r = document.querySelectorAll("#reelsBox .reel"), box = document.getElementById("reelsBox");
        var i = Math.round(box.scrollTop / Math.max(1, box.clientHeight)); if (r[i]) r[i].click();
        e.preventDefault(); return;
      }
      if (cur) { e.preventDefault(); cur.click(); setTimeout(function () { if (!document.getElementById("detail").hidden) focus(home()); }, 60); }
      return;
    }
    if (k === "Escape" || k === "Backspace" || k === "GoBack" || k === "BrowserBack") {
      if (window.onBack && window.onBack()) { e.preventDefault(); setTimeout(function () { focus(home()); }, 60); }
    }
  }, true);

  /* after closing the article or switching tabs, keep the focus somewhere visible */
  document.addEventListener("click", function (e) {
    var t = e.target.closest(".tab, #detailBack");
    if (t) setTimeout(function () {
      if (t.classList.contains("tab")) focus(t, true); else focus(home());
    }, 80);
  });
  var _onBack = window.onBack;
  setTimeout(function () {
    var ob = window.onBack;
    window.onBack = function () { var r = ob ? ob() : false; setTimeout(function () { if (!cur || !visible(cur)) focus(home()); }, 80); return r; };
    focus(document.querySelector(".tab.active") || home(), true);
  }, 300);
})();
