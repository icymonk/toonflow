import type { CleanupInput, UsageInput } from './assets'
import type { CompleteOnboardingInput, CompleteOnboardingOutput } from './account'
import type { CreateEpisodeInput, DuplicateEpisodeInput, TrashInput } from './episodes'
import type { IntakeStatus, IntakeSubmitInput, IntakeTokenInput } from './intake'
import type { ReportPageInput, ReportSubmissionInput, ResolveReportInput } from './reports'
import type { JobRefInput, StartAiJobInput } from './jobs'
import type { TrashItemInput } from './trash'
import type { DecideWaitlistInput, JoinWaitlistInput } from './waitlist'
import type { CreateWorkspaceInput, DeleteAccountInput, TransferOwnershipInput, WorkspaceRefInput } from './workspaces'
import type { AdminOverview, AdminOverviewInput, LogAdminViewInput } from './activity'
import type { CreateInviteInput, InviteInfo, InviteTokenInput, MemberRefInput, RevokeInviteInput, SetMemberLimitInput, SetMemberRoleInput } from './members'
import type { GrantPlanInput, SetWorkspaceLimitInput } from './usage'
import type { ConnectInstagramInput, InstagramWorkspaceInput, PublishInstagramInput } from './instagram'

/** 서버 기능 오류 메시지 키. 화면 문구는 app/locales/ko.ts의 errors에서 키로 찾는다 */
export const ERROR_KEYS = {
  unauthenticated: 'error.unauthenticated',
  invalidInput: 'error.invalidInput',
  internal: 'error.internal',
  notAllowed: 'error.notAllowed',
  notMember: 'error.notMember',
  forbidden: 'error.forbidden',
  limitExceeded: 'error.limitExceeded',
  modelUnavailable: 'error.modelUnavailable',
  seriesNotEmpty: 'error.seriesNotEmpty',
  intakeClosed: 'error.intakeClosed',
  tooShort: 'error.tooShort',
  bannedWord: 'error.bannedWord',
  tooMany: 'error.tooMany',
  tokenNotFound: 'error.tokenNotFound',
  lastWorkspace: 'error.lastWorkspace',
  ownsWorkspace: 'error.ownsWorkspace',
  tooManyWorkspaces: 'error.tooManyWorkspaces',
  notAdminTarget: 'error.notAdminTarget',
  ownerCannotLeave: 'error.ownerCannotLeave',
  overPlan: 'error.overPlan',
  instagramNotConfigured: 'error.instagramNotConfigured',
  instagramNotConnected: 'error.instagramNotConnected',
  instagramFailed: 'error.instagramFailed',
  instagramBusy: 'error.instagramBusy',
} as const

export type ErrorKey = (typeof ERROR_KEYS)[keyof typeof ERROR_KEYS]

/** callable 이름 → 입력·출력 타입. 새 callable을 만들면 여기에 등록한다 (docs/dev/functions.md 2절) */
export interface Callables {
  completeOnboarding: { input: CompleteOnboardingInput, output: CompleteOnboardingOutput }
  setWorkspaceLimit: { input: SetWorkspaceLimitInput, output: { ok: true } }
  startAiJob: { input: StartAiJobInput, output: { jobId: string } }
  cancelAiJob: { input: JobRefInput, output: { ok: true } }
  retryAiJob: { input: JobRefInput, output: { ok: true } }
  createEpisode: { input: CreateEpisodeInput, output: { episodeId: string } }
  duplicateEpisode: { input: DuplicateEpisodeInput, output: { episodeId: string } }
  deleteToTrash: { input: TrashInput, output: { ok: true } }
  restoreFromTrash: { input: TrashItemInput, output: { ok: true } }
  purgeFromTrash: { input: TrashItemInput, output: { ok: true } }
  cleanupCandidates: { input: CleanupInput, output: { deleted: number } }
  submitIntake: { input: IntakeSubmitInput, output: { ok: true, token: string } }
  intakeStatus: { input: IntakeTokenInput, output: IntakeStatus }
  withdrawIntake: { input: IntakeTokenInput, output: { ok: true } }
  reportPage: { input: ReportPageInput, output: { ok: true } }
  reportSubmission: { input: ReportSubmissionInput, output: { ok: true } }
  resolveReport: { input: ResolveReportInput, output: { ok: true } }
  joinWaitlist: { input: JoinWaitlistInput, output: { ok: true } }
  decideWaitlist: { input: DecideWaitlistInput, output: { ok: true } }
  createWorkspace: { input: CreateWorkspaceInput, output: { workspaceId: string } }
  switchWorkspace: { input: WorkspaceRefInput, output: { ok: true } }
  deleteWorkspace: { input: WorkspaceRefInput, output: { deleteAt: number } }
  restoreWorkspace: { input: WorkspaceRefInput, output: { ok: true } }
  transferOwnership: { input: TransferOwnershipInput, output: { ok: true } }
  deleteAccount: { input: DeleteAccountInput, output: { ok: true } }
  createInvite: { input: CreateInviteInput, output: { token: string, expiresAt: number } }
  revokeInvite: { input: RevokeInviteInput, output: { ok: true } }
  inviteInfo: { input: InviteTokenInput, output: InviteInfo }
  acceptInvite: { input: InviteTokenInput, output: { workspaceId: string } }
  setMemberRole: { input: SetMemberRoleInput, output: { ok: true } }
  removeMember: { input: MemberRefInput, output: { ok: true } }
  leaveWorkspace: { input: WorkspaceRefInput, output: { ok: true } }
  setMemberLimit: { input: SetMemberLimitInput, output: { ok: true } }
  adminOverview: { input: AdminOverviewInput, output: AdminOverview }
  logAdminView: { input: LogAdminViewInput, output: { episodes: number, submissions: number, members: number } }
  grantPlan: { input: GrantPlanInput, output: { ok: true } }
  storageUsage: { input: UsageInput, output: { ai: number, refs: number, total: number } }
  instagramAuthUrl: { input: InstagramWorkspaceInput, output: { url: string } }
  connectInstagram: { input: ConnectInstagramInput, output: { username: string } }
  disconnectInstagram: { input: InstagramWorkspaceInput, output: { ok: true } }
  publishInstagram: { input: PublishInstagramInput, output: { ok: true } }
}
