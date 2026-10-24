package metrics

import (
	"log"
	"time"

	"sentinel/internal/database"
	"sentinel/internal/models"
)

type Recorder struct {
	collector *Collector
	db        *database.DB
	interval  time.Duration
	stopCh    chan struct{}
}

func NewRecorder(collector *Collector, db *database.DB, interval time.Duration) *Recorder {
	if interval <= 0 {
		interval = 15 * time.Second
	}
	return &Recorder{
		collector: collector,
		db:        db,
		interval:  interval,
		stopCh:    make(chan struct{}),
	}
}

func (r *Recorder) Start() {
	go func() {
		log.Printf("[METRICS RECORDER] Historical metrics recorder started (interval: %v)", r.interval)
		ticker := time.NewTicker(r.interval)
		pruneTicker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()
		defer pruneTicker.Stop()

		// Initial record on startup
		r.recordSnapshot()

		for {
			select {
			case <-r.stopCh:
				log.Println("[METRICS RECORDER] Stopped recorder worker")
				return
			case <-ticker.C:
				r.recordSnapshot()
			case <-pruneTicker.C:
				// Automatically prune metrics older than 30 days
				if deleted, err := r.db.PruneOldMetrics(30); err == nil && deleted > 0 {
					log.Printf("[METRICS RECORDER] Pruned %d historical metric snapshots older than 30 days", deleted)
				}
			}
		}
	}()
}

func (r *Recorder) Stop() {
	close(r.stopCh)
}

func (r *Recorder) recordSnapshot() {
	// Reuse the live snapshot if a dashboard is connected; otherwise take a
	// lightweight sample (no process table scan, no per-core CPU).
	m := r.collector.Latest(10 * time.Second)
	if m == nil {
		var err error
		m, err = r.collector.CollectLite()
		if err != nil || m == nil {
			return
		}
	}

	var diskUsedPercent float64
	if len(m.Disks) > 0 {
		diskUsedPercent = m.Disks[0].UsedPercent
	}

	var netRecvSpeed, netSentSpeed uint64
	for _, nic := range m.Network {
		netRecvSpeed += nic.SpeedRecvPerSec
		netSentSpeed += nic.SpeedSentPerSec
	}

	point := models.MetricHistoryPoint{
		Timestamp:         m.Timestamp,
		CPUPercent:        m.CPU.OverallPercent,
		CPUMax:            m.CPU.OverallPercent,
		MemoryPercent:     m.Memory.UsedPercent,
		MemoryUsed:        m.Memory.Used,
		DiskUsedPercent:   diskUsedPercent,
		NetRecvSpeed:      netRecvSpeed,
		NetSentSpeed:      netSentSpeed,
		Load1:             m.CPU.Load1,
		ContainersRunning: m.Docker.RunningCount,
	}

	if err := r.db.InsertMetricSnapshot(point); err != nil {
		log.Printf("[METRICS RECORDER] Failed to insert metric snapshot: %v", err)
	}
}
