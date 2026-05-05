#!/bin/bash

# Configuration
BACKUP_DB_NAME="ernad_mes_backup"
DB_USER="postgres"
BACKUP_DIR="/var/backups/mes_db"
LATEST_BACKUP=$(ls -t ${BACKUP_DIR}/mes_backup_*.sql.gz | head -1)
LOG_FILE="${BACKUP_DIR}/restore.log"
DATE=$(date +%Y%m%d_%H%M%S)

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '#' | xargs)
fi

if [ -z "$BACKUP_DB_URL" ]; then
    echo "ERROR: BACKUP_DB_URL not found in .env"
    exit 1
fi

# CRITICAL SAFETY CHECK
if [[ "$BACKUP_DB_URL" == *"$PROD_DB_URL"* ]]; then
    echo "FATAL ERROR: BACKUP_DB_URL matches PROD_DB_URL! Aborting to prevent production overwrite."
    exit 1
fi

echo "[${DATE}] TARGET: Restoring into BACKUP_DB_URL" >> ${LOG_FILE}
echo "[${DATE}] WARNING: This will overwrite data in the backup database!" >> ${LOG_FILE}

if [ -z "${LATEST_BACKUP}" ]; then
    echo "[${DATE}] ERROR: No backup file found in ${BACKUP_DIR}" >> ${LOG_FILE}
    exit 1
fi

# Restore process
# Using --clean --if-exists for a safer but thorough restore
gunzip -c ${LATEST_BACKUP} | pg_restore -d "${BACKUP_DB_URL}" --clean --if-exists -Fc

if [ $? -eq 0 ]; then
    echo "[${DATE}] Restore successful into backup database" >> ${LOG_FILE}
    
    # Optional: Enforce Read-Only on backup DB (If using psql and appropriate permissions)
    # psql "${BACKUP_DB_URL}" -c "ALTER DATABASE CURRENT SET default_transaction_read_only = on;"
else
    echo "[${DATE}] ERROR: Restore failed!" >> ${LOG_FILE}
    exit 1
fi

