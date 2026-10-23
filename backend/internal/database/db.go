package database

import (
	"database/sql"
	"fmt"
	"log"
	"math"
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

	CREATE TABLE IF NOT EXISTS metrics_history (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		timestamp INTEGER NOT NULL,
		cpu_percent REAL NOT NULL,
		memory_percent REAL NOT NULL,
		memory_used INTEGER NOT NULL,
		disk_used_percent REAL NOT NULL,
		net_recv_speed INTEGER NOT NULL,
		net_sent_speed INTEGER NOT NULL,
		load_1 REAL NOT NULL,
		containers_running INTEGER NOT NULL
	);
	CREATE INDEX IF NOT EXISTS idx_metrics_history_ts ON metrics_history(timestamp);
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

func (d *DB) GetAllUsers() ([]models.User, error) {
	rows, err := d.Sql.Query("SELECT id, username, role, created_at, last_login FROM users ORDER BY id ASC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	users := make([]models.User, 0)
	for rows.Next() {
		var u models.User
		var lastLogin sql.NullTime
		if err := rows.Scan(&u.ID, &u.Username, &u.Role, &u.CreatedAt, &lastLogin); err != nil {
			return nil, err
		}
		if lastLogin.Valid {
			u.LastLogin = &lastLogin.Time
		}
		users = append(users, u)
	}
	return users, rows.Err()
}

func (d *DB) CreateUser(username, passwordHash, role string) (*models.User, error) {
	res, err := d.Sql.Exec(
		"INSERT INTO users (username, password_hash, role, created_at) VALUES (?, ?, ?, ?)",
		username, passwordHash, role, time.Now(),
	)
	if err != nil {
		return nil, err
	}

	id, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}

	return d.GetUserByID(id)
}

func (d *DB) DeleteUser(id int64) error {
	_, err := d.Sql.Exec("DELETE FROM users WHERE id = ?", id)
	return err
}

func (d *DB) UpdateUserRole(id int64, role string) error {
	_, err := d.Sql.Exec("UPDATE users SET role = ? WHERE id = ?", role, id)
	return err
}

func (d *DB) InsertMetricSnapshot(p models.MetricHistoryPoint) error {
	_, err := d.Sql.Exec(`
		INSERT INTO metrics_history (
			timestamp, cpu_percent, memory_percent, memory_used,
			disk_used_percent, net_recv_speed, net_sent_speed, load_1, containers_running
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, p.Timestamp, p.CPUPercent, p.MemoryPercent, p.MemoryUsed,
		p.DiskUsedPercent, p.NetRecvSpeed, p.NetSentSpeed, p.Load1, p.ContainersRunning)
	return err
}

func (d *DB) GetMetricsHistory(rangeStr string) (*models.MetricsHistoryResponse, error) {
	now := time.Now()
	var duration time.Duration
	var bucketMs int64

	switch rangeStr {
	case "1h":
		duration = 1 * time.Hour
		bucketMs = 15 * 1000 // 15s buckets (up to 240 points)
	case "6h":
		duration = 6 * time.Hour
		bucketMs = 60 * 1000 // 1m buckets (up to 360 points)
	case "24h":
		duration = 24 * time.Hour
		bucketMs = 5 * 60 * 1000 // 5m buckets (up to 288 points)
	case "7d":
		duration = 7 * 24 * time.Hour
		bucketMs = 30 * 60 * 1000 // 30m buckets (up to 336 points)
	case "30d":
		duration = 30 * 24 * time.Hour
		bucketMs = 2 * 60 * 60 * 1000 // 2h buckets (up to 360 points)
	default:
		rangeStr = "24h"
		duration = 24 * time.Hour
		bucketMs = 5 * 60 * 1000
	}

	startMs := now.Add(-duration).UnixMilli()

	query := `
		SELECT 
			MIN(timestamp) as ts,
			ROUND(AVG(cpu_percent), 1),
			ROUND(MAX(cpu_percent), 1),
			ROUND(AVG(memory_percent), 1),
			CAST(MAX(memory_used) AS INTEGER),
			ROUND(AVG(disk_used_percent), 1),
			CAST(AVG(net_recv_speed) AS INTEGER),
			CAST(AVG(net_sent_speed) AS INTEGER),
			ROUND(AVG(load_1), 2),
			MAX(containers_running)
		FROM metrics_history
		WHERE timestamp >= ?
		GROUP BY (timestamp / ?)
		ORDER BY ts ASC
	`

	rows, err := d.Sql.Query(query, startMs, bucketMs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	points := make([]models.MetricHistoryPoint, 0)
	var summary models.MetricHistorySummary
	var totalCPU, totalMem, totalDisk float64
	var count int

	for rows.Next() {
		var p models.MetricHistoryPoint
		if err := rows.Scan(
			&p.Timestamp,
			&p.CPUPercent,
			&p.CPUMax,
			&p.MemoryPercent,
			&p.MemoryUsed,
			&p.DiskUsedPercent,
			&p.NetRecvSpeed,
			&p.NetSentSpeed,
			&p.Load1,
			&p.ContainersRunning,
		); err != nil {
			return nil, err
		}

		if p.CPUPercent > summary.MaxCPU {
			summary.MaxCPU = p.CPUPercent
		}
		if p.CPUMax > summary.MaxCPU {
			summary.MaxCPU = p.CPUMax
		}
		if p.MemoryPercent > summary.MaxMemory {
			summary.MaxMemory = p.MemoryPercent
		}
		if p.Load1 > summary.MaxLoad {
			summary.MaxLoad = p.Load1
		}

		totalCPU += p.CPUPercent
		totalMem += p.MemoryPercent
		totalDisk += p.DiskUsedPercent

		// Approximate transfer based on speed and bucket size
		bucketSec := float64(bucketMs) / 1000.0
		summary.TotalNetRecvBytes += uint64(float64(p.NetRecvSpeed) * bucketSec)
		summary.TotalNetSentBytes += uint64(float64(p.NetSentSpeed) * bucketSec)

		points = append(points, p)
		count++
	}

	if count > 0 {
		summary.AvgCPU = math.Round((totalCPU/float64(count))*10) / 10
		summary.AvgMemory = math.Round((totalMem/float64(count))*10) / 10
		summary.AvgDisk = math.Round((totalDisk/float64(count))*10) / 10
	}

	return &models.MetricsHistoryResponse{
		Range:   rangeStr,
		Count:   len(points),
		Summary: summary,
		Data:    points,
	}, nil
}

func (d *DB) PruneOldMetrics(maxAgeDays int) (int64, error) {
	thresholdMs := time.Now().Add(-time.Duration(maxAgeDays) * 24 * time.Hour).UnixMilli()
	res, err := d.Sql.Exec("DELETE FROM metrics_history WHERE timestamp < ?", thresholdMs)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

func (d *DB) Close() error {
	return d.Sql.Close()
}

