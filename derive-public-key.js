const crypto = require('crypto');

// Your private key
const privateKeyHex = '98899380da07e430de776aff94a38c4171e825e83a1ed143c5943e215ad150cd';

// Convert hex to buffer
const privateKeyBuffer = Buffer.from(privateKeyHex, 'hex');

// Create key object
const privateKey = crypto.createPrivateKey({
    key: Buffer.concat([
        Buffer.from('302e0201010420', 'hex'), // ASN.1 header for P-256
        privateKeyBuffer,
        Buffer.from('a00706052b8104000a', 'hex') // P-256 curve OID
    ]),
    format: 'der',
    type: 'sec1'
});

// Derive public key
const publicKey = crypto.createPublicKey(privateKey);

// Export as compressed format
const publicKeyDer = publicKey.export({ type: 'spki', format: 'der' });

// Extract the 65-byte uncompressed public key (skip ASN.1 header)
const uncompressed = publicKeyDer.slice(-65);

// Compress it (take x-coordinate and add prefix based on y-coordinate)
const x = uncompressed.slice(1, 33);
const y = uncompressed.slice(33, 65);
const prefix = y[y.length - 1] % 2 === 0 ? '02' : '03';
const compressedPublicKey = prefix + x.toString('hex');

console.log('Private Key:', privateKeyHex);
console.log('Public Key (compressed):', compressedPublicKey);
console.log('\nAdd this to your .env:');
console.log('TURNKEY_API_KEY=' + privateKeyHex);
console.log('TURNKEY_API_SECRET=' + compressedPublicKey);
