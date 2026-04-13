package app

import (
	"context"
	_ "embed"
	"fmt"
	"log"
	"net/url"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed bootstrap.sql
var bootstrapSQL string

type Database struct {
	pool   *pgxpool.Pool
	schema string
}

func NewDatabase(ctx context.Context, cfg Config) (*Database, error) {
	runtimeDatabaseURL := resolveRuntimeDatabaseURL(cfg.DatabaseURL, cfg.DirectDatabaseURL)
	parsedURL, err := url.Parse(runtimeDatabaseURL)
	if err != nil {
		return nil, err
	}

	schema := strings.TrimSpace(parsedURL.Query().Get("schema"))
	if schema == "" {
		schema = "public"
	}

	query := parsedURL.Query()
	query.Del("schema")
	parsedURL.RawQuery = query.Encode()

	poolConfig, err := pgxpool.ParseConfig(parsedURL.String())
	if err != nil {
		return nil, err
	}

	poolConfig.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol
	poolConfig.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
		_, err := conn.Exec(ctx, fmt.Sprintf(`SET search_path TO %s`, quoteIdent(schema)))
		return err
	}

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, err
	}

	db := &Database{
		pool:   pool,
		schema: schema,
	}

	bootstrapDatabaseURL, shouldBootstrap := resolveBootstrapDatabaseURL(cfg.DatabaseURL, cfg.DirectDatabaseURL)
	if shouldBootstrap {
		if err := db.bootstrap(ctx, bootstrapDatabaseURL); err != nil {
			pool.Close()
			return nil, err
		}
	} else {
		log.Printf("[startup] skipping postgres schema bootstrap on pooled DATABASE_URL; set DIRECT_DATABASE_URL for direct DDL access")
	}

	if runtimeDatabaseURL != cfg.DatabaseURL {
		log.Printf("[startup] using DIRECT_DATABASE_URL for Go runtime because DATABASE_URL points to a pooled Postgres endpoint")
	} else if looksLikePooledPostgresURL(cfg.DatabaseURL) {
		log.Printf("[startup] pooled DATABASE_URL detected without DIRECT_DATABASE_URL; enabling simple protocol compatibility mode")
	}

	log.Printf("[startup] runtime target: %s", redactDatabaseURL(withSchema(runtimeDatabaseURL, schema)))
	if shouldBootstrap {
		log.Printf("[startup] schema target: %s", redactDatabaseURL(withSchema(bootstrapDatabaseURL, schema)))
	}

	return db, nil
}

func (db *Database) Close() {
	if db == nil || db.pool == nil {
		return
	}

	db.pool.Close()
}

func (db *Database) bootstrap(ctx context.Context, databaseURL string) error {
	parsedURL, err := url.Parse(databaseURL)
	if err != nil {
		return err
	}

	query := parsedURL.Query()
	query.Del("schema")
	parsedURL.RawQuery = query.Encode()

	poolConfig, err := pgxpool.ParseConfig(parsedURL.String())
	if err != nil {
		return err
	}

	poolConfig.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol
	poolConfig.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
		_, err := conn.Exec(ctx, fmt.Sprintf(`SET search_path TO %s`, quoteIdent(db.schema)))
		return err
	}

	bootstrapPool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return err
	}
	defer bootstrapPool.Close()

	sql := strings.ReplaceAll(bootstrapSQL, "__SCHEMA__", quoteIdent(db.schema))
	_, err = bootstrapPool.Exec(ctx, sql)
	return err
}

func (db *Database) table(name string) string {
	return fmt.Sprintf("%s.%s", quoteIdent(db.schema), quoteIdent(name))
}

func quoteIdent(value string) string {
	return `"` + strings.ReplaceAll(value, `"`, `""`) + `"`
}

var pooledPostgresPorts = map[string]struct{}{
	"6432": {},
	"6438": {},
	"6543": {},
}

var pooledPostgresHostMarkers = []string{"pooler", "pool", "pgbouncer"}

func looksLikePooledPostgresURL(databaseURL string) bool {
	if !strings.HasPrefix(databaseURL, "postgres://") && !strings.HasPrefix(databaseURL, "postgresql://") {
		return false
	}

	parsedURL, err := url.Parse(databaseURL)
	if err != nil {
		return false
	}

	hostname := strings.ToLower(parsedURL.Hostname())
	_, pooledPort := pooledPostgresPorts[parsedURL.Port()]
	if pooledPort {
		return true
	}

	for _, marker := range pooledPostgresHostMarkers {
		if strings.Contains(hostname, marker) {
			return true
		}
	}

	return false
}

func resolveRuntimeDatabaseURL(databaseURL, directDatabaseURL string) string {
	if directDatabaseURL == "" || !looksLikePooledPostgresURL(databaseURL) {
		return databaseURL
	}

	return directDatabaseURL
}

func resolveBootstrapDatabaseURL(databaseURL, directDatabaseURL string) (string, bool) {
	if directDatabaseURL != "" {
		return directDatabaseURL, true
	}

	if looksLikePooledPostgresURL(databaseURL) {
		return databaseURL, false
	}

	return databaseURL, true
}

func redactDatabaseURL(value string) string {
	parsedURL, err := url.Parse(value)
	if err != nil {
		return value
	}

	if parsedURL.User != nil {
		username := parsedURL.User.Username()
		if _, hasPassword := parsedURL.User.Password(); hasPassword {
			parsedURL.User = url.UserPassword(username, "***")
		}
	}

	return parsedURL.String()
}

func withSchema(databaseURL, schema string) string {
	if schema == "" {
		return databaseURL
	}

	parsedURL, err := url.Parse(databaseURL)
	if err != nil {
		return databaseURL
	}

	query := parsedURL.Query()
	query.Set("schema", schema)
	parsedURL.RawQuery = query.Encode()
	return parsedURL.String()
}
