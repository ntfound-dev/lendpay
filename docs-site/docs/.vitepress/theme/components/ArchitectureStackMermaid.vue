<template>
  <MermaidDiagram :chart="chart" />
</template>

<script setup lang="ts">
const chart = String.raw`flowchart TB
  user["Borrower + Wallet\nconnect, sign, approve, repay"]
  frontend["Frontend\nReact + Vite\nInterwovenKit wallet flow\nsigned backend session"]
  backend["Backend\nFastify + Prisma\nborrower sync and underwriting\noperator actions and mirrored state"]
  rollup["Rollup\nMiniMove runtime\nRPC, REST, blocks, state, execution"]
  move["Move Contract\nloan book, treasury, rewards,\nstaking, governance"]
  postgres["Postgres\nbackend mirror data"]
  connect["Connect\nprice reference"]
  l1["Initia L1\nidentity and usernames"]

  user --> frontend
  frontend -->|session + borrower APIs| backend
  frontend -->|signed Move tx| rollup
  backend -->|sync + operator writes| rollup
  rollup --> move
  backend -.-> postgres
  backend -.-> connect
  rollup -.-> l1

  classDef app fill:#eef4ff,stroke:#93c5fd,color:#1d4ed8,stroke-width:2px;
  classDef policy fill:#f6f3ff,stroke:#c4b5fd,color:#6d28d9,stroke-width:2px;
  classDef chain fill:#effcf6,stroke:#86efac,color:#166534,stroke-width:2px;
  classDef userfill fill:#ecfeff,stroke:#5eead4,color:#115e59,stroke-width:2px;
  classDef ext fill:#fff7ed,stroke:#fdba74,color:#9a3412,stroke-width:2px;
  classDef ext2 fill:#fefce8,stroke:#facc15,color:#854d0e,stroke-width:2px;
  classDef ext3 fill:#eff6ff,stroke:#93c5fd,color:#1d4ed8,stroke-width:2px;

  class user userfill;
  class frontend app;
  class backend policy;
  class rollup,move chain;
  class postgres ext;
  class connect ext2;
  class l1 ext3;`
</script>
