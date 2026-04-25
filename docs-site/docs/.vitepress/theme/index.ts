import DefaultTheme from 'vitepress/theme'
import ArchitectureStackMermaid from './components/ArchitectureStackMermaid.vue'
import BorrowerFlowMermaid from './components/BorrowerFlowMermaid.vue'
import AgenticFlowDiagram from './components/AgenticFlowDiagram.vue'
import './custom.css'
import MermaidDiagram from './components/MermaidDiagram.vue'
import RevenueCalculator from './components/RevenueCalculator.vue'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('ArchitectureStackMermaid', ArchitectureStackMermaid)
    app.component('BorrowerFlowMermaid', BorrowerFlowMermaid)
    app.component('AgenticFlowDiagram', AgenticFlowDiagram)
    app.component('MermaidDiagram', MermaidDiagram)
    app.component('RevenueCalculator', RevenueCalculator)
  },
}
