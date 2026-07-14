const bridge = window.bridge
const decoder = new TextDecoder('utf-8')

const setupScreen = document.getElementById('setup-screen')
const chatScreen = document.getElementById('chat-screen')
const teamInput = document.getElementById('team-name')
const joinBtn = document.getElementById('join-btn')
const roomTitle = document.getElementById('room-title')
const myKeySpan = document.getElementById('my-key')
const walletAddressSpan = document.getElementById('wallet-address')
const walletBalanceSpan = document.getElementById('wallet-balance')
const feed = document.getElementById('feed')
const postInput = document.getElementById('post-text')
const postBtn = document.getElementById('post-btn')

// New Feature Elements
const homeScoreSpan = document.getElementById('home-score')
const awayScoreSpan = document.getElementById('away-score')
const btnHomeGoal = document.getElementById('btn-home-goal')
const btnAwayGoal = document.getElementById('btn-away-goal')
const btnSentiment = document.getElementById('btn-sentiment')
const sentimentResult = document.getElementById('sentiment-result')
const predHome = document.getElementById('pred-home')
const predAway = document.getElementById('pred-away')
const btnWager = document.getElementById('btn-wager')
const liveWagers = document.getElementById('live-wagers')

let homeScore = 0
let awayScore = 0

const workers = { main: '/workers/main.js' }
bridge.startWorker(workers.main)

bridge.onWorkerStdout(workers.main, (data) => console.log(decoder.decode(data)))
bridge.onWorkerStderr(workers.main, (data) => console.error(decoder.decode(data)))

bridge.onWorkerIPC(workers.main, (data) => {
  const msgStr = decoder.decode(data)
  
  if (msgStr === 'updating') return
  if (msgStr === 'updated') return
  
  let msg
  try {
    msg = JSON.parse(msgStr)
  } catch(e) {
    return
  }
  
  if (msg.type === 'joined') {
    setupScreen.style.display = 'none'
    chatScreen.style.display = 'flex'
    roomTitle.innerText = `Team: ${msg.teamName}`
    myKeySpan.innerText = `My ID: ${msg.key.slice(0,6)}`
    
    // Seed dummy users and messages for the demo
    setTimeout(() => {
      appendPost({ author: '8a9f2b', text: `Let's go ${msg.teamName}! Massive game this weekend. ⚽` });
    }, 400);
    setTimeout(() => {
      appendPost({ author: '3c1d9e', text: 'Has anyone seen the starting lineup yet?' });
    }, 800);
    setTimeout(() => {
      appendPost({ author: 'f4e2a1', text: 'Todavía no, pero espero que jueguen con dos delanteros.' }); // Spanish post to showcase QVAC translation
    }, 1200);

  } else if (msg.type === 'new-post') {
    appendPost(msg.post)
  } else if (msg.type === 'score-update') {
    if (msg.team === 'home') { homeScore++; homeScoreSpan.innerText = homeScore; }
    if (msg.team === 'away') { awayScore++; awayScoreSpan.innerText = awayScore; }
  } else if (msg.type === 'wager') {
    appendWager(msg.wager)
  }
})

// === SCOREBOARD LOGIC ===
btnHomeGoal.onclick = () => {
  bridge.writeWorkerIPC(workers.main, JSON.stringify({ type: 'score-update', team: 'home' }))
}
btnAwayGoal.onclick = () => {
  bridge.writeWorkerIPC(workers.main, JSON.stringify({ type: 'score-update', team: 'away' }))
}

// === WAGERING LOGIC ===
btnWager.onclick = async () => {
  const h = predHome.value
  const a = predAway.value
  if (h === '' || a === '') return
  
  btnWager.innerText = 'Signing Tx...'
  btnWager.disabled = true
  try {
    const tx = await bridge.wdkTransaction({ to: 'SmartContractEscrow', amount: '5.00' })
    const wagerObj = {
      author: myKeySpan.innerText.replace('My ID: ', ''),
      prediction: `${h} - ${a}`,
      txId: tx.txId.slice(0, 8)
    }
    bridge.writeWorkerIPC(workers.main, JSON.stringify({ type: 'wager', wager: wagerObj }))
    
    btnWager.innerText = 'Wager Locked 🔒'
    btnWager.style.background = '#6c757d'
  } catch(e) {
    btnWager.innerText = 'Failed'
    btnWager.disabled = false
  }
}

function appendWager(wager) {
  const div = document.createElement('div')
  div.className = 'prediction-card'
  div.style.background = 'rgba(25, 135, 84, 0.2)'
  div.innerHTML = `
    <h4 style="color:#20c997">${wager.author} wagered 5 USDt</h4>
    <div style="font-size:18px; font-weight:800; color:white;">Predicts: ${wager.prediction}</div>
    <div style="font-size:10px; color:#aaa; margin-top:5px;">Tx: ${wager.txId}</div>
  `
  liveWagers.prepend(div)
}

// === QVAC SENTIMENT LOGIC ===
btnSentiment.onclick = async () => {
  btnSentiment.innerText = '🧠 Analyzing...'
  btnSentiment.disabled = true
  
  // Grab recent feed text
  const texts = Array.from(document.querySelectorAll('.post-text')).slice(-10).map(el => el.innerText).join('. ')
  if (!texts) {
    sentimentResult.style.display = 'block'
    sentimentResult.innerText = "Not enough chat data to analyze sentiment."
    btnSentiment.innerText = '🧠 Summarize Sentiment'
    btnSentiment.disabled = false
    return
  }
  
  // Since we are mocking QVAC for the demo, we will simulate a realistic local sentiment analysis
  setTimeout(() => {
    sentimentResult.style.display = 'block'
    sentimentResult.innerText = "QVAC Sentiment Report: The community is highly energetic and optimistic about the current lineup, though some fans are anxious about the defense."
    btnSentiment.innerText = '🧠 Analyzed'
  }, 1500)
}

joinBtn.onclick = async () => {
  const teamName = teamInput.value.trim()
  if (teamName) {
    joinBtn.disabled = true
    joinBtn.innerText = 'Joining...'
    
    // Initialize WDK Wallet
    try {
      const wallet = await bridge.wdkCreate()
      walletAddressSpan.innerText = wallet.address
      walletBalanceSpan.innerText = `${wallet.balance} ${wallet.currency}`
    } catch(e) {
      walletAddressSpan.innerText = 'Wallet Error'
    }
    
    bridge.writeWorkerIPC(workers.main, JSON.stringify({ type: 'join-team', teamName }))
  }
}

postBtn.onclick = () => {
  const text = postInput.value.trim()
  if (text) {
    bridge.writeWorkerIPC(workers.main, JSON.stringify({ type: 'post', text }))
    postInput.value = ''
  }
}

postInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') postBtn.click()
})

function appendPost(post) {
  const isSelf = myKeySpan.innerText.includes(post.author);
  
  const div = document.createElement('div')
  div.className = 'post'
  if (isSelf) div.classList.add('self')
  
  const author = document.createElement('div')
  author.className = 'post-author'
  author.innerText = post.author
  const text = document.createElement('div')
  text.className = 'post-text'
  text.innerText = post.text
  
  const actionRow = document.createElement('div')
  actionRow.className = 'action-buttons'
  
  const transBtn = document.createElement('button')
  transBtn.className = 'action-btn'
  transBtn.innerText = '✨ Translate (QVAC)'
  transBtn.onclick = async () => {
    transBtn.innerText = 'Translating...'
    transBtn.disabled = true
    const result = await bridge.translate(post.text)
    const resDiv = document.createElement('div')
    resDiv.className = 'ai-result'
    resDiv.innerText = result
    div.appendChild(resDiv)
    transBtn.style.display = 'none'
  }
  
  const tipBtn = document.createElement('button')
  tipBtn.className = 'action-btn tip-btn'
  tipBtn.innerText = '💎 Tip 1 USDt (WDK)'
  tipBtn.onclick = async () => {
    tipBtn.innerText = 'Signing Tx...'
    tipBtn.disabled = true
    try {
      const tx = await bridge.wdkTransaction({ to: post.author, amount: '1.00' })
      tipBtn.innerText = 'Tipped! Tx: ' + tx.txId.slice(0, 8) + '...'
      tipBtn.style.color = '#198754'
      tipBtn.style.borderColor = '#198754'
    } catch(e) {
      tipBtn.innerText = 'Failed'
      tipBtn.style.color = '#dc3545'
      tipBtn.style.borderColor = '#dc3545'
    }
  }
  
  if (!isSelf) {
    actionRow.appendChild(transBtn)
    actionRow.appendChild(tipBtn)
  }
  
  div.appendChild(author)
  div.appendChild(text)
  if (!isSelf) {
    div.appendChild(actionRow)
  }
  
  feed.appendChild(div)
  feed.scrollTop = feed.scrollHeight
}
