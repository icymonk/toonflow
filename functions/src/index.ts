// 서버 기능 진입점. callable은 functions/src/callable/<영역>.ts에 두고 이 파일에서 이름으로 다시 내보낸다.
// 그때 firebase.json에 `/fn/{이름}` rewrite도 추가한다 (rewrites.test.ts가 검사).
import './global'

export { completeOnboarding } from './callable/account'
