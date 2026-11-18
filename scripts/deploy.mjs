// Deploys the built site (dist/) to the VPS, then checks the live site serves this build.
// Run after `npm run build`: `node scripts/deploy.mjs`. CI runs it on every push to main.
//
// Settings come from the environment, defaulting to the production VPS:
//   DEPLOY_USER, DEPLOY_HOST  who and where to rsync to (root, 187.124.159.132)
//   DEPLOY_PATH               the web root nginx serves (/var/www/fiddlesticks)
//   DEPLOY_URL                the public address to check afterwards (https://fiddlesticks.vawagners.cloud/)
//   DEPLOY_SSH_KEY            optional path to the private key ssh should use

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const DEFAULTS = {
  user: 'root',
  host: '187.124.159.132',
  path: '/var/www/fiddlesticks',
  url: 'https://fiddlesticks.vawagners.cloud/',
}

/** The rsync arguments and the address to check, from the environment. */
export function deployPlan(env) {
  const user = env.DEPLOY_USER || DEFAULTS.user
  const host = env.DEPLOY_HOST || DEFAULTS.host
  // The trailing slash makes rsync copy dist's contents, not a dist/ directory, into the web root.
  const path = (env.DEPLOY_PATH || DEFAULTS.path).replace(/\/*$/, '/')
  // rsync --delete into / would wipe the server.
  if (path === '/') throw new Error('DEPLOY_PATH must not be the filesystem root')
  const url = env.DEPLOY_URL || DEFAULTS.url
  const ssh = env.DEPLOY_SSH_KEY ? ['-e', `ssh -i ${env.DEPLOY_SSH_KEY} -o IdentitiesOnly=yes`] : []
  return { rsyncArgs: ['-az', '--delete', ...ssh, 'dist/', `${user}@${host}:${path}`], url }
}

/** Whether the page the site serves is the index.html just built: Vite's hashed asset names differ per build. */
export function servesBuild(servedHtml, builtHtml) {
  return servedHtml.trim() === builtHtml.trim()
}

async function main() {
  const { rsyncArgs, url } = deployPlan(process.env)
  console.log(`rsync ${rsyncArgs.join(' ')}`)
  execFileSync('rsync', rsyncArgs, { stdio: 'inherit' })

  const response = await fetch(url, { cache: 'no-store' })
  const served = await response.text()
  if (!response.ok || !servesBuild(served, readFileSync('dist/index.html', 'utf8'))) {
    throw new Error(`${url} answered ${response.status}, but not with the index.html just deployed`)
  }
  console.log(`${url} serves this build`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message)
    process.exit(1)
  })
}
