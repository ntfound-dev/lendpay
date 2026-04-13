package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"lendpay-backend-go/internal/app"
)

func main() {
	cfg := app.LoadConfig()

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	serverApp, err := app.NewServer(ctx, cfg)
	if err != nil {
		log.Fatalf("backend initialization failed: %v", err)
	}
	defer serverApp.Close()

	httpServer := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           serverApp.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		<-ctx.Done()

		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		_ = httpServer.Shutdown(shutdownCtx)
	}()

	log.Printf("[startup] go backend listening on 0.0.0.0:%s", cfg.Port)

	if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("backend server failed: %v", err)
	}
}
