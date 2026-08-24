import "dotenv/config";
import { hashPassword } from "../app/lib/auth/register";
import { prisma } from "../app/lib/prisma";

// Public demo credentials, documented in the README. Re-running this script
// resets the password back to this value if a demo visitor changes it.
const DEMO_EMAIL = "demo@passkeyforge.dev";
const DEMO_PASSWORD = "PasskeyForge!Demo1";

async function main() {
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { passwordHash },
    create: { email: DEMO_EMAIL, passwordHash },
  });

  console.log(`Seeded demo account: ${user.email}`);
  console.log(`Password: ${DEMO_PASSWORD}`);
  console.log(
    "Sign in with the password first — passkeys are device-bound, so none can be pre-seeded. Add one from the home page afterward.",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
