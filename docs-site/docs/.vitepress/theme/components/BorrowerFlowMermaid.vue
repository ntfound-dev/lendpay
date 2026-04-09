<template>
  <MermaidDiagram :chart="chart" />
</template>

<script setup lang="ts">
const chart = String.raw`flowchart LR
  a["1. Connect Wallet"] --> b["2. Sign Login"]
  b --> c["3. Refresh Profile"]
  c --> d["4. Request Credit"]
  d --> e["5. Approval"]
  e --> f["6. Use In App"]
  f --> g["7. Repay Over Time"]
  g --> h["8. Stronger Access"]
  h -. better next cycle .-> c
  x["Optional UX: temporary auto-sign session\nfor supported Move actions"] -. supports repeat actions .-> g

  classDef primary fill:#eef4ff,stroke:#93c5fd,color:#1d4ed8,stroke-width:2px;
  classDef auth fill:#f6f3ff,stroke:#c4b5fd,color:#6d28d9,stroke-width:2px;
  classDef score fill:#fefce8,stroke:#facc15,color:#854d0e,stroke-width:2px;
  classDef request fill:#effcf6,stroke:#86efac,color:#166534,stroke-width:2px;
  classDef approve fill:#fff7ed,stroke:#fdba74,color:#9a3412,stroke-width:2px;
  classDef use fill:#fdf2f8,stroke:#f9a8d4,color:#9d174d,stroke-width:2px;
  classDef repay fill:#eefcf8,stroke:#5eead4,color:#0f766e,stroke-width:2px;
  classDef gain fill:#f0fdf4,stroke:#4ade80,color:#166534,stroke-width:2px;
  classDef helper fill:#f8fafc,stroke:#cbd5e1,color:#475569,stroke-width:2px;

  class a primary;
  class b auth;
  class c score;
  class d request;
  class e approve;
  class f use;
  class g repay;
  class h gain;
  class x helper;`
</script>
