<template>
  <MermaidDiagram :chart="chart" />
</template>

<script setup lang="ts">
const chart = String.raw`flowchart TD
  s1["① Connect Wallet\nInterwovenKit"]
  s2["② Sign Login\nchallenge · session token"]
  s3["③ Refresh Profile\nscore · limit · rewards"]
  s4["④ Request Credit\nselect app · amount · tenor"]
  s5["⑤ Operator Approval\nonchain Move execution"]
  s6["⑥ Use In App\nfunded balance → partner route"]
  s7["⑦ Repay Installments\nMove tx · rewards earned"]
  s8["⑧ Stronger Access\nhigher limit · lower APR"]
  auto["🔄 auto-sign session\noptional · borrower-approved\nfor supported Move actions"]

  s1 --> s2 --> s3 --> s4 --> s5 --> s6 --> s7 --> s8
  s8 -. "better next cycle" .-> s3
  auto -. "supports step ⑦" .-> s7

  classDef step1 fill:#ecfeff,stroke:#22d3ee,color:#164e63,stroke-width:2px
  classDef step2 fill:#eef4ff,stroke:#818cf8,color:#3730a3,stroke-width:2px
  classDef step3 fill:#fefce8,stroke:#eab308,color:#713f12,stroke-width:2px
  classDef step4 fill:#fdf4ff,stroke:#e879f9,color:#701a75,stroke-width:2px
  classDef step5 fill:#fff7ed,stroke:#fb923c,color:#7c2d12,stroke-width:2px
  classDef step6 fill:#fdf2f8,stroke:#f472b6,color:#831843,stroke-width:2px
  classDef step7 fill:#effcf6,stroke:#34d399,color:#064e3b,stroke-width:2px
  classDef step8 fill:#f0fdf4,stroke:#4ade80,color:#14532d,stroke-width:2px
  classDef helper fill:#f8fafc,stroke:#94a3b8,color:#475569,stroke-width:1.5px,stroke-dasharray:4

  class s1 step1
  class s2 step2
  class s3 step3
  class s4 step4
  class s5 step5
  class s6 step6
  class s7 step7
  class s8 step8
  class auto helper`
</script>
