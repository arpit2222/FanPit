const PearRuntime = require('pear-runtime')
const Hyperswarm = require('hyperswarm')
const Corestore = require('corestore')
const goodbye = require('graceful-goodbye')
const FramedStream = require('framed-stream')
const path = require('bare-path')
const dir = require('bare-storage')
const { isBareKit } = require('which-runtime')
const crypto = require('crypto')
const b4a = require('b4a')

const argv = (index) => Bare.argv[index + (isBareKit ? 0 : 2)]

const updaterConfig = {
  updates: argv(0) !== 'false',
  version: argv(1),
  upgrade: argv(2),
  name: argv(3),
  dir: argv(4) || dir.persistent(),
  app: argv(5)
}

const pipe = new FramedStream(Bare.IPC)
const store = new Corestore(path.join(updaterConfig.dir, 'pear-runtime', 'corestore'))
const swarm = new Hyperswarm()
const pear = new PearRuntime({ ...updaterConfig, swarm, store })

pear.updater.on('error', console.error)

swarm.on('connection', (connection) => {
  store.replicate(connection)
  connection.on('data', async (data) => {
    try {
      const msg = JSON.parse(data.toString())
      if (msg.type === 'core-key') {
        const coreKey = b4a.from(msg.key, 'hex')
        await trackCore(coreKey)
      }
    } catch(e) {}
  })
  
  if (myCore) {
    connection.write(JSON.stringify({ type: 'core-key', key: b4a.toString(myCore.key, 'hex') }))
  }
})

if (updaterConfig.updates !== false) {
  swarm.join(pear.updater.drive.core.discoveryKey, {
    client: true,
    server: false
  })
}

pear.updater.on('updating', () => pipe.write('updating'))
pear.updater.on('updated', () => pipe.write('updated'))

goodbye(async () => {
  await swarm.destroy()
  await pear.close()
  await store.close()
})

// === FANPIT LOGIC ===
let myCore = null
const trackedCores = new Set()

async function trackCore(key) {
  const keyHex = b4a.toString(key, 'hex')
  if (trackedCores.has(keyHex)) return
  trackedCores.add(keyHex)
  
  const core = store.get({ key })
  await core.ready()
  
  let lastLength = core.length
  
  // Read existing blocks
  for (let i = 0; i < lastLength; i++) {
    const block = await core.get(i)
    try {
      const post = JSON.parse(block.toString())
      pipe.write(JSON.stringify({ type: 'new-post', post }))
    } catch(e) {}
  }
  
  core.on('append', async () => {
    while (lastLength < core.length) {
      const block = await core.get(lastLength++)
      try {
        const post = JSON.parse(block.toString())
        pipe.write(JSON.stringify({ type: 'new-post', post }))
      } catch(e) {}
    }
  })
}

pipe.on('data', async (data) => {
  const msgStr = data.toString()
  if (msgStr === 'pear:applyUpdate') {
    await pear.ready()
    await pear.updater.applyUpdate()
    pipe.write('pear:updateApplied')
    return
  }
  
  let msg
  try {
    msg = JSON.parse(msgStr)
  } catch(e) {
    return
  }

  if (msg.type === 'join-team') {
    myCore = store.get({ name: 'fanpit-feed' })
    await myCore.ready()
    await trackCore(myCore.key)
    
    const topic = crypto.createHash('sha256').update(msg.teamName).digest()
    swarm.join(topic)
    pipe.write(JSON.stringify({ type: 'joined', teamName: msg.teamName, key: b4a.toString(myCore.key, 'hex') }))
  } else if (msg.type === 'post') {
    if (myCore) {
      const postObj = { text: msg.text, author: b4a.toString(myCore.key, 'hex').slice(0, 6), timestamp: Date.now() }
      await myCore.append(JSON.stringify(postObj))
    }
  }
})
