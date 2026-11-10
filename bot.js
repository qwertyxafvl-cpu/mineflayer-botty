const mineflayer = require('mineflayer')
const readline = require('readline')

const PASSWORD = 'aodbot'

const bot = mineflayer.createBot({
  host: 'aodplaygoats.aternos.me',
  port: 20061,
  username: 'Meowbot',
  auth: 'offline',
  version: '1.21.11'
})

let authed = false
let triedRegister = false
let lastCmd = 0

function sendCmd (cmd) {
  const now = Date.now()
  if (now - lastCmd < 3000) return // don't spam
  lastCmd = now
  console.log('Sending', cmd.split(' ')[0])
  bot.chat(cmd)
}

// Setup Readline for Command Prompt Input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

rl.on('line', (line) => {
  const text = line.trim()
  if (!text) return

  try {
    bot.chat(text)
    console.log(`[You -> Game] ${text}`)
  } catch (err) {
    console.log('Could not send chat (bot might not be connected yet):', err.message)
  }
})

// send login as soon as we are in (don't wait for 'spawn', the auth mod can delay it)
bot.once('login', () => {
  console.log('Joined the server. You can now type messages/commands here to send them in-game.')
  setTimeout(() => {
    if (!authed) sendCmd(`/login ${PASSWORD}`)
  }, 1500)
})

bot.on('messagestr', (msg) => {
  console.log('[Server]', msg.replace(/\n/g, ' | '))
  const m = msg.toLowerCase()

  // real success only: "You are now authenticated" / "successfully logged in"
  if (/(now|successfully|already) (authenticated|logged in)/.test(m)) {
    onAuthed()
    return
  }
  if (authed) return

  if (m.includes('wrong password') || m.includes('incorrect password')) {
    console.log('Server says the password is wrong. Change PASSWORD in the script.')
    return
  }

  // account doesn't exist yet -> register once
  if (m.includes('/register') && !triedRegister) {
    triedRegister = true
    lastCmd = 0
    sendCmd(`/register ${PASSWORD} ${PASSWORD}`)
    return
  }

  // server is asking us to log in -> answer it
  if (m.includes('/login') || m.includes('not authenticated')) {
    sendCmd(`/login ${PASSWORD}`)
  }
})

function onAuthed () {
  if (authed) return
  authed = true
  console.log('Authenticated.')
  setTimeout(clickTable, 2000)
}

bot.on('windowOpen', (win) => console.log('Crafting table GUI opened:', win.type))

async function clickTable () {
  const eye = bot.entity.position.offset(0, 1.62, 0)
  const found = bot.findBlocks({
    matching: (b) => b && b.name === 'crafting_table',
    maxDistance: 64,
    count: 10
  })

  console.log(`Bot is at ${bot.entity.position.floored()} - crafting tables found nearby: ${found.length}`)

  if (found.length === 0) {
    console.log('No crafting table loaded near the bot, retrying in 5s...')
    setTimeout(clickTable, 5000)
    return
  }

  // pick the closest one
  found.sort((a, b) => eye.distanceTo(a.offset(0.5, 0.5, 0.5)) - eye.distanceTo(b.offset(0.5, 0.5, 0.5)))
  const pos = found[0]
  const center = pos.offset(0.5, 0.5, 0.5)
  const dist = eye.distanceTo(center)

  // the server only accepts clicks within ~4.5 blocks, so anything further is silently ignored
  if (dist > 4.4) {
    console.log(`Nearest crafting table at ${pos} is ${dist.toFixed(1)} blocks away - too far to click. Move the bot closer (under 4 blocks).`)
    setTimeout(clickTable, 5000)
    return
  }

  const table = bot.blockAt(pos)
  try {
    await bot.lookAt(center, true)
    await Promise.race([
      bot.activateBlock(table),
      new Promise((resolve) => setTimeout(resolve, 5000))
    ])
    console.log(`Right-clicked crafting table at ${pos} (${dist.toFixed(1)} blocks away)`)
  } catch (err) {
    console.log('Click failed:', err.message, '- retrying in 5s...')
    setTimeout(clickTable, 5000)
  }
}

bot.on('kicked', (reason) => console.log('Kicked:', JSON.stringify(reason)))
bot.on('error', (err) => console.log('Error:', err.message))
bot.on('end', () => console.log('Disconnected.'))