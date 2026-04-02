import { mapLoan, serializeJson } from '../../db/mappers.js'
import { prisma } from '../../db/prisma.js'
import { AppError } from '../../lib/errors.js'
import type { ActivityService } from '../activity/service.js'
import type { RollupClient } from '../../integrations/rollup/client.js'
import type { ScoreService } from '../scores/service.js'
import type { UserService } from '../users/service.js'
import type { OnchainLoanSnapshot } from '../../types/domain.js'

const LOAN_ACTIVE = 10
const LOAN_REPAID = 11
const LOAN_DEFAULTED = 12
const COLLATERAL_NONE = 0
const COLLATERAL_LOCKED = 1
const COLLATERAL_RETURNED = 2
const COLLATERAL_LIQUIDATED = 3

const COLLATERAL_STATUS_MAP = {
  [COLLATERAL_NONE]: 'none',
  [COLLATERAL_LOCKED]: 'locked',
  [COLLATERAL_RETURNED]: 'returned',
  [COLLATERAL_LIQUIDATED]: 'liquidated',
} as const

const scheduleFromOnchainLoan = (loan: OnchainLoanSnapshot) =>
  Array.from({ length: loan.installmentsTotal }, (_, index) => {
    const installmentNumber = index + 1
    const dueAt = new Date((loan.issuedAtSeconds + installmentNumber * 30 * 24 * 60 * 60) * 1000)

    return {
      installmentNumber,
      amount: loan.installmentAmount,
      dueAt: dueAt.toISOString(),
      status:
        loan.status === LOAN_REPAID || installmentNumber <= loan.installmentsPaid
          ? ('paid' as const)
          : installmentNumber === loan.installmentsPaid + 1
            ? ('due' as const)
            : ('upcoming' as const),
    }
  })

export class RepaymentService {
  constructor(
    private rollupClient: RollupClient,
    private userService: UserService,
    private activityService: ActivityService,
    private scoreService: ScoreService,
  ) {}

  async repay(initiaAddress: string, loanId: string, txHash?: string) {
    await this.userService.ensureUser(initiaAddress)

    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
    })

    if (!loan || loan.initiaAddress !== initiaAddress) {
      throw new AppError(404, 'LOAN_NOT_FOUND', 'Loan was not found.')
    }

    if (loan.status !== 'active') {
      throw new AppError(400, 'LOAN_NOT_ACTIVE', 'Only active loans can be repaid.')
    }

    const schedule = mapLoan(loan).schedule
    const nextInstallment = schedule.find((entry) => entry.status !== 'paid')

    if (!nextInstallment) {
      throw new AppError(400, 'LOAN_ALREADY_REPAID', 'This loan has already been settled.')
    }

    const repaymentTxHash = txHash || this.rollupClient.previewTxHash('repay')
    const numericLoanId = Number.parseInt(loan.id, 10)

    if (txHash && Number.isFinite(numericLoanId) && this.rollupClient.canRead()) {
      await this.rollupClient.waitForTx(txHash)
      const onchainLoan = await this.rollupClient.getLoanById(numericLoanId)
      const updatedLoan = await prisma.loan.update({
        where: { id: loan.id },
        data: {
          collateralAmount: onchainLoan.collateralAmount,
          collateralStatus:
            COLLATERAL_STATUS_MAP[
              onchainLoan.collateralState as keyof typeof COLLATERAL_STATUS_MAP
            ] ?? loan.collateralStatus,
          scheduleJson: serializeJson(scheduleFromOnchainLoan(onchainLoan)),
          installmentsPaid: onchainLoan.installmentsPaid,
          status:
            onchainLoan.status === LOAN_REPAID
              ? 'repaid'
              : onchainLoan.status === LOAN_DEFAULTED
                ? 'defaulted'
                : 'active',
        },
      })

      await this.userService.ensureUser(initiaAddress)
      await this.scoreService.analyze(initiaAddress)
      await this.activityService.push(initiaAddress, {
        kind: 'repayment',
        label: 'Installment paid',
        detail: `Installment ${nextInstallment.installmentNumber} settled successfully.`,
      })

      return {
        loan: mapLoan(updatedLoan),
        repaidInstallment: nextInstallment.installmentNumber,
        txHash,
        mode: 'live' as const,
      }
    }

    const updatedSchedule = schedule.map((entry) => {
      if (entry.installmentNumber !== nextInstallment.installmentNumber) {
        if (entry.status === 'upcoming' && entry.installmentNumber === nextInstallment.installmentNumber + 1) {
          return { ...entry, status: 'due' as const }
        }

        return entry
      }

      return {
        ...entry,
        status: 'paid' as const,
        txHash: repaymentTxHash,
      }
    })

    const installmentsPaid = updatedSchedule.filter((entry) => entry.status === 'paid').length
    const status = installmentsPaid === updatedSchedule.length ? ('repaid' as const) : ('active' as const)

    const updatedLoan = await prisma.loan.update({
      where: { id: loan.id },
      data: {
        collateralStatus:
          status === 'repaid' && loan.collateralAmount > 0 && loan.collateralStatus === 'locked'
            ? 'returned'
            : loan.collateralStatus,
        scheduleJson: serializeJson(updatedSchedule),
        installmentsPaid,
        status,
      },
    })
    await this.userService.addPoints(initiaAddress, 50)
    await this.scoreService.analyze(initiaAddress)

    await this.activityService.push(initiaAddress, {
      kind: 'repayment',
      label: 'Installment paid',
      detail: `Installment ${nextInstallment.installmentNumber} settled successfully.`,
    })

    return {
      loan: mapLoan(updatedLoan),
      repaidInstallment: nextInstallment.installmentNumber,
      txHash: repaymentTxHash,
      mode: this.rollupClient.mode(),
    }
  }
}
