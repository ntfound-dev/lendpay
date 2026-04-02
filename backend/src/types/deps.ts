import type { ConnectOracleClient } from '../integrations/connect/oracle.js'
import type { UsernamesClient } from '../integrations/l1/usernames.js'
import type { RollupClient } from '../integrations/rollup/client.js'
import type { ActivityService } from '../modules/activity/service.js'
import type { AuthService } from '../modules/auth/service.js'
import type { LoanService } from '../modules/loans/service.js'
import type { RepaymentService } from '../modules/repayments/service.js'
import type { ProtocolService } from '../modules/protocol/service.js'
import type { ScoreService } from '../modules/scores/service.js'
import type { UserService } from '../modules/users/service.js'

export interface AppDeps {
  activityService: ActivityService
  authService: AuthService
  loanService: LoanService
  oracleClient: ConnectOracleClient
  protocolService: ProtocolService
  repaymentService: RepaymentService
  rollupClient: RollupClient
  scoreService: ScoreService
  userService: UserService
  usernamesClient: UsernamesClient
}
