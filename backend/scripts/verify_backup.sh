#!/bin/bash

# Configuration
PROD_DB="ernad_mes"
BACKUP_DB="ernad_mes_backup"
DB_USER="postgres"
LOG_FILE="/var/backups/mes_db/verification.log"
DATE=$(date +%Y%m%d_%H%M%S)

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '#' | xargs)
fi

if [ -z "$PROD_DB_URL" ] || [ -z "$BACKUP_DB_URL" ]; then
    echo "ERROR: Database URLs not found in .env"
    exit 1
fi

echo "[${DATE}] Verifying backup integrity using environment URLs..." >> ${LOG_FILE}

# Compare row counts for critical tables
TABLES=("users" "production_batches" "production_logs")

for TABLE in "${TABLES[@]}"; do
    PROD_COUNT=$(psql "${PROD_DB_URL}" -t -c "SELECT COUNT(*) FROM ${TABLE};" | xargs)
    BACKUP_COUNT=$(psql "${BACKUP_DB_URL}" -t -c "SELECT COUNT(*) FROM ${TABLE};" | xargs)
    
    if [ "${PROD_COUNT}" == "${BACKUP_COUNT}" ]; then
        echo "[${DATE}] OK: ${TABLE} matches (${PROD_COUNT} rows)" >> ${LOG_FILE}
    else
        echo "[${DATE}] WARNING: ${TABLE} mismatch! Prod: ${PROD_COUNT}, Backup: ${BACKUP_COUNT}" >> ${LOG_FILE}
    fi
done
