package database

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"sentinel/internal/models"

	"golang.org/x/crypto/bcrypt"
	_ "modernc.org/sqlite"
)

type DB struct {
	Sql *sql.DB
}

func InitDB(dbPath string) (*DB, error) {
	dir := filepath.Dir(dbPath)
	if dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return nil, fmt.Errorf("failed to create db directory: %w", err)
		}
	}

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open sqlite database: %w", err)
	}

	// Pragmas for reliability and performance
	if _, err := db.Exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;"); err != nil {
		log.Printf("Warning: failed to set WAL mode: %v", err)
	}

	schema := `
	CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		username TEXT UNIQUE NOT NULL,
		password_hash TEXT NOT NULL,
		role TEXT NOT NULL DEFAULT 'admin',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		last_login DATETIME
	);
	`
	if _, err := db.Exec(schema); err != nil {
		return nil, fmt.Errorf("failed to create schema: %w", err)
	}

	dbInstance := &DB{Sql: db}

	// Seed default admin user if none exists
	if err := dbInstance.seedDefaultUser(); err != nil {
		log.Printf("Notice on user seeding: %v", err)
	}

	return dbInstance, nil
}

func (d *DB) seedDefaultUser() error {
	var count int
	err := d.Sql.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	if err != nil {
		return err
	}

	if count == 0 {
		defaultUsername := os.Getenv("ADMIN_USERNAME")
		if defaultUsername == "" {
			defaultUsername = "admin"
		}
		defaultPassword := os.Getenv("ADMIN_PASSWORD")
		if defaultPassword == "" {
			defaultPassword = "admin" // Easy first login, prompt to change in dashboard
		}

		hash, err := bcrypt.GenerateFromPassword([]byte(defaultPassword), bcrypt.DefaultCost)
		if err != nil {
			return fmt.Errorf("failed to hash default password: %w", err)
		}

		_, err = d.Sql.Exec(
			"INSERT INTO users (username, password_hash, role, created_at) VALUES (?, ?, 'admin', ?)",
			defaultUsername, string(hash), time.Now(),
		)
		if err != nil {
			return fmt.Errorf("failed to insert default user: %w", err)
		}

		log.Printf("[SECURITY] Default administrator user initialized. Username: '%s', Password: '%s'", defaultUsername, defaultPassword)
	}

	return nil
}

func (d *DB) GetUserByUsername(username string) (*models.User, error) {
	var u models.User
	var lastLogin sql.NullTime

	err := d.Sql.QueryRow(
		"SELECT id, username, password_hash, role, created_at, last_login FROM users WHERE username = ?",
		username,
	).Scan(&u.ID, &u.Username, &u.PasswordHash, &u.Role, &u.CreatedAt, &lastLogin)

	if err != nil {
		return nil, err
	}
	if lastLogin.Valid {
		u.LastLogin = &lastLogin.Time
	}
	return &u, nil
}

func (d *DB) GetUserByID(id int64) (*models.User, error) {
	var u models.User
	var lastLogin sql.NullTime

	err := d.Sql.QueryRow(
		"SELECT id, username, password_hash, role, created_at, last_login FROM users WHERE id = ?",
		id,
	).Scan(&u.ID, &u.Username, &u.PasswordHash, &u.Role, &u.CreatedAt, &lastLogin)

	if err != nil {
		return nil, err
	}
	if lastLogin.Valid {
		u.LastLogin = &lastLogin.Time
	}
	return &u, nil
}

func (d *DB) UpdatePassword(id int64, newHash string) error {
	_, err := d.Sql.Exec("UPDATE users SET password_hash = ? WHERE id = ?", newHash, id)
	return err
}

func (d *DB) UpdateLastLogin(id int64) error {
	_, err := d.Sql.Exec("UPDATE users SET last_login = ? WHERE id = ?", time.Now(), id)
	return err
}

func (d *DB) Close() error {
	return d.Sql.Close()
}
