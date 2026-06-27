#!/usr/bin/env bash
# Bootstrap an EC2 Linux instance for Online Judge (Docker + compose + judge runtimes).
# Run as root or with sudo: curl -fsSL ... | bash   OR   sudo bash deploy/ec2-setup.sh
set -euo pipefail

OJ_HOME="${OJ_HOME:-/opt/online-judge}"
OJ_USER="${OJ_USER:-ec2-user}"

echo "==> Installing Docker (if missing)"
if ! command -v docker &>/dev/null; then
  if [ -f /etc/os-release ]; then
    . /etc/os-release
  fi
  case "${ID:-}" in
    amzn)
      dnf update -y
      dnf install -y docker
      systemctl enable --now docker
      usermod -aG docker "$OJ_USER" || true
      ;;
    ubuntu|debian)
      apt-get update -y
      apt-get install -y ca-certificates curl gnupg
      install -m 0755 -d /etc/apt/keyrings
      curl -fsSL https://download.docker.com/linux/${ID}/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
      chmod a+r /etc/apt/keyrings/docker.gpg
      echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/${ID} \
        $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
        > /etc/apt/sources.list.d/docker.list
      apt-get update -y
      apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
      usermod -aG docker "$OJ_USER" || true
      ;;
    *)
      echo "Unsupported distro. Install Docker manually, then re-run from 'compose plugin' step."
      exit 1
      ;;
  esac
fi

echo "==> Ensuring Docker Compose plugin"
if ! docker compose version &>/dev/null; then
  echo "Docker Compose v2 plugin not found. Install docker-compose-plugin for your distro."
  exit 1
fi

echo "==> Creating app directory: $OJ_HOME"
mkdir -p "$OJ_HOME"
chown -R "$OJ_USER:$OJ_USER" "$OJ_HOME" 2>/dev/null || true

echo "==> Optional: mount EBS volume for persistent data"
echo "    If you attached an EBS volume, format and mount it before first deploy, e.g.:"
echo "      mkfs -t xfs /dev/nvme1n1"
echo "      mkdir -p /data/oj"
echo "      mount /dev/nvme1n1 /data/oj"
echo "    Then point compose volumes or bind-mounts at /data/oj (see deploy/README.md)."

if [ -d "$OJ_HOME/.git" ] || [ -f "$OJ_HOME/docker-compose.prod.yml" ]; then
  echo "==> Building judge runtime images on host (required for submissions)"
  cd "$OJ_HOME"
  sudo -u "$OJ_USER" npm run build:images || npm run build:images
else
  echo "==> Clone or copy the repo to $OJ_HOME, then run:"
  echo "      cd $OJ_HOME && npm run build:images"
fi

echo ""
echo "Setup complete. Next steps:"
echo "  1. Copy .env.production.example to .env.production and set JWT_ACCESS_SECRET"
echo "  2. Build & push images to ECR (see deploy/README.md)"
echo "  3. docker compose -f docker-compose.prod.yml --env-file .env.production up -d"
echo "  4. Point DNS to this instance and enable TLS (certbot or ALB)"
