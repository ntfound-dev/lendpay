import { ssrRenderAttrs } from "vue/server-renderer";
import { useSSRContext } from "vue";
import { _ as _export_sfc } from "./plugin-vue_export-helper.1tPrXgE0.js";
const __pageData = JSON.parse('{"title":"Introduction","description":"","frontmatter":{},"headers":[],"relativePath":"guide/introduction.md","filePath":"guide/introduction.md"}');
const _sfc_main = { name: "guide/introduction.md" };
function _sfc_ssrRender(_ctx, _push, _parent, _attrs, $props, $setup, $data, $options) {
  _push(`<div${ssrRenderAttrs(_attrs)}><h1 id="introduction" tabindex="-1">Introduction <a class="header-anchor" href="#introduction" aria-label="Permalink to &quot;Introduction&quot;">​</a></h1><p>LendPay is an Initia MiniMove appchain for agent-guided credit across Initia apps.</p><p>It combines:</p><ul><li>a React frontend for credit requests, live app usage, repayment, rewards, and ecosystem activity</li><li>a TypeScript backend for authentication, underwriting, state sync, and operator actions</li><li>Move smart contracts for requests, approvals, repayments, collateral, rewards, campaigns, governance, and app rails</li></ul><h2 id="what-problem-lendpay-solves" tabindex="-1">What Problem LendPay Solves <a class="header-anchor" href="#what-problem-lendpay-solves" aria-label="Permalink to &quot;What Problem LendPay Solves&quot;">​</a></h2><p>Onchain users can already trade and bridge, but they still cannot easily access simple consumer credit for real app experiences.</p><p>LendPay turns:</p><ul><li>wallet activity</li><li><code>.init</code> identity</li><li>repayment behavior</li></ul><p>into ecosystem-aware installment credit.</p><h2 id="product-direction" tabindex="-1">Product Direction <a class="header-anchor" href="#product-direction" aria-label="Permalink to &quot;Product Direction&quot;">​</a></h2><p>LendPay is focused on one clean borrower journey:</p><ol><li>connect wallet</li><li>refresh profile</li><li>request app credit</li><li>receive approval and funded balance</li><li>use credit in an Initia app</li><li>repay over time</li></ol><p>This documentation site explains each layer of that flow in a way that is easier to browse than repo README files.</p></div>`);
}
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("guide/introduction.md");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const introduction = /* @__PURE__ */ _export_sfc(_sfc_main, [["ssrRender", _sfc_ssrRender]]);
export {
  __pageData,
  introduction as default
};
