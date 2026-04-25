<template>
  <div class="af">
    <!-- Main planner flow -->
    <div class="af-row">
      <div v-for="(node, i) in plannerFlow" :key="i" class="af-step-h">
        <div class="af-node" :class="node.cls">
          <div class="af-node__title">{{ node.title }}</div>
          <div class="af-node__sub">{{ node.sub }}</div>
        </div>
        <div v-if="i < plannerFlow.length - 1" class="af-arrow-h">→</div>
      </div>
    </div>

    <!-- Branch -->
    <div class="af-branch-wrap">
      <div class="af-arrow-v">↓</div>
      <div class="af-branch">
        <div class="af-branch-col">
          <div class="af-branch-label af-branch-label--no">No</div>
          <div class="af-node af-node--manual">
            <div class="af-node__title">Manual Wallet Approval</div>
            <div class="af-node__sub">normal wallet flow</div>
          </div>
        </div>
        <div class="af-branch-divider">
          <div class="af-decision">Borrower arms<br>autonomy?</div>
        </div>
        <div class="af-branch-col">
          <div class="af-branch-label af-branch-label--yes">Yes</div>
          <div class="af-node af-node--auto">
            <div class="af-node__title">Auto-sign Session</div>
            <div class="af-node__sub">InterwovenKit · wallet-managed</div>
          </div>
          <div class="af-arrow-v af-arrow-v--sm">↓</div>
          <div class="af-node af-node--repay">
            <div class="af-node__title">Submit repay_installment</div>
            <div class="af-node__sub">when due installment exists</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const plannerFlow = [
  { title: 'Borrower State', sub: 'score · loans · rewards', cls: 'af-node--input' },
  { title: 'Backend Planner', sub: 'deterministic', cls: 'af-node--planner' },
  { title: 'Guide Copy', sub: 'title · body · action', cls: 'af-node--guide' },
  { title: 'Agent Panel', sub: 'UI surface', cls: 'af-node--panel' },
]
</script>

<style scoped>
.af {
  font-family: "Inter", "Segoe UI", Arial, sans-serif;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
}

/* Top row */
.af-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: center;
}
.af-step-h {
  display: flex;
  align-items: center;
  gap: 4px;
}
.af-arrow-h {
  font-size: 18px;
  color: #94a3b8;
}

/* Branch section */
.af-branch-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}
.af-arrow-v {
  font-size: 18px;
  color: #94a3b8;
  margin: 6px 0;
}
.af-arrow-v--sm {
  font-size: 14px;
  margin: 4px 0;
}

.af-branch {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  justify-content: center;
  width: 100%;
}
.af-branch-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex: 1;
  max-width: 200px;
}
.af-branch-divider {
  display: flex;
  align-items: center;
  padding-top: 28px;
}
.af-decision {
  background: #fefce8;
  border: 2px solid #eab308;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 700;
  color: #713f12;
  text-align: center;
  white-space: nowrap;
}
.af-branch-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.05em;
  padding: 2px 8px;
  border-radius: 10px;
}
.af-branch-label--no  { background: #fee2e2; color: #991b1b; }
.af-branch-label--yes { background: #dcfce7; color: #166534; }

/* Nodes */
.af-node {
  border-radius: 8px;
  border: 1.5px solid;
  padding: 8px 12px;
  text-align: center;
}
.af-node__title {
  font-size: 12px;
  font-weight: 700;
  margin-bottom: 2px;
}
.af-node__sub {
  font-size: 10px;
  opacity: 0.8;
}

.af-node--input   { background: #ecfeff; border-color: #22d3ee; color: #164e63; }
.af-node--planner { background: #eef4ff; border-color: #818cf8; color: #3730a3; }
.af-node--guide   { background: #f5f3ff; border-color: #a78bfa; color: #4c1d95; }
.af-node--panel   { background: #fdf4ff; border-color: #e879f9; color: #701a75; }
.af-node--manual  { background: #f1f5f9; border-color: #94a3b8; color: #334155; width: 100%; }
.af-node--auto    { background: #effcf6; border-color: #34d399; color: #064e3b; width: 100%; }
.af-node--repay   { background: #f0fdf4; border-color: #4ade80; color: #14532d; width: 100%; }
</style>
