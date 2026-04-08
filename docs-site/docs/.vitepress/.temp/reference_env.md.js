import { ssrRenderAttrs } from "vue/server-renderer";
import { useSSRContext } from "vue";
import { _ as _export_sfc } from "./plugin-vue_export-helper.1tPrXgE0.js";
const __pageData = JSON.parse('{"title":"Environment Reference","description":"","frontmatter":{},"headers":[],"relativePath":"reference/env.md","filePath":"reference/env.md"}');
const _sfc_main = { name: "reference/env.md" };
function _sfc_ssrRender(_ctx, _push, _parent, _attrs, $props, $setup, $data, $options) {
  _push(`<div${ssrRenderAttrs(_attrs)}><h1 id="environment-reference" tabindex="-1">Environment Reference <a class="header-anchor" href="#environment-reference" aria-label="Permalink to &quot;Environment Reference&quot;">​</a></h1><p>This page highlights the most important variables across the stack.</p><h2 id="frontend" tabindex="-1">Frontend <a class="header-anchor" href="#frontend" aria-label="Permalink to &quot;Frontend&quot;">​</a></h2><ul><li><code>VITE_API_BASE_URL</code></li><li><code>VITE_APPCHAIN_ID</code></li><li><code>VITE_CHAIN_RPC_URL</code></li><li><code>VITE_CHAIN_REST_URL</code></li><li><code>VITE_CHAIN_INDEXER_URL</code></li><li><code>VITE_PACKAGE_ADDRESS</code></li><li><code>VITE_LOAN_MODULE_NAME</code></li><li><code>VITE_REQUEST_FUNCTION_NAME</code></li><li><code>VITE_REQUEST_COLLATERAL_FUNCTION_NAME</code></li><li><code>VITE_REPAY_FUNCTION_NAME</code></li><li><code>VITE_PREVIEW_OPERATOR_TOKEN</code></li></ul><h2 id="backend" tabindex="-1">Backend <a class="header-anchor" href="#backend" aria-label="Permalink to &quot;Backend&quot;">​</a></h2><ul><li><code>PORT</code></li><li><code>DATABASE_URL</code></li><li><code>ROLLUP_CHAIN_ID</code></li><li><code>ROLLUP_RPC_URL</code></li><li><code>ROLLUP_REST_URL</code></li><li><code>ROLLUP_GAS_PRICES</code></li><li><code>ROLLUP_OPERATOR_MNEMONIC</code></li><li><code>ENABLE_LIVE_INITIA_READS</code></li><li><code>ENABLE_LIVE_ROLLUP_WRITES</code></li><li><code>CONNECT_REST_URL</code></li><li><code>MINIEVM_REST_URL</code></li><li><code>LENDPAY_PACKAGE_ADDRESS</code></li></ul><h2 id="operational-notes" tabindex="-1">Operational Notes <a class="header-anchor" href="#operational-notes" aria-label="Permalink to &quot;Operational Notes&quot;">​</a></h2><ul><li>Missing package addresses should disable live writes, not silently fake success.</li><li>Backend session creation depends on signed wallet challenges.</li><li>Read and write chain targets must match the same deployed package.</li></ul></div>`);
}
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("reference/env.md");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const env = /* @__PURE__ */ _export_sfc(_sfc_main, [["ssrRender", _sfc_ssrRender]]);
export {
  __pageData,
  env as default
};
