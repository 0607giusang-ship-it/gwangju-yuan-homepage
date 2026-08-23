// ─────────────────────────────────────────────────────────────────────────────
// 홈페이지 내용 불러오기 — 관리자가 admin.html 에서 고친 내용을 화면에 반영한다.
//
// ★설계에서 가장 중요한 약속: **여기가 실패해도 화면은 멀쩡해야 한다.**
//   index.html 에는 지금 내용이 그대로 적혀 있고(하드코딩), 이 스크립트는 성공했을 때만
//   그 자리를 갈아끼운다. 그래서 인터넷이 끊겨도, Firestore 가 막혀도, 이 파일이 안
//   내려와도 방문자는 빈 화면 대신 마지막으로 배포된 내용을 본다.
//
// 저장 위치(중보기도요청 데이터와 분리):
//   homepage/staff    사역자 소개
//   homepage/worship  예배시간
//   homepage/news     이번 주 교회소식
//   homepage_images/{id}  사진 1장 = 문서 1개 (압축된 그림 데이터)
//
// Firestore REST 를 그대로 쓴다(SDK 를 받지 않는다) — 페이지에 붙는 무게가 몇 KB 뿐이다.
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  "use strict";

  var FB = window.HOMEPAGE_FB;
  if (!FB || !window.fetch) return; // 설정이 없거나 아주 옛 브라우저면 하드코딩 내용 그대로.

  // ── Firestore 가 쓰는 값 표기법을 평범한 자바스크립트 값으로 되돌린다 ──────────
  // Firestore REST 는 { stringValue: "..." } 처럼 타입을 붙여서 값을 준다.
  function plain(v) {
    if (v === null || v === undefined) return null;
    if ("stringValue" in v) return v.stringValue;
    if ("integerValue" in v) return Number(v.integerValue);
    if ("doubleValue" in v) return Number(v.doubleValue);
    if ("booleanValue" in v) return v.booleanValue;
    if ("nullValue" in v) return null;
    if ("timestampValue" in v) return v.timestampValue;
    if ("arrayValue" in v) return (v.arrayValue.values || []).map(plain);
    if ("mapValue" in v) return fields(v.mapValue.fields || {});
    return null;
  }
  function fields(f) {
    var out = {};
    for (var k in f) {
      if (Object.prototype.hasOwnProperty.call(f, k)) out[k] = plain(f[k]);
    }
    return out;
  }

  function getDoc(path) {
    return fetch(FB.docUrl(path), { cache: "no-store" }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    }).then(function (doc) {
      return fields(doc.fields || {});
    });
  }

  // ── 화면 만들기 도우미 (기존 CSS 클래스를 그대로 쓴다) ────────────────────────
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }
  function isNonEmptyArray(a) { return Object.prototype.toString.call(a) === "[object Array]" && a.length > 0; }

  // 사진을 실제로 그려 넣는다. 사진 문서를 못 받으면 원래 사진(하드코딩)을 그대로 둔다.
  function applyPhoto(imgNode, photoId) {
    if (!imgNode || !photoId) return;
    getDoc("homepage_images/" + encodeURIComponent(photoId)).then(function (d) {
      if (d && typeof d.dataUrl === "string" && d.dataUrl.indexOf("data:image/") === 0) {
        imgNode.src = d.dataUrl;
      }
    }).catch(function () { /* 원래 사진 유지 */ });
  }

  // ── ① 함께 섬기는 이들 ────────────────────────────────────────────────────
  function renderStaff(data) {
    var grid = document.getElementById("staffGrid");
    if (!grid || !isNonEmptyArray(data.members)) return;

    var frag = document.createDocumentFragment();
    data.members.forEach(function (m, i) {
      if (!m || !m.name) return;
      var col = el("div", "staff-col");

      var img = el("img", "staff-photo");
      // 관리자가 사진을 안 바꾼 자리는 원래 쓰던 사진 파일을 그대로 쓴다.
      img.src = m.fallbackPhoto || ("img/staff-" + (i + 1) + ".jpg");
      img.alt = m.name + (m.role ? " " + m.role : "");
      col.appendChild(img);

      col.appendChild(el("div", "staff-name", m.name));
      if (m.role) col.appendChild(el("div", "staff-role", m.role));

      [["학력", m.education], ["사역", m.ministry]].forEach(function (pair) {
        if (!isNonEmptyArray(pair[1])) return;
        var block = el("div", "staff-block");
        block.appendChild(el("div", "label", pair[0]));
        var ul = document.createElement("ul");
        pair[1].forEach(function (line) {
          if (line) ul.appendChild(el("li", null, line));
        });
        block.appendChild(ul);
        col.appendChild(block);
      });

      frag.appendChild(col);
      applyPhoto(img, m.photo);
    });

    if (frag.childNodes.length) {
      grid.innerHTML = "";
      grid.appendChild(frag);
    }
  }

  // ── ② 예배시간 ────────────────────────────────────────────────────────────
  function renderWorship(data) {
    var box = document.getElementById("worshipBody");
    if (!box) return;
    var hasPrimary = data.primary && data.primary.name && data.primary.time;
    if (!hasPrimary && !isNonEmptyArray(data.tiers)) return;

    var frag = document.createDocumentFragment();

    if (hasPrimary) {
      var p = el("div", "ws-primary");
      p.appendChild(el("span", "ws-name", data.primary.name));
      p.appendChild(el("span", "ws-time", data.primary.time));
      frag.appendChild(p);
    }

    (isNonEmptyArray(data.tiers) ? data.tiers : []).forEach(function (t) {
      if (!t || !isNonEmptyArray(t.rows)) return;
      var tier = el("div", "worship-tier");
      if (t.label) tier.appendChild(el("div", "wt-label", t.label));
      var sub = el("div", "sub-times");
      t.rows.forEach(function (r) {
        if (!r || !r.name) return;
        var row = el("div", "row");
        row.appendChild(el("span", null, r.name));
        row.appendChild(el("span", null, r.time || ""));
        sub.appendChild(row);
      });
      tier.appendChild(sub);
      frag.appendChild(tier);
    });

    if (frag.childNodes.length) {
      box.innerHTML = "";
      box.appendChild(frag);
    }

    // 예배시간 안내 그림(선택). 관리자가 올렸을 때만 표 아래에 붙는다.
    if (data.image) {
      getDoc("homepage_images/" + encodeURIComponent(data.image)).then(function (d) {
        if (!d || typeof d.dataUrl !== "string" || d.dataUrl.indexOf("data:image/") !== 0) return;
        var holder = document.getElementById("worshipImage");
        if (!holder) return;
        var img = el("img", "worship-image");
        img.src = d.dataUrl;
        img.alt = "예배시간 안내";
        holder.innerHTML = "";
        holder.appendChild(img);
        holder.hidden = false;
      }).catch(function () {});
    }
  }

  // ── ③ 이번 주 교회소식 ────────────────────────────────────────────────────
  function renderNews(data) {
    var list = document.getElementById("newsList");
    if (!list || !isNonEmptyArray(data.items)) return;

    var frag = document.createDocumentFragment();
    data.items.forEach(function (it) {
      if (!it || !it.title) return;
      var row = el("div", "news-row");
      var left = el("div", "left");
      left.appendChild(el("span", "t", it.title));
      if (it.detail) left.appendChild(el("span", "detail", it.detail));
      row.appendChild(left);
      row.appendChild(el("span", "d", it.when || ""));
      frag.appendChild(row);
    });

    if (frag.childNodes.length) {
      list.innerHTML = "";
      list.appendChild(frag);
    }
  }

  // ── 시작 ──────────────────────────────────────────────────────────────────
  // 세 곳을 따로 부른다. 하나가 실패해도 나머지는 반영되고, 실패한 자리는 원래 내용이 남는다.
  function load(path, render) {
    getDoc(path).then(function (d) {
      try { render(d); } catch (e) { /* 그리다 실패하면 원래 내용 유지 */ }
    }).catch(function () { /* 못 받으면 원래 내용 유지 */ });
  }

  load("homepage/staff", renderStaff);
  load("homepage/worship", renderWorship);
  load("homepage/news", renderNews);
})();
