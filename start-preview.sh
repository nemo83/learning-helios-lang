#!/bin/zsh

NETWORK=preview; docker run -d \
    --name "cardano-node-${NETWORK}" \
    -v "/Users/giovanni/.data/${NETWORK}:/data" \
    -v "/Users/giovanni/.data/${NETWORK}/ipc:/ipc" \
    -e "NETWORK=${NETWORK}" \
    -e CARDANO_NODE_SOCKET_PATH=/ipc/node.socket \
    inputoutput/cardano-node:1.35.5
