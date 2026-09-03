/* ============================================================
   GENERADOR DE QR POR CONSOLA  (tools/generar-qr.mjs)
   ============================================================
   Alternativa a tools/qr.html para quien prefiera la terminal.

   Uso:
     npx --yes qrcode "https://TU-URL/" -o tools/qr-expo-educativa-2026.png
   o, con este script (necesita el paquete `qrcode`):
     npm i -D qrcode
     node tools/generar-qr.mjs "https://TU-URL/"

   Genera PNG (1024 px) y SVG con los colores institucionales y
   corrección de errores nivel H.
   ============================================================ */
import { writeFileSync } from 'node:fs';

const url = process.argv[2];
if (!url) {
  console.error('Falta la URL.  Ej:  node tools/generar-qr.mjs "https://expo-educativa-ies11.vercel.app/"');
  process.exit(1);
}

let QR;
try {
  QR = await import('qrcode');
} catch {
  console.error('No está instalado el paquete "qrcode".');
  console.error('  Opción rápida sin instalar nada:');
  console.error('    npx --yes qrcode "' + url + '" -o tools/qr-expo-educativa-2026.png');
  console.error('  Opción con este script:');
  console.error('    npm i -D qrcode  &&  node tools/generar-qr.mjs "' + url + '"');
  process.exit(1);
}

const opciones = {
  errorCorrectionLevel: 'H',
  margin: 2,
  color: { dark: '#02447B', light: '#ffffff' },
};

await QR.toFile('tools/qr-expo-educativa-2026.png', url, { ...opciones, width: 1024 });
writeFileSync('tools/qr-expo-educativa-2026.svg', await QR.toString(url, { ...opciones, type: 'svg' }));

console.log('Listo:');
console.log('  tools/qr-expo-educativa-2026.png  (1024 px, para folletos)');
console.log('  tools/qr-expo-educativa-2026.svg  (vectorial, para banners)');
