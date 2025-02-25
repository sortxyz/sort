ip=$(curl -s https://checkip.amazonaws.com)

echo "Your IP is $ip"
echo "Generating self-signed cert.."

dir="$(pwd)/nginx-proxy/certs"

if [ -f "$dir/selfsigned.crt" ]; then
  echo "Certificate already exists"
  exit 0
fi

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "$dir/selfsigned.key" -out "$dir/selfsigned.crt" \
  -subj "/CN=$ip"

echo "done"
