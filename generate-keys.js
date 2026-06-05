const webpush = require('web-push');
const fs = require('fs');

const vapidKeys = webpush.generateVAPIDKeys();

const envContent = `# Configuracion TOGO Notificaciones
PORT=3000
VAPID_EMAIL=admin@togo.bo
VAPID_PUBLIC_KEY=${vapidKeys.publicKey}
VAPID_PRIVATE_KEY=${vapidKeys.privateKey}
DB_PATH=./data.db
`;

fs.writeFileSync('.env', envContent);
console.log('Claves VAPID generadas y guardadas en .env');
console.log('Public Key:', vapidKeys.publicKey);
