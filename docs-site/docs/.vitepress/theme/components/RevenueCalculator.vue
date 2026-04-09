<script setup lang="ts">
import { computed, ref } from 'vue'

const approvedLoans = ref(100)
const averageLoanUsd = ref(300)
const originationFeePct = ref(1.5)
const aprPct = ref(9.35)
const avgTenorMonths = ref(3)
const partnerFeePct = ref(0.5)
const defaultRatePct = ref(4)
const lossGivenDefaultPct = ref(60)
const monthlyOpexUsd = ref(50)

const toCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0)

const toPercent = (value: number) =>
  `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(
    Number.isFinite(value) ? value : 0,
  )}%`

const loanVolumeUsd = computed(() => approvedLoans.value * averageLoanUsd.value)
const originationRevenueUsd = computed(
  () => loanVolumeUsd.value * (originationFeePct.value / 100),
)
const interestRevenueUsd = computed(
  () =>
    approvedLoans.value *
    averageLoanUsd.value *
    (aprPct.value / 100) *
    (avgTenorMonths.value / 12),
)
const partnerRevenueUsd = computed(
  () => loanVolumeUsd.value * (partnerFeePct.value / 100),
)
const grossRevenueUsd = computed(
  () =>
    originationRevenueUsd.value + interestRevenueUsd.value + partnerRevenueUsd.value,
)
const expectedCreditLossUsd = computed(
  () =>
    loanVolumeUsd.value *
    (defaultRatePct.value / 100) *
    (lossGivenDefaultPct.value / 100),
)
const netRevenueBeforeOpexUsd = computed(
  () => grossRevenueUsd.value - expectedCreditLossUsd.value,
)
const netRevenueAfterOpexUsd = computed(
  () => netRevenueBeforeOpexUsd.value - monthlyOpexUsd.value,
)
const grossRevenuePerLoanUsd = computed(() =>
  approvedLoans.value > 0 ? grossRevenueUsd.value / approvedLoans.value : 0,
)
const netRevenuePerLoanUsd = computed(() =>
  approvedLoans.value > 0 ? netRevenueBeforeOpexUsd.value / approvedLoans.value : 0,
)
const breakevenLoans = computed(() =>
  netRevenuePerLoanUsd.value > 0
    ? Math.ceil(monthlyOpexUsd.value / netRevenuePerLoanUsd.value)
    : null,
)
const reserveMode = computed(() => defaultRatePct.value > 5)

const treasuryAllocationUsd = computed(() => grossRevenueUsd.value * 0.4)
const stakingAllocationUsd = computed(() => grossRevenueUsd.value * 0.3)
const burnOrReserveAllocationUsd = computed(() => grossRevenueUsd.value * 0.3)
</script>

<template>
  <div class="revenue-calculator">
    <div class="revenue-calculator__inputs">
      <div class="revenue-calculator__field">
        <label for="approvedLoans">Approved loans / month</label>
        <input id="approvedLoans" v-model.number="approvedLoans" min="0" step="1" type="number" />
      </div>
      <div class="revenue-calculator__field">
        <label for="averageLoanUsd">Average loan size (USD)</label>
        <input id="averageLoanUsd" v-model.number="averageLoanUsd" min="0" step="10" type="number" />
      </div>
      <div class="revenue-calculator__field">
        <label for="originationFeePct">Origination fee (%)</label>
        <input id="originationFeePct" v-model.number="originationFeePct" min="0" step="0.1" type="number" />
      </div>
      <div class="revenue-calculator__field">
        <label for="aprPct">APR (%)</label>
        <input id="aprPct" v-model.number="aprPct" min="0" step="0.1" type="number" />
      </div>
      <div class="revenue-calculator__field">
        <label for="avgTenorMonths">Average tenor (months)</label>
        <input id="avgTenorMonths" v-model.number="avgTenorMonths" min="1" step="1" type="number" />
      </div>
      <div class="revenue-calculator__field">
        <label for="partnerFeePct">Partner fee on volume (%)</label>
        <input id="partnerFeePct" v-model.number="partnerFeePct" min="0" step="0.1" type="number" />
      </div>
      <div class="revenue-calculator__field">
        <label for="defaultRatePct">Default rate (%)</label>
        <input id="defaultRatePct" v-model.number="defaultRatePct" min="0" step="0.1" type="number" />
      </div>
      <div class="revenue-calculator__field">
        <label for="lossGivenDefaultPct">Loss given default (%)</label>
        <input id="lossGivenDefaultPct" v-model.number="lossGivenDefaultPct" min="0" step="1" type="number" />
      </div>
      <div class="revenue-calculator__field">
        <label for="monthlyOpexUsd">Monthly opex (USD)</label>
        <input id="monthlyOpexUsd" v-model.number="monthlyOpexUsd" min="0" step="10" type="number" />
      </div>
    </div>

    <div class="revenue-calculator__outputs">
      <div class="revenue-calculator__card">
        <span>Loan volume</span>
        <strong>{{ toCurrency(loanVolumeUsd) }}</strong>
      </div>
      <div class="revenue-calculator__card">
        <span>Origination revenue</span>
        <strong>{{ toCurrency(originationRevenueUsd) }}</strong>
      </div>
      <div class="revenue-calculator__card">
        <span>Interest revenue</span>
        <strong>{{ toCurrency(interestRevenueUsd) }}</strong>
      </div>
      <div class="revenue-calculator__card">
        <span>Partner revenue</span>
        <strong>{{ toCurrency(partnerRevenueUsd) }}</strong>
      </div>
      <div class="revenue-calculator__card">
        <span>Gross revenue</span>
        <strong>{{ toCurrency(grossRevenueUsd) }}</strong>
      </div>
      <div class="revenue-calculator__card">
        <span>Expected credit loss</span>
        <strong>{{ toCurrency(expectedCreditLossUsd) }}</strong>
      </div>
      <div class="revenue-calculator__card">
        <span>Net before opex</span>
        <strong>{{ toCurrency(netRevenueBeforeOpexUsd) }}</strong>
      </div>
      <div class="revenue-calculator__card">
        <span>Net after opex</span>
        <strong>{{ toCurrency(netRevenueAfterOpexUsd) }}</strong>
      </div>
      <div class="revenue-calculator__card">
        <span>Gross revenue per loan</span>
        <strong>{{ toCurrency(grossRevenuePerLoanUsd) }}</strong>
      </div>
      <div class="revenue-calculator__card">
        <span>Breakeven loans</span>
        <strong>{{ breakevenLoans === null ? 'Not reached' : breakevenLoans }}</strong>
      </div>
    </div>

    <div class="revenue-calculator__note">
      <p>
        Mode:
        <strong>{{ reserveMode ? 'Reserve-first mode' : 'Burn-enabled mode' }}</strong>
      </p>
      <p>
        Default gate:
        <strong>{{ toPercent(defaultRatePct) }}</strong>
        {{ reserveMode ? 'is above the 5% risk gate, so treasury should build reserve before burn.' : 'is inside the target range, so burn routing can be considered.' }}
      </p>
    </div>

    <div class="revenue-calculator__split">
      <div class="revenue-calculator__split-card">
        <span>Treasury 40%</span>
        <strong>{{ toCurrency(treasuryAllocationUsd) }}</strong>
      </div>
      <div class="revenue-calculator__split-card">
        <span>Staking 30%</span>
        <strong>{{ toCurrency(stakingAllocationUsd) }}</strong>
      </div>
      <div class="revenue-calculator__split-card">
        <span>{{ reserveMode ? 'Insurance reserve 30%' : 'Burn 30%' }}</span>
        <strong>{{ toCurrency(burnOrReserveAllocationUsd) }}</strong>
      </div>
    </div>
  </div>
</template>

<style scoped>
.revenue-calculator {
  display: grid;
  gap: 20px;
  margin: 24px 0;
}

.revenue-calculator__inputs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.revenue-calculator__field {
  display: grid;
  gap: 8px;
}

.revenue-calculator__field label {
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-text-2);
}

.revenue-calculator__field input {
  width: 100%;
  border: 1px solid var(--vp-c-divider);
  border-radius: 14px;
  padding: 12px 14px;
  background: var(--vp-c-bg-soft);
}

.revenue-calculator__outputs,
.revenue-calculator__split {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 14px;
}

.revenue-calculator__card,
.revenue-calculator__split-card {
  display: grid;
  gap: 8px;
  padding: 16px;
  border: 1px solid rgba(37, 99, 235, 0.16);
  border-radius: 18px;
  background:
    radial-gradient(circle at top right, rgba(20, 184, 166, 0.12), transparent 42%),
    var(--vp-c-bg-soft);
}

.revenue-calculator__card span,
.revenue-calculator__split-card span {
  font-size: 12px;
  color: var(--vp-c-text-2);
}

.revenue-calculator__card strong,
.revenue-calculator__split-card strong {
  font-size: 1.15rem;
  line-height: 1.2;
}

.revenue-calculator__note {
  padding: 16px 18px;
  border-radius: 18px;
  background: rgba(37, 99, 235, 0.08);
  border: 1px solid rgba(37, 99, 235, 0.14);
}

.revenue-calculator__note p {
  margin: 0;
}

.revenue-calculator__note p + p {
  margin-top: 8px;
}

@media (max-width: 960px) {
  .revenue-calculator__inputs,
  .revenue-calculator__outputs,
  .revenue-calculator__split {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .revenue-calculator__inputs,
  .revenue-calculator__outputs,
  .revenue-calculator__split {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
