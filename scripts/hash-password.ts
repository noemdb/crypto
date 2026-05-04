import bcrypt from 'bcryptjs'

async function main() {
  const password = process.argv[2]
  if (!password) {
    console.error('Usage: npx tsx scripts/hash-password.ts "your-password"')
    process.exit(1)
  }

  // Base64 encode para evitar expansión de $ en dotenv de Next.js
  const hash = await bcrypt.hash(password, 12)
  const hashB64 = Buffer.from(hash).toString('base64')
  console.log('\nADMIN_PASSWORD_HASH_B64="' + hashB64 + '"')
  console.log('\nCopiar esta línea a .env (comillas dobles — el valor no tiene $)\n')
}

main().catch(console.error)
