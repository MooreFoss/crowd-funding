import "server-only";

function readRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const serverEnv = {
  get databaseUrl() {
    return readRequiredEnv("DATABASE_URL");
  },
};
