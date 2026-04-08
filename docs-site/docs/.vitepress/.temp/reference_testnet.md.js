import { ssrRenderAttrs } from "vue/server-renderer";
import { useSSRContext } from "vue";
import { _ as _export_sfc } from "./plugin-vue_export-helper.1tPrXgE0.js";
const __pageData = JSON.parse('{"title":"Testnet Evidence","description":"","frontmatter":{},"headers":[],"relativePath":"reference/testnet.md","filePath":"reference/testnet.md"}');
const _sfc_main = { name: "reference/testnet.md" };
function _sfc_ssrRender(_ctx, _push, _parent, _attrs, $props, $setup, $data, $options) {
  _push(`<div${ssrRenderAttrs(_attrs)}><h1 id="testnet-evidence" tabindex="-1">Testnet Evidence <a class="header-anchor" href="#testnet-evidence" aria-label="Permalink to &quot;Testnet Evidence&quot;">​</a></h1><p>LendPay ships with real testnet references for the active rollup deployment.</p><h2 id="current-runtime" tabindex="-1">Current Runtime <a class="header-anchor" href="#current-runtime" aria-label="Permalink to &quot;Current Runtime&quot;">​</a></h2><ul><li>Chain ID: <code>lendpay-4</code></li><li>RPC: <code>http://127.0.0.1:26657</code></li><li>REST: <code>http://127.0.0.1:1317</code></li><li>Package address: <code>0x5972A1C7118A8977852DC3307621535D5C1CDA63</code></li><li>Base denom: <code>ulend</code></li></ul><h2 id="example-testnet-transactions" tabindex="-1">Example Testnet Transactions <a class="header-anchor" href="#example-testnet-transactions" aria-label="Permalink to &quot;Example Testnet Transactions&quot;">​</a></h2><ul><li>deploy: <code>F93B0FA4D598833E7664DE8F0A88B5DCC7F921D2CB0EFB3F0C3D95C2D1D66D78</code></li><li>bootstrap: <code>FEC142843CECAE4011E4ECAEB32A5019A9E66E099EAC875BD82DBF953D3AFF1D</code></li><li>approval: <code>E4E34699EE84E54C9A9552013970F392EE2E03EA8D6C4B1C4E651C5D6EA5E722</code></li><li>request: <code>48A044189CC75E1877E455D208E2F22BD6706DDF25DF410D62144D4DB9E3D5A2</code></li><li>viral drop buy: <code>578AB95B519EE25A7E60D52E0A876C5DB81D4B658871BD066938F4E4863A4286</code></li></ul><h2 id="artifact-locations" tabindex="-1">Artifact Locations <a class="header-anchor" href="#artifact-locations" aria-label="Permalink to &quot;Artifact Locations&quot;">​</a></h2><ul><li><code>smarcontract/artifacts/testnet/lendpay-4</code></li><li><code>.initia/submission.json</code></li></ul><p>These are good sources for deeper proof pages later if you want explorer-linked transaction cards in the docs site itself.</p></div>`);
}
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("reference/testnet.md");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const testnet = /* @__PURE__ */ _export_sfc(_sfc_main, [["ssrRender", _sfc_ssrRender]]);
export {
  __pageData,
  testnet as default
};
