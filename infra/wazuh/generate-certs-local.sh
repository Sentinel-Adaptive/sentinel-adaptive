#!/usr/bin/env bash

trap 'status=$?; if [[ $status -ne 0 && -f /wazuh-certificates-tool.log ]]; then cat /wazuh-certificates-tool.log; fi' EXIT

cp /config/certs.yml /config.yml
cp /tool/wazuh-certs-tool.sh /wazuh-certs-tool.sh
chmod 700 /wazuh-certs-tool.sh

source /wazuh-certs-tool.sh -A

nodes_server="$(
  cert_parseYaml /config.yml |
    grep -E "nodes[_]+server[_]+[0-9]+=" |
    sed -e 's/nodes__server__[0-9]=//' |
    sed 's/"//g'
)"

cp /wazuh-certificates/* /certificates/
chmod -R 500 /certificates
chmod -R 400 /certificates/*
chown 1000:1000 /certificates/*
cp /certificates/root-ca.pem /certificates/root-ca-manager.pem
cp /certificates/root-ca.key /certificates/root-ca-manager.key
chown 999:999 /certificates/root-ca-manager.pem
chown 999:999 /certificates/root-ca-manager.key

for node_name in $nodes_server; do
  chown 999:999 "/certificates/${node_name}.pem"
  chown 999:999 "/certificates/${node_name}-key.pem"
done

echo "Wazuh certificates generated locally."
