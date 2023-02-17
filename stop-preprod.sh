#!/bin/zsh

NETWORK=preprod; docker stop "cardano-node-${NETWORK}" || 0 && docker rm "cardano-node-${NETWORK}"
