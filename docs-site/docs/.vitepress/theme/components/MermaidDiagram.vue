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
        theme: 'neutral',
        securityLevel: 'loose',
        flowchart: {
          useMaxWidth: true,
          htmlLabels: true,
          curve: 'basis',
        },
        themeVariables: {
          fontFamily: 'Segoe UI, Arial, sans-serif',
          fontSize: '18px',
          primaryColor: '#eef4ff',
          primaryTextColor: '#1e293b',
          primaryBorderColor: '#93c5fd',
          lineColor: '#64748b',
          secondaryColor: '#f6f3ff',
          tertiaryColor: '#effcf6',
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
