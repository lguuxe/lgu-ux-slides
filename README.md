# UX Report 2026 — 발표용 웹사이트

피그마 슬라이드(이미지) 위에 클릭영역(hotspot)을 얹어 링크로 연결하고, 개발된 웹 서비스를
사이트 안 iframe으로 시연할 수 있는 발표용 SPA입니다.

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

두 가지 방법을 모두 지원합니다. 비율은 제각각이어도 됩니다 (hotspot 좌표가 % 기반).

### 방법 1 — Figma 링크 자동 캡쳐 (권장, 빌드 시 bake)

각 슬라이드에 **Figma 프레임 링크**만 지정하면, 빌드(재배포) 때 스크립트가 그 프레임을
PNG로 렌더해 `public/slides/<slideId>.png` 로 굽고 이미지 경로를 자동 교체합니다.
**Figma에서 수정 → 재배포하면 최신 상태로 다시 캡쳐**됩니다.

1. **Figma 토큰 발급**: Figma → Settings → Security → *Personal access tokens* →
   `Generate new token` (scope: **File content – Read**). 토큰 문자열을 복사.
2. **Netlify 환경변수 등록**: Site configuration → Environment variables →
   `FIGMA_TOKEN` = 복사한 토큰. (절대 코드/깃에 커밋하지 마세요 — 클라이언트에 노출 금지)
3. **프레임 링크 지정**: `/admin`에서 슬라이드를 고르고 "Figma 프레임 링크"에
   `https://www.figma.com/design/<fileKey>/...?node-id=1-23` 형태로 붙여넣기 →
   내보내기 후 `public/slides.json` 커밋. (또는 slides.json의 슬라이드에 `"figmaUrl": "..."` 직접 추가)
4. **재캡쳐(=재배포)**: `/admin`의 **⟳ Figma 캡쳐·재배포** 버튼(최초 1회 Netlify *Build hook* URL 입력),
   또는 Netlify에서 Trigger deploy.

로컬에서 미리 캡쳐해보려면:
```bash
export FIGMA_TOKEN=figd_xxx
npm run capture     # public/slides.json의 figmaUrl들을 캡쳐
```
> `FIGMA_TOKEN`이 없으면 캡쳐는 **건너뛰고** 기존 이미지를 그대로 씁니다 (빌드는 정상).

### 방법 2 — 수동 export

1. 피그마에서 프레임을 PNG(2x) / SVG로 export → `public/slides/` 에 저장.
2. `/admin`에서 "이미지 경로"를 `/slides/파일명.png` 로 지정 (figmaUrl은 비움).

## 편집 모드 (`/admin`)

- **구조 패널**: 섹션/슬라이드 추가·삭제·순서변경(↑↓), 다른 섹션으로 이동, 부록·데모 관리.
- **상세 패널**: 슬라이드 이미지 위에서 **드래그하면 클릭영역(링크) 생성**.
  생성된 영역을 클릭 → 아래에서 라벨과 링크 대상(슬라이드/부록 · 데모 · 외부 URL) 지정.
- 편집 내용은 이 브라우저에 자동 저장(localStorage)됩니다.
- **`⬇ slides.json 내보내기`** 로 파일을 받아 `public/slides.json` 을 덮어쓰고 커밋/배포하면
  모두에게 반영됩니다. (정적 사이트라 편집은 브라우저 로컬 → export → 배포 흐름)
- **`↺ 배포본으로 초기화`** 로 로컬 편집본을 버리고 배포된 `slides.json` 으로 되돌립니다.

## Netlify 배포

`netlify.toml` 이 이미 포함되어 있습니다 (build=`npm run build`, publish=`dist`, SPA 리다이렉트).

- **방법 A (Git 연동)**: GitHub 등에 푸시 → Netlify에서 저장소 선택 → 자동 빌드/배포.
- **방법 B (드래그&드롭)**: `npm run build` 후 `dist/` 폴더를 Netlify에 드롭.
- **방법 C (CLI)**: `npx netlify deploy --prod` (빌드 후 `dist` 지정).

## iframe 시연 주의

일부 서비스는 `X-Frame-Options` / `Content-Security-Policy: frame-ancestors` 로 iframe 삽입을
차단합니다. 이 경우 데모 화면이 비어 보이며, "새 탭에서 열기"로 대체하거나, 해당 서비스 쪽에서
이 사이트 도메인을 frame-ancestors 에 허용해야 합니다.
