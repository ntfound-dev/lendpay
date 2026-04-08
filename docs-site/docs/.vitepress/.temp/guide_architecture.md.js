import { ssrRenderAttrs } from "vue/server-renderer";
import { useSSRContext } from "vue";
import { _ as _export_sfc } from "./plugin-vue_export-helper.1tPrXgE0.js";
const __pageData = JSON.parse('{"title":"Architecture","description":"","frontmatter":{},"headers":[],"relativePath":"guide/architecture.md","filePath":"guide/architecture.md"}');
const _sfc_main = { name: "guide/architecture.md" };
function _sfc_ssrRender(_ctx, _push, _parent, _attrs, $props, $setup, $data, $options) {
  _push(`<div${ssrRenderAttrs(_attrs)}><h1 id="architecture" tabindex="-1">Architecture <a class="header-anchor" href="#architecture" aria-label="Permalink to &quot;Architecture&quot;">​</a></h1><p>LendPay is split into three layers.</p><h2 id="frontend" tabindex="-1">Frontend <a class="header-anchor" href="#frontend" aria-label="Permalink to &quot;Frontend&quot;">​</a></h2><p>The frontend is a React + Vite borrower console.</p><p>It handles:</p><ul><li>wallet connection through InterwovenKit</li><li>signed backend session creation</li><li>borrower state loading</li><li>Move transaction submission</li><li>product flows like request, repay, rewards, loyalty, and ecosystem views</li></ul><p>See <a href="/app/frontend">Frontend</a> for details.</p><h2 id="backend" tabindex="-1">Backend <a class="header-anchor" href="#backend" aria-label="Permalink to &quot;Backend&quot;">​</a></h2><p>The backend is a TypeScript service built with Fastify.</p><p>It handles:</p><ul><li>challenge-response wallet auth</li><li>borrower profile reads</li><li>AI-assisted underwriting</li><li>mirrored request and loan state</li><li>protocol reads</li><li>operator-signed write flows</li></ul><p>See <a href="/app/backend">Backend</a> for details.</p><h2 id="move-package" tabindex="-1">Move Package <a class="header-anchor" href="#move-package" aria-label="Permalink to &quot;Move Package&quot;">​</a></h2><p>The Move package executes the actual credit protocol logic.</p><p>It handles:</p><ul><li>requests and approvals</li><li>repayments and fee settlement</li><li>rewards and campaigns</li><li>staking and governance</li><li>app-linked purchase rails</li></ul><p>See <a href="/protocol/move-package">Move Package</a> for details.</p><h2 id="runtime-flow" tabindex="-1">Runtime Flow <a class="header-anchor" href="#runtime-flow" aria-label="Permalink to &quot;Runtime Flow&quot;">​</a></h2><ol><li>The frontend connects the wallet and authenticates against the backend.</li><li>The backend loads mirrored and onchain borrower state.</li><li>The frontend signs and submits Move transactions.</li><li>The backend resyncs the borrower state after chain updates.</li><li>The UI reflects chain-backed product state instead of frontend-only guesses.</li></ol></div>`);
}
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("guide/architecture.md");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const architecture = /* @__PURE__ */ _export_sfc(_sfc_main, [["ssrRender", _sfc_ssrRender]]);
export {
  __pageData,
  architecture as default
};
