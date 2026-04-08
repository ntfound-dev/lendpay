import { ssrRenderAttrs } from "vue/server-renderer";
import { useSSRContext } from "vue";
import { _ as _export_sfc } from "./plugin-vue_export-helper.1tPrXgE0.js";
const __pageData = JSON.parse('{"title":"Backend","description":"","frontmatter":{},"headers":[],"relativePath":"app/backend.md","filePath":"app/backend.md"}');
const _sfc_main = { name: "app/backend.md" };
function _sfc_ssrRender(_ctx, _push, _parent, _attrs, $props, $setup, $data, $options) {
  _push(`<div${ssrRenderAttrs(_attrs)}><h1 id="backend" tabindex="-1">Backend <a class="header-anchor" href="#backend" aria-label="Permalink to &quot;Backend&quot;">​</a></h1><p>The backend bridges the frontend and the Move rollup.</p><h2 id="responsibilities" tabindex="-1">Responsibilities <a class="header-anchor" href="#responsibilities" aria-label="Permalink to &quot;Responsibilities&quot;">​</a></h2><ul><li>wallet-based authentication</li><li>borrower profile reads</li><li>hybrid AI-assisted underwriting</li><li>request and loan mirrors</li><li>protocol reads from the rollup</li><li>operator-signed admin and approval actions</li></ul><h2 id="main-entry-points" tabindex="-1">Main Entry Points <a class="header-anchor" href="#main-entry-points" aria-label="Permalink to &quot;Main Entry Points&quot;">​</a></h2><ul><li><code>src/server.ts</code></li><li><code>src/app.ts</code></li><li><code>src/config/env.ts</code></li><li><code>src/db/prisma.ts</code></li><li><code>src/integrations/rollup/client.ts</code></li><li><code>src/integrations/connect/oracle.ts</code></li><li><code>src/integrations/l1/usernames.ts</code></li></ul><h2 id="core-modules" tabindex="-1">Core Modules <a class="header-anchor" href="#core-modules" aria-label="Permalink to &quot;Core Modules&quot;">​</a></h2><ul><li><code>auth</code></li><li><code>users</code></li><li><code>scores</code></li><li><code>loans</code></li><li><code>protocol</code></li><li><code>activity</code></li></ul><h2 id="runtime-flow" tabindex="-1">Runtime Flow <a class="header-anchor" href="#runtime-flow" aria-label="Permalink to &quot;Runtime Flow&quot;">​</a></h2><ol><li>Frontend asks for a challenge.</li><li>Backend stores a challenge.</li><li>Wallet signs the challenge.</li><li>Backend verifies the signature and issues a session.</li><li>Borrower state is loaded from Prisma plus rollup views.</li><li>After important transactions, backend resyncs from the rollup.</li></ol><h2 id="underwriting-model" tabindex="-1">Underwriting Model <a class="header-anchor" href="#underwriting-model" aria-label="Permalink to &quot;Underwriting Model&quot;">​</a></h2><p>The scoring path is hybrid:</p><ul><li>deterministic wallet and reputation signals</li><li>optional local Ollama analysis</li><li>final policy clamping for score, APR, and limit</li></ul><p>This keeps AI in an advisory role instead of giving it unchecked lending authority.</p></div>`);
}
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("app/backend.md");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const backend = /* @__PURE__ */ _export_sfc(_sfc_main, [["ssrRender", _sfc_ssrRender]]);
export {
  __pageData,
  backend as default
};
