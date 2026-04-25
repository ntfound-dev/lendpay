<template>
  <div class="bflow">
    <div v-for="(step, i) in steps" :key="i" class="bflow-step-wrap">
      <div class="bflow-node" :style="{ background: step.bg, borderColor: step.border, color: step.color }">
        <span class="bflow-node__num" :style="{ background: step.border, color: '#fff' }">{{ step.num }}</span>
        <div class="bflow-node__body">
          <div class="bflow-node__title">{{ step.title }}</div>
          <div class="bflow-node__sub">{{ step.sub }}</div>
        </div>
      </div>
      <div v-if="i < steps.length - 1" class="bflow-arrow">↓</div>
    </div>
    <div class="bflow-cycle">
      <span class="bflow-cycle__label">↺ better next cycle → back to step 3</span>
    </div>
  </div>
</template>

<script setup lang="ts">
const steps = [
  { num: '①', title: 'Connect Wallet', sub: 'InterwovenKit', bg: '#ecfeff', border: '#22d3ee', color: '#164e63' },
  { num: '②', title: 'Sign Login', sub: 'challenge · session token', bg: '#eef4ff', border: '#818cf8', color: '#3730a3' },
  { num: '③', title: 'Refresh Profile', sub: 'score · limit · rewards', bg: '#fefce8', border: '#eab308', color: '#713f12' },
  { num: '④', title: 'Request Credit', sub: 'select app · amount · tenor', bg: '#fdf4ff', border: '#e879f9', color: '#701a75' },
  { num: '⑤', title: 'Operator Approval', sub: 'onchain Move execution', bg: '#fff7ed', border: '#fb923c', color: '#7c2d12' },
  { num: '⑥', title: 'Use In App', sub: 'funded balance → partner route', bg: '#fdf2f8', border: '#f472b6', color: '#831843' },
  { num: '⑦', title: 'Repay Installments', sub: 'Move tx · rewards earned', bg: '#effcf6', border: '#34d399', color: '#064e3b' },
  { num: '⑧', title: 'Stronger Access', sub: 'higher limit · lower APR', bg: '#f0fdf4', border: '#4ade80', color: '#14532d' },
]
</script>

<style scoped>
.bflow {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem;
  font-family: "Inter", "Segoe UI", Arial, sans-serif;
}
.bflow-step-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 400px;
}
.bflow-node {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  border-radius: 10px;
  border: 2px solid;
  padding: 10px 14px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
.bflow-node__num {
  font-size: 16px;
  font-weight: 800;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.bflow-node__title {
  font-size: 14px;
  font-weight: 700;
  line-height: 1.3;
}
.bflow-node__sub {
  font-size: 11px;
  opacity: 0.8;
  margin-top: 2px;
}
.bflow-arrow {
  font-size: 18px;
  color: #94a3b8;
  line-height: 1;
  margin: 4px 0;
}
.bflow-cycle {
  margin-top: 12px;
  padding: 6px 14px;
  background: #f1f5f9;
  border-radius: 20px;
  border: 1px dashed #94a3b8;
}
.bflow-cycle__label {
  font-size: 11px;
  color: #64748b;
  font-style: italic;
}
</style>
