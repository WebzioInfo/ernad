#!/bin/bash

# Configuration
DB_NAME="ernad_mes"
DB_USER="postgres"
BACKUP_DIR="/var/backups/mes_db"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/mes_backup_${DATE}.sql.gz"
LOG_FILE="${BACKUP_DIR}/backup.log"
RETENTION_DAYS=7

# Ensure backup directory exists
mkdir -p ${BACKUP_DIR}

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '#' | xargs)
fi

if [ -z "$PROD_DB_URL" ]; then
    echo "ERROR: PROD_DB_URL not found in .env"
    exit 1
fi

echo "[${DATE}] TARGET: Backing up database from PROD_DB_URL" >> ${LOG_FILE}

# Perform pg_dump with compression
pg_dump "${PROD_DB_URL}" -Fc | gzip > ${BACKUP_FILE}

if [ $? -eq 0 ]; then
    echo "[${DATE}] Backup successful: ${BACKUP_FILE}" >> ${LOG_FILE}
    
    # Prune old backups (Retention: 7 days)
    find ${BACKUP_DIR} -name "mes_backup_*.sql.gz" -mtime +${RETENTION_DAYS} -exec rm {} \;
    echo "[${DATE}] Old backups pruned." >> ${LOG_FILE}
else
    echo "[${DATE}] ERROR: Backup failed!" >> ${LOG_FILE}
    exit 1
fi

# Optional: Transfer to Backup Server (Uncomment and configure SSH keys)
# scp ${BACKUP_FILE} backup_user@backup_server_ip:/var/backups/mes_db/
