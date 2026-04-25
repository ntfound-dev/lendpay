<template>
  <div class="mermaid-diagram">
    <div ref="container" class="mermaid-diagram__canvas" />
    <p v-if="error" class="mermaid-diagram__error">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'

const props = defineProps<{
  chart: string
}>()

const container = ref<HTMLElement | null>(null)
const error = ref('')

let initialized = false
let renderCount = 0

function escapeHtml(input: string) {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

async function renderDiagram() {
  if (import.meta.env.SSR || !container.value) {
    return
  }

  try {
    const mermaidModule = await import('mermaid')
    const mermaid = mermaidModule.default

    if (!initialized) {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'base',
        securityLevel: 'loose',
        flowchart: {
          useMaxWidth: true,
          htmlLabels: true,
          curve: 'basis',
          padding: 20,
        },
        themeVariables: {
          fontFamily: '"Inter", "Segoe UI", Arial, sans-serif',
          fontSize: '14px',
          primaryColor: '#eef4ff',
          primaryTextColor: '#1e293b',
          primaryBorderColor: '#818cf8',
          lineColor: '#64748b',
          secondaryColor: '#f5f3ff',
          tertiaryColor: '#effcf6',
          background: '#ffffff',
          mainBkg: '#eef4ff',
          nodeBorder: '#818cf8',
          clusterBkg: '#f8fafc',
          clusterBorder: '#cbd5e1',
          titleColor: '#0f172a',
          edgeLabelBackground: '#f1f5f9',
          attributeBackgroundColorEven: '#f8fafc',
          attributeBackgroundColorOdd: '#f1f5f9',
        },
      })
      initialized = true
    }

    const id = `lendpay-mermaid-${renderCount++}`
    const { svg, bindFunctions } = await mermaid.render(id, props.chart)

    container.value.innerHTML = svg
    bindFunctions?.(container.value)
    error.value = ''
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to render Mermaid diagram.'
    error.value = message

    if (container.value) {
      container.value.innerHTML = `<pre>${escapeHtml(props.chart)}</pre>`
    }
  }
}

onMounted(async () => {
  await nextTick()
  await renderDiagram()
})

watch(
  () => props.chart,
  async () => {
    await nextTick()
    await renderDiagram()
  }
)
</script>

<style scoped>
.mermaid-diagram {
  margin: 1.5rem 0;
  padding: 1.5rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow-x: auto;
}

.mermaid-diagram__canvas {
  display: flex;
  justify-content: center;
  min-height: 80px;
}

.mermaid-diagram__canvas :deep(svg) {
  max-width: 100%;
  height: auto;
  font-family: "Inter", "Segoe UI", Arial, sans-serif !important;
}

.mermaid-diagram__canvas :deep(.label) {
  font-size: 13px !important;
  line-height: 1.5 !important;
}

.mermaid-diagram__canvas :deep(.nodeLabel) {
  line-height: 1.6 !important;
  padding: 2px 4px !important;
}

.mermaid-diagram__canvas :deep(.cluster rect) {
  stroke-width: 1.5px !important;
}

.mermaid-diagram__canvas :deep(.cluster .label) {
  font-weight: 600 !important;
  font-size: 12px !important;
  letter-spacing: 0.02em !important;
}

.mermaid-diagram__error {
  color: #dc2626;
  font-size: 0.85rem;
  margin-top: 0.5rem;
}
</style>
