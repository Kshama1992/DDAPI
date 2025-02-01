const { writeFileSync } = require('fs');
const path = require('path');
const { generateKeyPairSync } = require('crypto');
const dotenv = require('dotenv');

dotenv.config();

function generateKeys() {
	try {
		const { privateKey, publicKey } = generateKeyPairSync('rsa', {
			modulusLength: 2048,
			publicKeyEncoding: {
				type: 'pkcs1',
				format: 'pem',
			},
			privateKeyEncoding: {
				type: 'pkcs1',
				format: 'pem',
				cipher: 'aes-256-cbc',
				passphrase: String(process.env.PRIVATE_KEY_PASSPHRASE),
			},
		});

		const { privateKey: refreshPrivateKey, publicKey: refreshPublicKey } = generateKeyPairSync('rsa', {
			modulusLength: 2048,
			publicKeyEncoding: {
				type: 'pkcs1',
				format: 'pem',
			},
			privateKeyEncoding: {
				type: 'pkcs1',
				format: 'pem',
				cipher: 'aes-256-cbc',
				passphrase: String(process.env.REFRESH_TOKEN_PASSPHRASE),
			},
		});

		writeFileSync(path.join(__dirname, '/keys/private.pem'), privateKey);
		writeFileSync(path.join(__dirname, '/keys/public.pem'), publicKey);

		writeFileSync(path.join(__dirname, '/keys/private-refresh.pem'), refreshPrivateKey);
		writeFileSync(path.join(__dirname, '/keys/public-refresh.pem'), refreshPublicKey);
	} catch (e) {
		console.error(e);
	}
}

generateKeys();
