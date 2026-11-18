import { describe, expect, it } from 'vitest'
import { DEFAULTS, deployPlan, servesBuild } from './deploy.mjs'

describe('deployPlan', () => {
  it('rsyncs dist to the production VPS and checks the public site when nothing is set', () => {
    expect(deployPlan({})).toEqual({
      rsyncArgs: ['-az', '--delete', 'dist/', 'root@187.124.159.132:/var/www/fiddlesticks/'],
      url: DEFAULTS.url,
    })
  })

  it('takes the user, host, path and address from the environment', () => {
    const plan = deployPlan({
      DEPLOY_USER: 'deploy',
      DEPLOY_HOST: 'example.test',
      DEPLOY_PATH: '/srv/site',
      DEPLOY_URL: 'https://example.test/',
    })
    expect(plan.rsyncArgs.at(-1)).toBe('deploy@example.test:/srv/site/')
    expect(plan.url).toBe('https://example.test/')
  })

  it('keeps a single trailing slash on the web root, so rsync copies dist into it and not beside it', () => {
    expect(deployPlan({ DEPLOY_PATH: '/srv/site//' }).rsyncArgs.at(-1)).toBe('root@187.124.159.132:/srv/site/')
  })

  it('refuses the filesystem root as the web root, since rsync --delete would wipe the server', () => {
    expect(() => deployPlan({ DEPLOY_PATH: '/' })).toThrow('DEPLOY_PATH')
    expect(() => deployPlan({ DEPLOY_PATH: '//' })).toThrow('DEPLOY_PATH')
  })

  it('points ssh at the key in DEPLOY_SSH_KEY, quoted so a path with spaces stays one argument', () => {
    expect(deployPlan({ DEPLOY_SSH_KEY: '/tmp/my key' }).rsyncArgs).toEqual([
      '-az',
      '--delete',
      '-e',
      'ssh -i "/tmp/my key" -o IdentitiesOnly=yes',
      'dist/',
      'root@187.124.159.132:/var/www/fiddlesticks/',
    ])
  })
})

describe('servesBuild', () => {
  const built = '<script src="/assets/main-abc123.js"></script>\n'

  it('accepts the page that was just built', () => {
    expect(servesBuild('<script src="/assets/main-abc123.js"></script>', built)).toBe(true)
  })

  it('rejects a page from an older build', () => {
    expect(servesBuild('<script src="/assets/main-old999.js"></script>', built)).toBe(false)
  })
})
