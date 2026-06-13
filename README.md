# UX Report 2026 — 발표용 웹사이트

피그마 슬라이드(이미지) 위에 클릭영역(hotspot)을 얹어 링크로 연결하고, 개발된 웹 서비스를
사이트 안 iframe으로 시연할 수 있는 발표용 SPA입니다.

- **라이브**: https://lgu-ux-slides.netlify.app  (편집: `/admin`)
- **저장소**: https://github.com/lguuxe/lgu-ux-slides  (`main` push → Netlify 자동 재배포)

## 실행

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/ 생성
npm run preview  # 빌드 결과 미리보기
```

## 구조

```
public/
  slides.json        ← 모든 내용(슬라이드/순서/계층/링크/데모)의 원본 데이터
  slides/*.svg       ← 슬라이드 이미지(피그마 export로 교체)
src/
  data/DataContext   ← slides.json 로드 + 로컬 편집본 관리(localStorage)
  components/         ← Sidebar, SlideView, Hotspot, DemoView, BackButton
  pages/Editor       ← /admin 편집 화면
```

## 핵심 개념

- **슬라이드** = 이미지 1장 + 그 위의 hotspot(투명 클릭영역) 목록. 모두 `slides.json`에 정의됩니다.
- **네비게이션 계층** = `nav` 배열(섹션 → 슬라이드). 사이드바 좌측에 그대로 표현됩니다.
- **부록(appendix)** = `slides`에는 있지만 `nav`에 없는 슬라이드. 메뉴엔 안 보이고 hotspot 링크로만 진입.
- **데모** = `demos` 배열(배포된 URL). 사이드바 "라이브 시연"에서 진입, 사이트 내부 iframe으로 표시.
- **백 버튼** = 어떤 경로(부록/데모)로 이동했든 브라우저 히스토리로 이전 화면 복귀.
- **좌우 화살표 키** = 덱 안에서 이전/다음 슬라이드 이동.

## 슬라이드 가져오기 (피그마 → 이미지)

비율은 제각각이어도 됩니다 (hotspot 좌표가 % 기반).

### 방법 1 — Figma 링크 (권장, 실시간 렌더)

`/admin`에서 슬라이드의 **"Figma 프레임 링크"** 에 프레임 URL을 붙여넣으면, 아래 미리보기가
**그 프레임의 현재 캡쳐**로 바로 바뀝니다. 발표 화면에서도 `figma-image` 서버리스 함수가
런타임에 Figma를 렌더하므로, **피그마에서 수정하면 재배포 없이 자동 반영**됩니다.
(함수는 결과를 Netlify Blobs에 캐시해, Figma가 잠시 느리거나 불통이어도 마지막 캡쳐를 보여줍니다.)

준비물은 **Figma 토큰 하나**뿐:
- Figma → Settings → Security → *Personal access tokens* → `Generate new token`
  (scope: **File content – Read**)
- Netlify → Site configuration → Environment variables → `FIGMA_TOKEN` 등록
  (절대 코드/깃에 커밋 금지 — 서버에서만 사용)

링크 형식: `https://www.figma.com/design/<fileKey>/...?node-id=1-23`

### 방법 2 — 수동 이미지

1. 피그마에서 프레임을 PNG(2x) / SVG로 export → `public/slides/` 에 저장.
2. `/admin`에서 Figma 링크를 비우면 나타나는 "이미지 경로"에 `/slides/파일명.png` 지정.

## 편집 모드 (`/admin`)

- **구조 패널**: 섹션/슬라이드 추가·삭제·순서변경(↑↓), 다른 섹션으로 이동, 부록·데모 관리.
- **상세 패널**: Figma 링크 붙여넣기 → 미리보기 즉시 갱신. 이미지 위에서 **드래그하면 클릭영역(링크) 생성**,
  생성된 영역을 클릭 → 라벨과 링크 대상(슬라이드/부록 · 데모 · 외부 URL) 지정.
- 편집 내용은 이 브라우저에 자동 저장(초안)되고, 좌측 상단 **「저장」** 을 누르면 서버(Netlify Blobs)에
  저장되어 **모든 사용자에게 반영**됩니다. 저장에는 `EDIT_PASSWORD`(Netlify env)가 필요합니다.
- **`↺ 되돌리기`** 로 저장 안 된 변경을 버리고 마지막 저장본을 불러옵니다.
- **`⬇ 내보내기 / ⬆ 불러오기`** 는 JSON 백업/복구용.

데이터 로드 우선순위: 로컬 초안 → 서버(Blobs, `/.netlify/functions/slides`) → 기본본(`public/slides.json`).

## Netlify 배포

`netlify.toml` 포함 (build=`npm run build`, publish=`dist`, functions=`netlify/functions`, SPA 리다이렉트).

- **권장 — Git 연동**: GitHub repo를 Netlify에 연결 → `main` push 시 자동 빌드/배포.
- 필요한 환경변수: `FIGMA_TOKEN`(Figma 실시간 렌더), `EDIT_PASSWORD`(편집 저장).
- 함수: `slides`(Blobs 게시/조회), `figma-image`(Figma 프레임 실시간 렌더+캐시).

## iframe 시연 주의

일부 서비스는 `X-Frame-Options` / `Content-Security-Policy: frame-ancestors` 로 iframe 삽입을
차단합니다. 이 경우 데모 화면이 비어 보이며, "새 탭에서 열기"로 대체하거나, 해당 서비스 쪽에서
이 사이트 도메인을 frame-ancestors 에 허용해야 합니다.
