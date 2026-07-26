const argon2 = require('argon2');

async function hashPlaintext(plaintext) {
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new Error('plaintext must be a non-empty string');
  }

  return argon2.hash(plaintext, {
    type: argon2.argon2id,
    memoryCost: 2 ** 16,
    timeCost: 3,
    parallelism: 1,
  });
}

async function verifyPlaintextAgainstHash(plaintext, hashText) {
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new Error('plaintext must be a non-empty string');
  }

  if (typeof hashText !== 'string' || hashText.length === 0) {
    throw new Error('hashText must be a non-empty string');
  }

  return argon2.verify(hashText, plaintext);
}

(async () => {
  const [, , command, arg1, arg2] = process.argv;

  if (command === 'verify') {
    const hashText = arg1;
    const plaintext = arg2;

    const isMatch = await verifyPlaintextAgainstHash(plaintext, hashText);
    console.log(isMatch);
    return;
  }

  // Keep original behavior by default.
  const plaintext = command || 'password123';
  const hash = await hashPlaintext(plaintext);
  console.log(hash);
})();