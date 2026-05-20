async function getMetadataHashBase64(metadata) {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(metadata));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  const base64 = btoa(String.fromCharCode(...hashArray));

  console.log("%c✅ Base64 Metadata Hash (copy this):", "color:lime;font-size:14px");
  console.log(base64);
  return base64;
}

// Paste your metadata here ↓
const myMetadata = {
  "name": "ProtoToken",
  "unitName": "PRTO",
  "decimals": 6,
  "image": "https://gateway.pinata.cloud/ipfs/bafkreihfwrwccv6alv7rnx7tqbvpjmtjz7oqjsopqctsaclprsjdxes53e#arc3",
  "image_mimetype": "image/jpeg",
  "properties": {
    "creator": "3QGVUVQGHVZZYUNFGS4XDTRFMCMY3LIXQO4TRWXFE7YDML3D2NDSK6HPHQ",
    "type": "Fungible"
  }
};

getMetadataHashBase64(myMetadata);
