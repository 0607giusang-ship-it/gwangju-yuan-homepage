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

  // 글(staff·worship·news)은 관리자가 언제든 고칠 수 있으므로 늘 새로 받아 온다(no-store).
  // 사진(homepage_images)은 다르다 — 사진 문서 이름에 올린 시각이 박혀 있어서 **한 번 만들어진
  // 문서의 내용은 절대 바뀌지 않는다**(사진을 바꾸면 이름이 다른 새 문서가 생긴다). 그래서
  // 브라우저가 받아 둔 것을 다시 써도 언제나 맞다. 사진은 글보다 수십 배 크기 때문에, 이걸
  // 매번 다시 받으면 무료 요금제의 한 달 전송량을 방문 몇 천 번으로 다 써 버린다.
  function getDoc(path, cacheable) {
    return fetch(FB.docUrl(path), { cache: cacheable ? "default" : "no-store" }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    }).then(function (doc) {
      return fields(doc.fields || {});
    });
  }

  function getImageDoc(id) {
    return getDoc("homepage_images/" + encodeURIComponent(id), true);
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
    getImageDoc(photoId).then(function (d) {
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
      getImageDoc(data.image).then(function (d) {
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

  // ── ④ 말씀의 길 (주일예배 설교 / 한 구절 말씀묵상 / 숏츠) ──────────────────
  //
  // 세 갈래는 화면에 담기는 내용이 서로 다르다. 마크업을 그대로 다시 만들어야 지금 보이는
  // 모양이 한 픽셀도 안 바뀌므로, 갈래마다 따로 그린다.
  //   sunday 제목 + 성경구절(또는 '주일예배 전체 영상') + '주일예배 설교 · YY.MM.DD'
  //   daily  제목과 라벨은 늘 같고 날짜만 바뀐다 -> 고정값은 여기서 붙인다
  //   shorts 두 줄짜리 캡션만
  var DAILY_TITLE = "한 구절 말씀묵상";
  var DAILY_LABEL = "매일 1~2분";

  // 주소가 이상하면 아예 그리지 않는다. 관리자만 쓸 수 있는 자리지만, 값이 어떤 경로로든
  // 뒤틀렸을 때 javascript: 같은 주소가 링크로 걸리는 일은 원천적으로 막는다.
  function safeHref(u) {
    var s = String(u || "").trim();
    return /^https:\/\//i.test(s) ? s : null;
  }

  function videoLink(cls, href) {
    var a = el("a", cls);
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener";
    return a;
  }

  function renderSermons(data) {
    var groups = {
      sunday: document.querySelector('.cat-group[data-cat="sunday"]'),
      daily: document.querySelector('.cat-group[data-cat="daily"]'),
      // 숏츠는 목록 아래 고정 안내문이 같이 들어 있으므로 **줄(strip)만** 갈아끼운다.
      shorts: document.querySelector('.cat-group[data-cat="shorts"] .shorts-strip')
    };

    // 주일예배 설교
    if (groups.sunday && isNonEmptyArray(data.sunday)) {
      var f1 = document.createDocumentFragment();
      data.sunday.forEach(function (v) {
        var href = v && safeHref(v.href);
        if (!href || !v.t) return;
        var a = videoLink("sermon-row", href);
        var left = el("div", "left");
        left.appendChild(el("span", "t", v.t));
        if (v.ref) left.appendChild(el("span", "ref", v.ref));
        a.appendChild(left);
        a.appendChild(el("span", "cat", v.cat || ""));
        f1.appendChild(a);
      });
      if (f1.childNodes.length) { groups.sunday.innerHTML = ""; groups.sunday.appendChild(f1); }
    }

    // 한 구절 말씀묵상
    if (groups.daily && isNonEmptyArray(data.daily)) {
      var f2 = document.createDocumentFragment();
      data.daily.forEach(function (v) {
        var href = v && safeHref(v.href);
        if (!href) return;
        var a = videoLink("sermon-row", href);
        var left = el("div", "left");
        left.appendChild(el("span", "t", DAILY_TITLE));
        left.appendChild(el("span", "ref", v.ref || ""));
        a.appendChild(left);
        a.appendChild(el("span", "cat", DAILY_LABEL));
        f2.appendChild(a);
      });
      if (f2.childNodes.length) { groups.daily.innerHTML = ""; groups.daily.appendChild(f2); }
    }

    // 숏츠
    if (groups.shorts && isNonEmptyArray(data.shorts)) {
      var f3 = document.createDocumentFragment();
      data.shorts.forEach(function (v) {
        var href = v && safeHref(v.href);
        if (!href) return;
        var a = videoLink("shorts-chip", href);
        var cap = el("div", "cap");
        // 캡션은 두 줄이다. 줄바꿈을 글자로 넣지 않고 <br> 요소로 만든다
        // (내용을 그대로 화면에 박아 넣지 않으므로 글자가 태그로 해석될 일이 없다).
        String(v.cap || "").split(String.fromCharCode(10)).forEach(function (line, i) {
          if (i) cap.appendChild(document.createElement("br"));
          cap.appendChild(document.createTextNode(line));
        });
        a.appendChild(cap);
        f3.appendChild(a);
      });
      if (f3.childNodes.length) { groups.shorts.innerHTML = ""; groups.shorts.appendChild(f3); }
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
  load("homepage/sermons", renderSermons);
})();
