#!/bin/bash
# Move to source directory
cd /root/GAMBA_SOURCE

# Pull the latest changes from GitHub (ignoring local package-lock changes)
git fetch origin main
git reset --hard origin/main

# Build and deploy server
cd server
npm install

# Build and deploy frontend
cd ../casino
npm install
npm run build

# Update the web root
rm -rf /var/www/notgamba.ru/*
cp -r dist/* /var/www/notgamba.ru/

# Restart the backend process
pm2 restart gamba-backend
