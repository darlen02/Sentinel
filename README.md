# 🛡️ Sentinel - Ubuntu Sunucu Kaynak İzleme & Güvenlik Paneli

Sentinel, Ubuntu ve Linux sunucularınızın donanım ve işletim sistemi kaynaklarını Docker konteyneri içerisinden **anlık (real-time)** olarak izleyen, yüksek güvenlikli, modern bir web kontrol merkezidir.

---

## ✨ Özellikler

- ⚡ **Go (Golang) Backend**: Düşük kaynak tüketimi, yüksek performans ve güvenilir eşzamanlılık (concurrency).
- ⚛️ **React 19 & TypeScript Frontend**: Tailwind CSS ile tasarlanmış modern Cyber/SOC karanlık tema (dark mode).
- 🔄 **Canlı WebSocket Telemetrisi**: 1.5 saniyelik aralıklarla kesintisiz veri akışı ve otomatik yeniden bağlanma (auto-reconnect).
- 💾 **Yerel Veritabanı (SQLite - Pure Go)**: Harici veritabanı kurulumu gerektirmeyen, konteyner dışında `./data/sentinel.db` altında saklanan kalıcı yerel veritabanı.
- 🔐 **Gelişmiş Güvenlik**:
  - **Bcrypt** ile güvenli parola şifreleme.
  - **JWT (JSON Web Token)** oturum yönetimi.
  - Giriş denemelerine karşı **Brute-Force Rate Limiting** koruması.
  - Host dosya sistemine yalnızca **Salt-Okunur (Read-Only)** erişim.
- 📊 **İzlenen Metrikler**:
  - **🐳 Docker Konteynerleri (Yeni)**: Ubuntu sunucudaki tüm aktif, duraklatılmış ve durdurulmuş Docker konteynerleri, imaj isimleri, port yönlendirmeleri, çalışma süreleri ve doğrudan web arayüzünden **Yeniden Başlat (Restart)** / **Durdur (Stop)** / **Başlat (Start)** kontrolleri.
  - **⚙️ Anlık Süreç Listesi (Processes)**: Çalışan tüm süreçlerin PID, Kullanıcı, CPU %, RAM %, RSS bellek boyutları ve detaylı komut satırı argümanları (`cmdline`) ile aranması, filtrelenmesi ve istenmeyen süreçlerin tek tıkla sonlandırılması (`kill`).
  - **İşlemci (CPU)**: Toplam yük %, çekirdek başına anlık dağılım (C0, C1...), frekans (GHz), 1/5/15 dk Load Average ve canlı grafik.
  - **Bellek (RAM & Swap)**: Kullanılan, boş ve toplam RAM, Swap takas alanı ve canlı tüketim grafiği.
  - **Depolama & Diskler**: Kök dizin (`/`) ve tüm bağlı bölümler, doluluk oranları ve canlı **Disk Okuma/Yazma (R/W MB/s)** hızları.
  - **Ağ Trafiği (Network)**: Tüm ağ arayüzleri (eth0, ens3, docker0 vb.), anlık indirme/yükleme (KB/s, MB/s) ve toplam paket sayıları.
  - **Sistem Bilgisi**: Hostname, Dağıtım sürümü (örn: Ubuntu 24.04 LTS), Kernel sürümü, Mimari ve canlı Uptime sayacı.

---

## 🚀 Docker İle Hızlı Kurulum (Ubuntu Sunucuda)

Sunucunuzda Docker ve Docker Compose kuruluysa tek komutla başlatabilirsiniz:

```bash
# Proje dizinine gidin ve konteyneri derleyip başlatın
docker compose up -d --build
```

Konteyner başarıyla ayağa kalktığında:
- **Web Arayüzü**: `http://sunucu-ip-adresiniz:28475`
- **Varsayılan Kullanıcı Adı**: `admin`
- **Varsayılan Parola**: `admin`

*(Giriş yaptıktan sonra sağ üstteki "Şifre Değiştir" butonundan parolanızı kolayca güncelleyebilirsiniz.)*

---

## 🔒 Konteyner İçinden Ubuntu Host Kaynaklarını Okuma Mantığı

Konteynerin Ubuntu ana makinesinin metriklerini görebilmesi için `docker-compose.yml` dosyasında şu yapılandırmalar kullanılmıştır:

1. **`pid: "host"`**: Konteynerin ana makinedeki tüm çalışan süreçleri (process listesi) görebilmesini sağlar.
2. **Salt-Okunur Bağlantılar (Read-Only Volumes)**:
   - `/proc:/host/proc:ro`
   - `/sys:/host/sys:ro`
   - `/etc:/host/etc:ro`
   - `/:/host/root:ro`
   - `/var/run/docker.sock:/var/run/docker.sock` (Docker konteynerlerini okuma ve yönetme)
3. **Ortam Değişkenleri**: `HOST_PROC=/host/proc`, `HOST_SYS=/host/sys` ve `HOST_ROOT=/host/root` değişkenleri sayesinde Go metrik toplayıcısı doğrudan ana makinenin telemetri verilerini okur.

---

## 🛠️ Yerel Geliştirme (Local Development)

Projeyi kendi bilgisayarınızda geliştirmek isterseniz:

### 1. Backend'i Başlatma (Terminal 1)
```bash
cd backend
go run ./cmd/server
# Backend http://localhost:28475 üzerinde çalışır
```

### 2. Frontend'i Başlatma (Terminal 2)
```bash
cd frontend
npm install
npm run dev
# Vite dev server http://localhost:5173 üzerinde çalışır (API isteklerini :28475'e proxy eder)
```

---

## 📁 Proje Dizin Yapısı

```
Sentinel/
├── backend/
│   ├── cmd/server/main.go            # Giriş noktası, Gin router & static dosya sunumu
│   ├── internal/
│   │   ├── auth/                     # JWT, Bcrypt, Login handler & Rate limiter
│   │   ├── database/                 # SQLite bağlantısı & şema yönetimi
│   │   ├── metrics/                  # Linux/Ubuntu donanım metrikleri toplayıcısı
│   │   ├── models/                   # JSON ve veri yapıları
│   │   └── ws/                       # WebSocket bağlantı yöneticisi (Hub)
│   ├── go.mod
│   └── go.sum
├── frontend/
│   ├── src/
│   │   ├── components/               # Navbar, CpuCard, MemoryCard, DiskCard, ProcessTable vb.
│   │   ├── pages/                    # Login.tsx ve Dashboard.tsx
│   │   ├── services/                 # api.ts (REST) ve ws.ts (WebSocket)
│   │   ├── types/                    # TypeScript tipleri
│   │   └── App.tsx                   # Ana uygulama & yetkilendirme yönlendirmesi
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
├── Dockerfile                        # Multi-stage Docker yapılandırması
├── docker-compose.yml                # Ubuntu host bağlantılı docker compose
└── README.md
```
