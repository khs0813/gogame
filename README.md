# 바둑 한 수 | 围棋一手

한국어와 간체 중국어를 지원하는 브라우저 전용 바둑 대국·학습 사이트입니다. 초급, 중급, 고급 컴퓨터와 9×9, 13×13, 19×19 바둑을 둘 수 있습니다.

## 주요 기능

- 초급·중급·고급 연습용 컴퓨터 대국
- 중국식 면적 계가, 7.5집 덤, 자살수 금지, 상황적 슈퍼코
- 두 번 연속 패스 후 죽은 돌 확인과 최종 계가
- 모바일과 13×13·19×19에서 후보 선택 → 확대 미리보기 → 착수 확정
- 키보드 조작, 스크린리더 상태 알림, 반응형 디자인
- 한국어 `/ko/`, 간체 중국어 `/zh-cn/`, 언어 선택 `/`, 난이도별 정적 SEO 페이지 6개 및 규칙 설명 페이지 2개
- canonical, 상호 hreflang, Open Graph, JSON-LD, sitemap.xml, rss.xml, robots.txt 자동 생성
- 대국·계가 상태 브라우저 저장, 외부 API·로그인·데이터베이스 불필요

> 고급 코스도 전문 기사급 AI가 아닌 학습용 휴리스틱 AI입니다.

## 로컬 실행

```bash
npm install
npm run dev
```

테스트와 정적 빌드:

```bash
npm test
npm run typecheck
npm run validate
```

`validate`는 프로덕션 빌드 후 11개 HTML 경로, canonical/hreflang, JSON-LD, sitemap/RSS/robots, AI Worker 번들을 함께 검사합니다. 빌드 결과는 `dist` 폴더에 생성됩니다.

## Render Static Site 배포

저장소를 GitHub에 올린 뒤 Render에서 `New > Blueprint`를 선택하면 `render.yaml` 설정이 자동 적용됩니다.

- Build command: `npm ci && npm test && npm run validate`
- Publish directory: `dist`
- 환경변수 `SITE_URL`: 실제 배포 주소 또는 커스텀 도메인(예: `https://example.com`)

기본값은 `https://baduk-ai-course.onrender.com`입니다. Render 서비스 이름을 바꾸거나 커스텀 도메인을 사용한다면 `SITE_URL`을 반드시 실제 주소로 변경해야 canonical, sitemap, robots 주소가 일치합니다.

배포 후 다음 작업을 권장합니다.

1. Google Search Console에 도메인 등록 및 `/sitemap.xml` 제출
2. 네이버 서치어드바이저에 사이트 등록 후 `/sitemap.xml`과 `/rss.xml` 제출
3. 중국 검색 노출이 필요하면 百度搜索资源平台에 사이트와 사이트맵 제출
4. apex 도메인과 `www` 중 하나만 사용하고 다른 주소는 301 리디렉션

## 기술 구성

- React 19 + TypeScript + Vite
- Web Worker 기반 브라우저 AI
- 다중 HTML 정적 빌드
- Vitest 규칙 엔진 테스트

서버와 외부 CDN을 사용하지 않아 Render 정적 사이트로 저렴하게 운영할 수 있습니다.
