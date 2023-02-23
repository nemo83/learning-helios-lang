#!/bin/zsh

./stop-preprod.sh || exit 0 && ./start-preprod.sh
