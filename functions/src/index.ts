// 서버 기능 진입점. callable은 functions/src/callable/<영역>.ts에 두고 이 파일에서 이름으로 다시 내보낸다.
// 그때 firebase.json에 `/fn/{이름}` rewrite도 추가한다 (rewrites.test.ts가 검사).
import './global'

export { completeOnboarding } from './callable/account'
export { setWorkspaceLimit } from './callable/usage'
export { cancelAiJob, retryAiJob, startAiJob } from './callable/jobs'
export { createEpisode, deleteToTrash, duplicateEpisode } from './callable/episodes'
export { purgeFromTrash, restoreFromTrash } from './callable/trash'
export { cleanupCandidates, storageUsage } from './callable/assets'
export { intakeStatus, submitIntake, withdrawIntake } from './callable/intake'
export { reportPage, reportSubmission, resolveReport } from './callable/reports'
export { decideWaitlist, joinWaitlist } from './callable/waitlist'
export { createWorkspace, deleteAccount, deleteWorkspace, restoreWorkspace, switchWorkspace, transferOwnership } from './callable/workspaces'
export { acceptInvite, createInvite, inviteInfo, leaveWorkspace, removeMember, revokeInvite, setMemberLimit, setMemberRole } from './callable/members'
export { adminOverview, logAdminView } from './callable/admin'
export { runAiJob } from './ai/run'
export { purgeExpiredTrash } from './scheduled/trash'
export { purgeDeleted } from './scheduled/workspaces'
