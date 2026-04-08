import { ssrRenderAttrs } from "vue/server-renderer";
import { useSSRContext } from "vue";
import { _ as _export_sfc } from "./plugin-vue_export-helper.1tPrXgE0.js";
const __pageData = JSON.parse('{"title":"Frontend","description":"","frontmatter":{},"headers":[],"relativePath":"app/frontend.md","filePath":"app/frontend.md"}');
const _sfc_main = { name: "app/frontend.md" };
function _sfc_ssrRender(_ctx, _push, _parent, _attrs, $props, $setup, $data, $options) {
  _push(`<div${ssrRenderAttrs(_attrs)}><h1 id="frontend" tabindex="-1">Frontend <a class="header-anchor" href="#frontend" aria-label="Permalink to &quot;Frontend&quot;">​</a></h1><p>The frontend is a React + Vite borrower console for the LendPay MiniMove appchain.</p><h2 id="responsibilities" tabindex="-1">Responsibilities <a class="header-anchor" href="#responsibilities" aria-label="Permalink to &quot;Responsibilities&quot;">​</a></h2><ul><li>connect the wallet through InterwovenKit</li><li>authenticate against the backend with a signed challenge</li><li>load borrower, rewards, loan, campaign, and ecosystem state</li><li>submit Move transactions for request, repay, rewards, campaign, and governance actions</li><li>present borrower, operator, and technical surfaces</li></ul><h2 id="main-entry-points" tabindex="-1">Main Entry Points <a class="header-anchor" href="#main-entry-points" aria-label="Permalink to &quot;Main Entry Points&quot;">​</a></h2><ul><li><code>src/main.tsx</code>: app bootstrap, QueryClient, Wagmi, and InterwovenKit provider wiring</li><li><code>src/App.tsx</code>: page orchestration, borrower sync, toasts, and transaction actions</li><li><code>src/config/env.ts</code>: runtime config from Vite env variables</li><li><code>src/config/chain.ts</code>: custom chain config for InterwovenKit</li><li><code>src/lib/api.ts</code>: backend API client</li><li><code>src/lib/move.ts</code>: Move <code>MsgExecute</code> builders</li></ul><h2 id="product-surfaces" tabindex="-1">Product Surfaces <a class="header-anchor" href="#product-surfaces" aria-label="Permalink to &quot;Product Surfaces&quot;">​</a></h2><ul><li><code>Overview</code></li><li><code>Profile</code></li><li><code>Request</code></li><li><code>Repay</code></li><li><code>Loyalty Hub</code></li><li><code>Ecosystem</code></li></ul><h2 id="transaction-model" tabindex="-1">Transaction Model <a class="header-anchor" href="#transaction-model" aria-label="Permalink to &quot;Transaction Model&quot;">​</a></h2><p>InterwovenKit is the primary transaction handler.</p><p>The app uses <code>requestTxBlock</code> and wraps it with timeout and recovery UI so a stuck extension does not trap the user in an endless loading state.</p><h2 id="modes" tabindex="-1">Modes <a class="header-anchor" href="#modes" aria-label="Permalink to &quot;Modes&quot;">​</a></h2><ul><li>Operator mode: <code>?operator=1</code> or <code>#operator</code></li><li>Technical mode: <code>?technical=1</code> or <code>#technical</code></li></ul><p>These surface extra tooling without changing the main borrower journey.</p></div>`);
}
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("app/frontend.md");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const frontend = /* @__PURE__ */ _export_sfc(_sfc_main, [["ssrRender", _sfc_ssrRender]]);
export {
  __pageData,
  frontend as default
};
