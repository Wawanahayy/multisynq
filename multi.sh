#!/usr/bin/env bash
set -e

DASHBOARD_HTTP_PORT=8000
DASHBOARD_METRICS_PORT=8100

# ========== Menu ==========
menu() {
  clear
  echo "======= Multisynq CLI Manajemen Multi-Proxy ======="
  echo "  Catatan: Ini adalah skrip gratis! open source"
  echo "==============================================="
  echo "1) Instal dependensi (Node, Docker, CLI)"
  echo "2) Generate banyak konfigurasi .env.mX"
  echo "3) Jalankan semua node (pm2, termasuk proxy)"
  echo "4) Lihat status node (pm2 ls)"
  echo "5) Lihat log node (pilih node)"
  echo "6) Hentikan semua node & bersihkan container"
  echo "7) Cek poin (mendukung multi-proxy)"
  echo "8) Jalankan dashboard (opsional password)"
  echo "9) Cek update Docker image"
  echo "10) Cek status sistem dan log layanan"
  echo "0) Keluar"
  echo "==============================================="
  read -rp "Masukkan pilihan: " opt
  case $opt in
    1) install_dep ;;
    2) gen_envs ;;
    3) start_nodes ;;
    4) pm2 ls; read -rp "Tekan Enter untuk melanjutkan..." ;;
    5) show_logs ;;
    6) stop_all ;;
    7) check_points ;;
    8) start_dashboard ;;
    9) synchronize check-updates; read -rp "Tekan Enter untuk melanjutkan..." ;;
    10) synchronize status; read -rp "Tekan Enter untuk melanjutkan..." ;;
    0) exit 0 ;;
    *) echo "❌ Pilihan tidak valid"; sleep 1 ;;
  esac
}

# ========== Instal Dependensi ==========
install_dep() {
  command -v node &>/dev/null || {
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt install -y nodejs
  }
  command -v docker &>/dev/null || {
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER
  }
  sudo npm i -g pm2 synchronizer-cli
  synchronize install-docker
  echo "✅ Dependensi berhasil diinstal"
  read -rp "Tekan Enter untuk melanjutkan..."
}

# ========== Generate Config ==========
gen_envs() {
  CONFIG_DIR="/root/.synchronizer-cli"
  
  echo "🌀 Mulai loop generate .env.mX dan config.jsonX (tekan Ctrl + C untuk berhenti)"

  while true; do
    echo
    echo "================ Putaran baru dimulai ================"

    if ! command -v synchronize &>/dev/null; then
      echo "❌ Perintah synchronize tidak ditemukan, pastikan sudah terinstal."
      read -rp "Tekan Enter untuk melanjutkan..."
      return 1
    fi

    echo "🚀 Menjalankan: synchronize init ..."
    synchronize init

    CONFIG_FILE="$CONFIG_DIR/config.json"
    if [ ! -f "$CONFIG_FILE" ]; then
      echo "❌ $CONFIG_FILE tidak ditemukan, lewati putaran ini."
      read -rp "Tekan Enter untuk melanjutkan..."
      continue
    fi

    WALLET=$(jq -r .wallet "$CONFIG_FILE")
    KEY=$(jq -r .key "$CONFIG_FILE")
    SYNC_NAME=$(jq -r .syncHash "$CONFIG_FILE")

    read -rp "🌐 Masukkan alamat proxy (cth: http://user:pass@ip:port), kosongkan jika tidak ada: " PROXY
    PROXY=$(echo "$PROXY" | tr -d '[:space:]')

    if [[ -z "$WALLET" || -z "$KEY" || -z "$SYNC_NAME" ]]; then
      echo "❌ Field wajib (WALLET, KEY, SYNC_NAME) kosong, lewati"
      read -rp "Tekan Enter untuk melanjutkan..."
      continue
    fi

    idx=1
    while [ -e ".env.m$idx" ]; do
      idx=$((idx+1))
    done
    env_file=".env.m$idx"

    {
      echo "WALLET=$WALLET"
      echo "KEY=$KEY"
      echo "SYNC_NAME=$SYNC_NAME"
      [[ -n "$PROXY" ]] && echo "PROXY=$PROXY"
    } > "$env_file"

    echo "✅ Dibuat: $env_file"

    j=1
    while [ -e "$CONFIG_DIR/config.json$j" ]; do
      j=$((j+1))
    done
    mv "$CONFIG_FILE" "$CONFIG_DIR/config.json$j"
    echo "📦 config.json disimpan sebagai: config.json$j"

    echo "✅ Putaran selesai. Siap lanjut (Ctrl + C untuk berhenti)..."
    read -rp "Tekan Enter untuk melanjutkan..."
  done
}

# ========== Menjalankan Semua Node ==========
start_nodes() {
  pm2 delete all &>/dev/null || true
  docker ps -aq --filter "name=synchronizer-" | xargs -r docker rm -f
  idx=1
  for f in .env.m*; do
    [[ -f $f ]] || continue
    name="${f##*.}"
    source "$f"
    if [[ -z $SYNC_NAME ]]; then
      echo "❌ $f tidak memiliki SYNC_NAME, lewati"
      continue
    fi
    if [[ -n $PROXY ]]; then
      echo "🚀 Menjalankan $name dengan proxy $PROXY (sync-name: $SYNC_NAME)"
      pm2 start bash --name "$name" -- -c \
        "http_proxy=$PROXY HTTPS_PROXY=$PROXY \
        docker run --rm --name synchronizer-$name \
        --platform linux/amd64 \
        cdrakep/synqchronizer:latest \
        --depin wss://api.multisynq.io/depin \
        --sync-name $SYNC_NAME \
        --launcher cli-2.6.1/docker-2025-06-24 \
        --key $KEY \
        --wallet $WALLET \
        --time-stabilized"
    else
      echo "🚀 Menjalankan $name tanpa proxy (sync-name: $SYNC_NAME)"
      pm2 start bash --name "$name" -- -c \
        "docker run --rm --name synchronizer-$name \
        --platform linux/amd64 \
        cdrakep/synqchronizer:latest \
        --depin wss://api.multisynq.io/depin \
        --sync-name $SYNC_NAME \
        --launcher cli-2.6.1/docker-2025-06-24 \
        --key $KEY \
        --wallet $WALLET \
        --time-stabilized"
    fi
    idx=$((idx+1))
  done
  echo "✅ Semua node telah dijalankan"
  read -rp "Tekan Enter untuk melanjutkan..."
}

# ========== Hentikan Semua ==========
stop_all() {
  pm2 stop all || true
  pm2 delete all || true
  docker ps -aq --filter "name=synchronizer-" | xargs -r docker rm -f
  echo "✅ Semua node dan container dihentikan"
  read -rp "Tekan Enter untuk melanjutkan..."
}

# ========== Tampilkan Log ==========
show_logs() {
  echo "Node yang tersedia:"
  pm2 ls | awk 'NR>3 && $2 !~ /-/ {print $2}' | sort | uniq || echo "Tidak ada node yang berjalan"
  echo "File .env yang tersedia:"
  ls .env.m* 2>/dev/null | sed 's/.env.//' || echo "Tidak ada file .env.m*"
  read -rp $'\nMasukkan nama node (misal m1), atau kosongkan untuk lihat semua: ' name
  if [[ -n $name ]]; then
    if pm2 list | grep -q "$name"; then
      pm2 logs "$name" --lines 50
    else
      echo "❌ Node $name tidak berjalan"
    fi
  else
    pm2 logs --lines 50
  fi
  read -rp "Tekan Enter untuk melanjutkan..."
}

# ========== Cek Poin ==========
check_points() {
  echo "Cek poin dari semua .env.mX..."
  for f in .env.m*; do
    [[ -f $f ]] || continue
    name="${f##*.}"
    source "$f"
    echo -e "\n🔹 [$name] $WALLET (sync-name: $SYNC_NAME)"
    url="https://startsynqing.com/api/external/multisynq/synqers/$WALLET"
    result=$(curl -s "$url")
    credits=$(echo "$result" | grep -o '"serviceCredits":[0-9]*' | cut -d':' -f2)
    if [[ -n $credits ]]; then
      echo "✅ Total poin: $credits"
    else
      echo "❌ Gagal cek via API, coba lewat CLI..."
      synchronize points "$WALLET"
    fi
  done
  read -rp "Tekan Enter untuk melanjutkan..."
}

# ========== Jalankan Dashboard ==========
start_dashboard() {
  echo "Ingin jalankan dashboard untuk satu node saja? (y/N)"
  read -r single
  if [[ $single == "y" || $single == "Y" ]]; then
    ls .env.m* | sed 's/.env.//'
    read -rp "Masukkan nama node (misal m1): " name
    [[ -f ".env.$name" ]] || { echo "❌ Konfigurasi tidak ditemukan"; read -rp "Tekan Enter untuk melanjutkan..."; return; }
    source ".env.$name"
    port=$((DASHBOARD_HTTP_PORT + ${name#m}))
    cid=$(docker ps --filter "name=synchronizer-$name" -q)
    [[ -z $cid ]] && { echo "⚠️ Container tidak berjalan"; read -rp "Tekan Enter untuk melanjutkan..."; return; }
    read -rp "Password dashboard (opsional): " pwd
    if [[ -n $pwd ]]; then
      synchronize web --port "$port" --password "$pwd" --container "$cid" &
    else
      synchronize web --port "$port" --container "$cid" &
    fi
    echo "🌐 Dashboard tersedia di: http://localhost:$port"
  else
    idx=1
    for f in .env.m*; do
      [[ -f $f ]] || continue
      name="${f##*.}"
      port=$((DASHBOARD_HTTP_PORT + idx))
      cid=$(docker ps --filter "name=synchronizer-$name" -q)
      [[ -n $cid ]] && synchronize web --port "$port" --container "$cid" &
      echo "🌐 [$name] http://localhost:$port"
      idx=$((idx+1))
    done
  fi
  read -rp "Tekan Enter untuk melanjutkan..."
}

# ========== Loop Utama ==========
while true; do menu; done
