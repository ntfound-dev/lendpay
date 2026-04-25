<template>
  <MermaidDiagram :chart="chart" />
</template>

<script setup lang="ts">
const chart = String.raw`flowchart TB
  subgraph SU["  🧑  Borrower  "]
    user["Wallet\nconnect · sign · approve · repay"]
  end

  subgraph SA["  ⚡  Application Layer  "]
    frontend["Frontend\nReact + Vite · InterwovenKit\nborrower console · tx signing"]
    backend["Backend\nGo + PostgreSQL\nauth · scoring · state sync"]
  end

  subgraph SC["  ⛓  Chain Layer  ·  lendpay-4  "]
    rollup["MiniMove Rollup\nRPC · REST · block production"]
    move["Move Contract\nloan_book · treasury · rewards\nstaking · governance · bridge"]
  end

  subgraph SE["  🔌  External  "]
    db[("PostgreSQL\nmirrored state")]
    l1["Initia L1\n.init usernames"]
    oracle["Connect Oracle\nprice feeds"]
  end

  user --> frontend
  frontend <-->|"session + borrower APIs"| backend
  frontend -->|"signed Move tx"| rollup
  backend <-->|"sync + operator writes"| rollup
  rollup --> move
  backend --- db
  rollup -. "username reads" .-> l1
  backend -. "price feeds" .-> oracle

  classDef su fill:#ecfeff,stroke:#22d3ee,color:#164e63,stroke-width:2px
  classDef fe fill:#eef4ff,stroke:#818cf8,color:#3730a3,stroke-width:2px
  classDef be fill:#f5f3ff,stroke:#a78bfa,color:#4c1d95,stroke-width:2px
  classDef ch fill:#effcf6,stroke:#34d399,color:#064e3b,stroke-width:2px
  classDef ex fill:#fff7ed,stroke:#fb923c,color:#7c2d12,stroke-width:2px

  class user su
  class frontend fe
  class backend be
  class rollup,move ch
  class db,l1,oracle ex`
</script>
