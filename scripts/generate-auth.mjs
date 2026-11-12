import {
    randomBytes,
    scryptSync,
  } from "node:crypto";
  
  import { createInterface } from "node:readline/promises";
  
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  const password = await readline.question(
    "Digite a senha do Breton BI: "
  );
  
  readline.close();
  
  if (password.length < 12) {
    console.error("Use uma senha de pelo menos 12 caracteres.");
    process.exit(1);
  }
  
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  
  console.log("\nAUTH_PASSWORD_HASH=");
  console.log(`${salt}:${hash}`);
  
  console.log("\nAUTH_SECRET=");
  console.log(randomBytes(48).toString("hex"));