# Polymarket Insider Tracker

폴리마켓 Tech 마켓의 내부자 매매를 추적하기 위한 대시보드입니다.

## 기능

- **Tech 마켓 목록**: Polymarket의 Tech 카테고리 마켓을 볼륨 순으로 정렬
- **실시간 가격**: 각 마켓의 Yes/No 가격 표시
- **TOP 10 홀더**: 마켓별 Yes/No 포지션 TOP 10 홀더 확인
- **프로필 링크**: 각 홀더의 Polymarket 프로필로 바로 이동

## 사용 목적

특정 계정이 특정 기업 관련 마켓 (OpenAI, Google, Apple 등)에만 집중 매매하는 패턴을 찾아 잠재적 내부자를 식별합니다.

## 기술 스택

- Next.js 14
- React 18
- Polymarket Gamma API
- Polymarket Data API

## 배포

1. GitHub에 푸시
2. Vercel에서 Import
3. 자동 배포 완료

## API 엔드포인트

- `GET /api/markets` - Tech 마켓 목록
- `GET /api/holders?market={conditionId}` - 마켓별 TOP 홀더

## 로컬 실행

```bash
npm install
npm run dev
```

## 라이센스

MIT
