<template>
  <div class="arch">
    <!-- Borrower -->
    <div class="arch-row arch-row--center">
      <div class="arch-node arch-node--user">
        <div class="arch-node__title">Borrower + Wallet</div>
        <div class="arch-node__sub">connect · sign · approve · repay</div>
      </div>
    </div>

    <div class="arch-arrow-v">↓</div>

    <!-- Application Layer -->
    <div class="arch-group arch-group--app">
      <div class="arch-group__label">Application Layer</div>
      <div class="arch-row arch-row--two">
        <div class="arch-node arch-node--fe">
          <div class="arch-node__title">Frontend</div>
          <div class="arch-node__sub">React + Vite · InterwovenKit<br>borrower console · tx signing</div>
        </div>
        <div class="arch-node arch-node--be">
          <div class="arch-node__title">Backend</div>
          <div class="arch-node__sub">Go + PostgreSQL<br>auth · scoring · state sync</div>
        </div>
      </div>
      <div class="arch-conn-labels">
        <span class="arch-conn-label">session + borrower APIs ↔</span>
        <span class="arch-conn-label">sync + operator writes ↔</span>
      </div>
    </div>

    <div class="arch-arrow-v">↓</div>

    <!-- Chain Layer -->
    <div class="arch-group arch-group--chain">
      <div class="arch-group__label">Chain Layer · lendpay-4</div>
      <div class="arch-row arch-row--two">
        <div class="arch-node arch-node--rollup">
          <div class="arch-node__title">MiniMove Rollup</div>
          <div class="arch-node__sub">RPC · REST · block production<br>onchain state</div>
        </div>
        <div class="arch-node arch-node--move">
          <div class="arch-node__title">Move Contract</div>
          <div class="arch-node__sub">loan_book · treasury · rewards<br>staking · governance · bridge</div>
        </div>
      </div>
    </div>

    <div class="arch-arrow-v">↓</div>

    <!-- External -->
    <div class="arch-group arch-group--ext">
      <div class="arch-group__label">External</div>
      <div class="arch-row arch-row--three">
        <div class="arch-node arch-node--ext">
          <div class="arch-node__title">PostgreSQL</div>
          <div class="arch-node__sub">mirrored state</div>
        </div>
        <div class="arch-node arch-node--ext">
          <div class="arch-node__title">Initia L1</div>
          <div class="arch-node__sub">.init usernames</div>
        </div>
        <div class="arch-node arch-node--ext">
          <div class="arch-node__title">Connect Oracle</div>
          <div class="arch-node__sub">price feeds</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.arch {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  padding: 1.5rem 1rem;
  font-family: "Inter", "Segoe UI", Arial, sans-serif;
}

.arch-row {
  display: flex;
  width: 100%;
  gap: 12px;
}
.arch-row--center { justify-content: center; }
.arch-row--two { justify-content: center; gap: 12px; }
.arch-row--three { justify-content: center; gap: 12px; }

.arch-group {
  width: 100%;
  border-radius: 12px;
  padding: 14px 14px 10px;
  position: relative;
}
.arch-group__label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  margin-bottom: 10px;
  text-align: center;
}
.arch-group--app  { background: #f5f3ff; border: 1.5px solid #c4b5fd; }
.arch-group--app .arch-group__label  { color: #6d28d9; }
.arch-group--chain { background: #effcf6; border: 1.5px solid #6ee7b7; }
.arch-group--chain .arch-group__label { color: #065f46; }
.arch-group--ext  { background: #fff7ed; border: 1.5px dashed #fdba74; }
.arch-group--ext .arch-group__label  { color: #9a3412; }

.arch-node {
  flex: 1;
  max-width: 260px;
  border-radius: 8px;
  padding: 10px 14px;
  text-align: center;
  min-width: 140px;
}
.arch-node__title {
  font-size: 13px;
  font-weight: 700;
  display: block;
  margin-bottom: 4px;
}
.arch-node__sub {
  font-size: 11px;
  line-height: 1.5;
  display: block;
  opacity: 0.85;
}

.arch-node--user   { background: #ecfeff; border: 2px solid #22d3ee; color: #164e63; max-width: 280px; }
.arch-node--fe     { background: #eef4ff; border: 1.5px solid #818cf8; color: #3730a3; }
.arch-node--be     { background: #f5f3ff; border: 1.5px solid #a78bfa; color: #4c1d95; }
.arch-node--rollup { background: #effcf6; border: 1.5px solid #34d399; color: #064e3b; }
.arch-node--move   { background: #f0fdf4; border: 1.5px solid #4ade80; color: #14532d; }
.arch-node--ext    { background: #fffbeb; border: 1.5px solid #fcd34d; color: #78350f; flex: 1; max-width: 180px; }

.arch-arrow-v {
  font-size: 20px;
  color: #94a3b8;
  line-height: 1;
  margin: 6px 0;
}

.arch-conn-labels {
  display: flex;
  justify-content: space-around;
  margin-top: 8px;
}
.arch-conn-label {
  font-size: 10px;
  color: #7c3aed;
  background: #ede9fe;
  border-radius: 4px;
  padding: 2px 6px;
}
</style>
