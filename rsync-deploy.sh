#!/bin/bash
rsync -az --delete --exclude='.git' --exclude='.next' --exclude='node_modules' --exclude='*.db' --exclude='.env' --exclude='.env.local' --exclude='cast-images' /home/takan/vliverlab-hp/ ubuntu@219.94.244.166:/opt/apps/vliverlab-hp/
