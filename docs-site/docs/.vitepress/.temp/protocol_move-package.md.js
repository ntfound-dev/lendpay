import { ssrRenderAttrs } from "vue/server-renderer";
import { useSSRContext } from "vue";
import { _ as _export_sfc } from "./plugin-vue_export-helper.1tPrXgE0.js";
const __pageData = JSON.parse('{"title":"Move Package","description":"","frontmatter":{},"headers":[],"relativePath":"protocol/move-package.md","filePath":"protocol/move-package.md"}');
const _sfc_main = { name: "protocol/move-package.md" };
function _sfc_ssrRender(_ctx, _push, _parent, _attrs, $props, $setup, $data, $options) {
  _push(`<div${ssrRenderAttrs(_attrs)}><h1 id="move-package" tabindex="-1">Move Package <a class="header-anchor" href="#move-package" aria-label="Permalink to &quot;Move Package&quot;">​</a></h1><p>The Move package implements the onchain credit protocol for LendPay.</p><h2 id="main-module-groups" tabindex="-1">Main Module Groups <a class="header-anchor" href="#main-module-groups" aria-label="Permalink to &quot;Main Module Groups&quot;">​</a></h2><ul><li><code>sources/bootstrap</code></li><li><code>sources/credit</code></li><li><code>sources/rewards</code></li><li><code>sources/tokenomics</code></li><li><code>sources/shared</code></li></ul><h2 id="core-modules" tabindex="-1">Core Modules <a class="header-anchor" href="#core-modules" aria-label="Permalink to &quot;Core Modules&quot;">​</a></h2><ul><li><code>loan_book.move</code></li><li><code>treasury.move</code></li><li><code>profiles.move</code></li><li><code>merchant_registry.move</code></li><li><code>reputation.move</code></li><li><code>viral_drop.move</code></li><li><code>rewards.move</code></li><li><code>campaigns.move</code></li><li><code>lend_token.move</code></li><li><code>fee_engine.move</code></li><li><code>staking.move</code></li><li><code>governance.move</code></li></ul><h2 id="credit-lifecycle" tabindex="-1">Credit Lifecycle <a class="header-anchor" href="#credit-lifecycle" aria-label="Permalink to &quot;Credit Lifecycle&quot;">​</a></h2><ol><li>borrower requests a profiled loan</li><li>operator approves the request</li><li>treasury disburses the loan asset</li><li>borrower uses the funded balance</li><li>borrower repays installments</li><li>rewards and reputation update</li></ol><h2 id="supported-features" tabindex="-1">Supported Features <a class="header-anchor" href="#supported-features" aria-label="Permalink to &quot;Supported Features&quot;">​</a></h2><ul><li>unsecured app credit</li><li>collateralized advanced credit</li><li>app-aware requests</li><li>claimable LEND</li><li>staking and staking rewards</li><li>campaign allocation and claim</li><li>governance</li><li>fee settlement in LEND</li></ul><h2 id="local-validation" tabindex="-1">Local Validation <a class="header-anchor" href="#local-validation" aria-label="Permalink to &quot;Local Validation&quot;">​</a></h2><p>The test suite covers:</p><ul><li>request and approval paths</li><li>repayment updates</li><li>rewards claims</li><li>staking</li><li>governance</li><li>campaign claims</li><li>app-linked credit paths</li><li>collateralized flows</li></ul></div>`);
}
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("protocol/move-package.md");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const movePackage = /* @__PURE__ */ _export_sfc(_sfc_main, [["ssrRender", _sfc_ssrRender]]);
export {
  __pageData,
  movePackage as default
};
