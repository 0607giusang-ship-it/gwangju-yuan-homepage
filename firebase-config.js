// ─────────────────────────────────────────────────────────────────────────────
// 광주유안교회 홈페이지 — Firebase 연결 정보
//
// 이 값들은 브라우저에 그대로 노출됩니다. 그래도 괜찮습니다 — Firebase 웹 설정값은
// 원래 공개되는 값이고, 실제 보호는 서버 규칙(firestore.rules)이 담당합니다.
// 비밀번호는 이 파일 어디에도 없습니다(Firebase 인증 서버가 검사합니다).
//
// 프로젝트는 중보기도요청 앱과 같은 uanchurch-1 을 함께 씁니다. 다만 저장 위치를
// homepage / homepage_images 로 나눠 두어 기도 요청 데이터와 절대 섞이지 않습니다.
// ─────────────────────────────────────────────────────────────────────────────

window.HOMEPAGE_FB = {
  projectId: "uanchurch-1",
  apiKey: "AIzaSyB7XbuLzhI-SCTugfdAq5isOFNHvKzN_yg",

  // 관리자 계정의 이메일. 오너는 비밀번호만 입력하면 되도록 여기에 적어 둡니다.
  // (이메일이 공개돼도 비밀번호 없이는 아무것도 못 합니다.)
  adminEmail: "uanchurch0607@gmail.com",
};

// 카테고리별로 남겨 둘 최신 영상 개수.
// 관리자가 새 영상을 넣으면 이 개수를 넘는 옛 항목은 저장할 때 자동으로 밀려난다 —
// 목사님이 옛 영상을 손으로 지우지 않아도 목록이 알아서 정리된다.
// ★홈페이지(content.js)와 관리자 화면(admin.html)이 **같은 값을 봐야** 하므로 여기에 둔다.
//   한쪽에만 적어 두면 나중에 값을 바꿀 때 다른 쪽이 조용히 뒤처진다.
window.HOMEPAGE_KEEP_LATEST = {
  sunday: 8,   // 주일예배 설교
  daily: 8,    // 한 구절 말씀묵상
  shorts: 6,   // 숏츠
};

// Firestore REST 주소를 만들어 주는 도우미. SDK 를 따로 받지 않아 페이지가 가볍습니다.
window.HOMEPAGE_FB.docUrl = function (path) {
  return (
    "https://firestore.googleapis.com/v1/projects/" +
    window.HOMEPAGE_FB.projectId +
    "/databases/(default)/documents/" +
    path +
    "?key=" +
    window.HOMEPAGE_FB.apiKey
  );
};
