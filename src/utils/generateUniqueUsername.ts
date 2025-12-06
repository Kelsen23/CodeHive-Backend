import prisma from "../config/prisma.js";

async function generateUniqueUsername(name: string) {
  let username = name;
  let counter = 1;

  while (await prisma.user.findUnique({ where: { username } })) {
    username = `${name}${counter++}`;
  }

  return username;
}

export default generateUniqueUsername;
