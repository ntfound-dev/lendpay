import type {
  ActivityItem,
  ChallengeRecord,
  CreditScoreState,
  LoanRequestState,
  LoanState,
  OperatorActionRecord,
  OracleSnapshot,
  SessionRecord,
  UserProfile,
} from '../types/domain.js'

export class MemoryStore {
  activities = new Map<string, ActivityItem[]>()
  challenges = new Map<string, ChallengeRecord>()
  loanRequests = new Map<string, LoanRequestState>()
  loans = new Map<string, LoanState>()
  operatorActions: OperatorActionRecord[] = []
  oracleSnapshots: OracleSnapshot[] = []
  scores = new Map<string, CreditScoreState[]>()
  sessions = new Map<string, SessionRecord>()
  users = new Map<string, UserProfile>()
}

export const store = new MemoryStore()
