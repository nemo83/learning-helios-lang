# README


## Run Cardano Node

Ensure relevant foldersa are created in

`/Users/giovanni/.data`


NETWORK=preprod; docker run -d \
    --name "cardano-node-${NETWORK}" \
    -v "/Users/giovanni/.data/${NETWORK}:/data" \
    -e "NETWORK=${NETWORK}" \
    inputoutput/cardano-node:1.35.5

### Raul Tweet

https://twitter.com/ElRaulito_cnft/status/1625156894800191490