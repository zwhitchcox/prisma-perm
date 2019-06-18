import { execSync } from "child_process";
import { task, toRun } from "./tasks";

toRun(process.argv.slice(2)[0])

task('deploy', () => {
  execSync('prisma deploy', {stdio: 'inherit'})
}, 'generate')

task('generate', ['generate:prisma-perm', 'generate:prisma'])
task('generate:prisma-perm', () => execSync('node -r ts-node/register ../../generate-cli.ts'))
task('generate:prisma', () => execSync('prisma generate'))