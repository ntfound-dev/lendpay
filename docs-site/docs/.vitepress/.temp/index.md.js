import { ssrRenderAttrs } from "vue/server-renderer";
import { useSSRContext } from "vue";
import { _ as _export_sfc } from "./plugin-vue_export-helper.1tPrXgE0.js";
const __pageData = JSON.parse('{"title":"","description":"","frontmatter":{"layout":"home","hero":{"name":"LendPay","text":"Open credit infrastructure for Initia apps","tagline":"Turn wallet reputation, identity, and repayment behavior into pay-later credit across NFT, gaming, and DeFi experiences on Initia.","image":{"src":"/logo.svg","alt":"LendPay"},"actions":[{"theme":"brand","text":"Read the docs","link":"/guide/introduction"},{"theme":"alt","text":"Quickstart","link":"/guide/quickstart"}]},"features":[{"title":"Reputation-based credit","details":"Borrowers connect a wallet, refresh analysis, and unlock score-based credit products tied to their onchain behavior."},{"title":"Initia-native execution","details":"Requests, approvals, repayments, rewards, campaigns, and app-linked purchases execute on a MiniMove rollup."},{"title":"Full-stack architecture","details":"React frontend, Fastify backend, and Move contracts work together to keep UI state synced with the chain."},{"title":"Real app flows","details":"LendPay is designed around a truthful borrower lifecycle, not just a dashboard mockup."}]},"headers":[],"relativePath":"index.md","filePath":"index.md"}');
const _sfc_main = { name: "index.md" };
function _sfc_ssrRender(_ctx, _push, _parent, _attrs, $props, $setup, $data, $options) {
  _push(`<div${ssrRenderAttrs(_attrs)}><h2 id="what-you-will-find-here" tabindex="-1">What You Will Find Here <a class="header-anchor" href="#what-you-will-find-here" aria-label="Permalink to &quot;What You Will Find Here&quot;">​</a></h2><ul><li>product and architecture docs for the LendPay stack</li><li>quickstart steps for local development</li><li>frontend, backend, and Move package references</li><li>API and environment documentation</li><li>testnet deployment and proof references</li></ul><h2 id="stack-overview" tabindex="-1">Stack Overview <a class="header-anchor" href="#stack-overview" aria-label="Permalink to &quot;Stack Overview&quot;">​</a></h2><p>LendPay combines:</p><ul><li>a React frontend for borrower onboarding, requests, repayment, rewards, and ecosystem views</li><li>a TypeScript backend for wallet auth, scoring, mirrored state, and operator actions</li><li>a Move package for protocol execution on a MiniMove rollup</li></ul><h2 id="core-borrower-flow" tabindex="-1">Core Borrower Flow <a class="header-anchor" href="#core-borrower-flow" aria-label="Permalink to &quot;Core Borrower Flow&quot;">​</a></h2><ol><li>Connect wallet with InterwovenKit.</li><li>Refresh borrower profile and score.</li><li>Request credit for an Initia app.</li><li>Approve and fund the request.</li><li>Use the funded balance in an app route.</li><li>Repay on schedule and improve reputation.</li></ol></div>`);
}
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("index.md");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const index = /* @__PURE__ */ _export_sfc(_sfc_main, [["ssrRender", _sfc_ssrRender]]);
export {
  __pageData,
  index as default
};
