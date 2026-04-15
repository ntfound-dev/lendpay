package app

import "testing"

func TestResolvePublicServiceURL(t *testing.T) {
	t.Setenv("RAILWAY_SERVICE_ROLLUP_RUNTIME_URL", "rollup-runtime-backend.up.railway.app")

	got := resolvePublicServiceURL("", "http://rollup-runtime.railway.internal:1317")
	want := "https://rollup-runtime-backend.up.railway.app"
	if got != want {
		t.Fatalf("resolvePublicServiceURL() = %q, want %q", got, want)
	}
}

func TestResolvePublicServiceURLKeepsPublicURL(t *testing.T) {
	got := resolvePublicServiceURL("", "https://example.com")
	if got != "https://example.com" {
		t.Fatalf("resolvePublicServiceURL() = %q, want public URL unchanged", got)
	}
}
