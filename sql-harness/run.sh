#!/bin/sh
# Usage : MIGRATIONS_DIR=../supabase/migrations PGHOST=localhost PGUSER=postgres PGPASSWORD=... ./run.sh
# Prérequis : PostgreSQL 15+ avec les extensions pgvector et plpgsql_check disponibles.
set -u
DIR="$(cd "$(dirname "$0")" && pwd)"
MIG="${MIGRATIONS_DIR:-$DIR/../supabase/migrations}"
DB="${DB_NAME:-sn_check}"
psql -q -d postgres -c "drop database if exists $DB" -c "create database $DB" || exit 2
psql -q -d "$DB" -f "$DIR/00_stubs_supabase.sql" >/dev/null 2>&1
errors=0
for f in $(ls "$MIG"/*.sql | sort); do
  out=$(psql -q -d "$DB" -v ON_ERROR_STOP=0 -f "$f" 2>&1 | grep -E "ERROR|FATAL")
  if [ -n "$out" ]; then echo "MIGRATION EN ERREUR : $(basename "$f")"; echo "$out" | head -3; errors=$((errors+1)); fi
done
echo "--- Fonctions SQL en erreur contre le schéma réel ---"
res=$(psql -d "$DB" -f "$DIR/40_check_functions.sql" 2>&1 | grep -E '^[a-z_0-9]+\|')
[ -n "$res" ] && echo "$res"
n=$(echo "$res" | grep -c '|' || true)
echo "Migrations en erreur : $errors | Erreurs de fonctions : $n"
[ "$errors" -eq 0 ] && [ "$n" -eq 0 ] || exit 1
