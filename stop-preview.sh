#!/bin/zsh

NETWORK=preview; docker stop "cardano-node-${NETWORK}" || exit 0 && docker rm "cardano-node-${NETWORK}"
