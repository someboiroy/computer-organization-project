window.addEventListener('load', () => {
  const opcodes = {
    'save': 0xA0,
    'load': 0xA1,
    'addthis': 0x2C,
    'subthis': 0x2D,
    'addfrom': 0x32,
    'subfrom': 0x33,
    'mulfrom': 0x34,
    'divthis': 0x35,
    'goto': 0x7F,
    'gotoif0': 0x80,
    'stop': 0x00
  }

  const numericOpCodes = [0xA0, 0xA1, 0x2C, 0x2D, 0x32, 0x34, 0x34, 0x7F, 0x80, 0x00]

  const opcodeOf = n => {
    if (typeof n === 'string' && n.toLowerCase() in opcodes) return opcodes[n.toLowerCase()]
    const num = parseInt(n)
    return numericOpCodes.includes(num) ? num : undefined
  }

  const animationDelay = () => {
    const delay = parseInt(document.getElementById('delay').value)
    return isNaN(delay) ? 0 : delay
  }

  const delay = (action, milliseconds) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => resolve(action()), milliseconds)
    })                     
  }

  const animate = async (cell, style) => {
    cell.classList.add(style)
    return await delay(() => cell.classList.remove(style), animationDelay())  
  }

  const write = async (cell, newValue) => {
    cell.value = newValue
    return animate(cell, 'write')
  }

  const numValue = value => {
    let result
    if (typeof value === 'number') return value
    let op = opcodeOf(value)
    if (op !== undefined) result = op
    else {
      result = parseInt(value)
      if (isNaN(result)) result = 0
    } 
    return result
  }

  const read = async (cell) => {
    let result = numValue(cell.value)
    await animate(cell, 'read')
    return result
  }

  const divide = (x, y) => y === 0 ? x : Math.floor(x / y)

  const memCells = []
  const pcCell = document.getElementById('pc')
  const axCell = document.getElementById('ax')
  let halted = false

  const step = async () => {
    let pc = await read(pcCell, 'read')
    let opcode = await read(memCells[pc])
    if (opcode === 0x00 || !numericOpCodes.includes(opcode)) return false
    let arg = await read(memCells[pc + 1])
    if (opcode === 0xA0) { // SAVE
      await write(memCells[arg], await read(axCell))
      pc += 2
    } else if (opcode === 0xA1) { // LOAD
      await write(axCell, await read(memCells[arg]))
      pc += 2
    } else if (opcode === 0x2C) { // ADDTHIS
      await write(axCell, await read(axCell) + arg)
      pc += 2
    } else if (opcode === 0x2D) { // SUBTHIS
      await write(axCell, await read(axCell) - arg)
      pc += 2
    } else if (opcode === 0x32) { // ADDFROM
      await write(axCell, await read(axCell) + await read(memCells[arg]))
      pc += 2
    } else if (opcode === 0x33) { // SUBFROM
      await write(axCell, await read(axCell) - await read(memCells[arg]))
      pc += 2
    } else if (opcode === 0x34) { // MULFROM
      await write(axCell, await read(axCell) * await read(memCells[arg]))
      pc += 2
    } else if (opcode === 0x35) { // DIVFROM
      await write(axCell, divide(await read(axCell), await read(memCells[arg])))
      pc += 2
    } else if (opcode === 0x7F) { // GOTO
      if (await read(axCell) > 0) pc = arg; else pc += 2
    } else if (opcode === 0x80) { // GOTOIF0
      if (await read(axCell) === 0x00) pc = arg; else pc += 2        
    }
    write(pcCell, pc)
    return true 
  }

  const run = async () => {
    halted = false
    let more = true
    pcCell.value = '0'
    axCell.value = ''
    while (more && !halted) {
      more = await step()
    } 
  }

  const setSample = sample => {
    for (let key in memCells) memCells[key].value = ''
    for (let key in sample) 
      memCells[key].value = '' + sample[key]
  }

  const check = (restoring) => {
    document.getElementById('results').innerHTML = ''
    const savedMem = memCells.map(c => c.value)
    let passes = 0
    for (const r of runs) {
      const mem = savedMem.map(m => numValue(m))
      let pc = 0
      let ax = 0
      for (let key in r.before) 
        mem[key] = numValue(r.before[key])
      const MAX_STEPS = 1000
      let more = true
      let steps = 0
      while (more && steps < MAX_STEPS) {
        steps++
        const opcode = opcodeOf(mem[pc])
        if (opcode === 0x00 || !numericOpCodes.includes(opcode))
          more = false
        else {
          const arg = mem[pc + 1]
          if (opcode === 0xA0) { // SAVE
            mem[arg] = ax
            pc += 2
          } else if (opcode === 0xA1) { // LOAD
            ax = mem[arg]
            pc += 2
          } else if (opcode === 0x2C) { // ADDTHIS
            ax = ax + arg
            pc += 2
          } else if (opcode === 0x2D) { // SUBTHIS
            ax = ax - arg
            pc += 2
          } else if (opcode === 0x32) { // ADDFROM
            ax = ax + mem[arg]
            pc += 2
          } else if (opcode === 0x33) { // SUBFROM
            ax = ax - mem[arg]
            pc += 2
          } else if (opcode === 0x34) { // MULFROM
            ax = ax * mem[arg]
            pc += 2
          } else if (opcode === 0x35) { // DIVFROM
            ax = divide(ax, mem[arg])
            pc += 2
          } else if (opcode === 0x7F) { // GOTO
            if (ax > 0) pc = arg; else pc += 2
          } else if (opcode === 0x80) { // GOTOIF0
            if (ax === 0x00) pc = arg; else pc += 2        
          }
        }
      }
      let success = true
      for (let key in r.after) 
        if (mem[key] !== numValue(r.after[key])) success = false
      if (success) passes++
      const liElement = document.createElement('li')
      document.getElementById('results').appendChild(liElement)
      const spanElement = document.createElement('span')
      liElement.textContent = success ? 'Pass' : 'Fail'
      liElement.appendChild(spanElement)
      const buttonElement = document.createElement('button')
      buttonElement.textContent = 'Replay'
      buttonElement.addEventListener('click', () => {
        for (let key in memCells) memCells[key].value = ''
        for (let key in savedMem) 
          memCells[key].value = savedMem[key]
        for (let key in r.before) 
          memCells[key].value = '' + r.before[key]
        run()
      })
      liElement.appendChild(buttonElement)
      if (restoring === undefined)
        EPUB.Education.reportScores([{ location: 'default', score: passes / runs.length, metadata: savedMem }])
    }
  }
  
  const mem = document.getElementById('mem')
  for (let i = 0; i <= 16; i++) {
    const tr = document.createElement('tr')
    mem.appendChild(tr)
    for (let j = 0; j <= 16; j++) {
      const td = document.createElement('td')
      tr.appendChild(td)
      if (i < 16 && j < 16) {
        const input = document.createElement('input')
        input.id = 'mem' + i + j
        input.setAttribute('size', 5)
        td.appendChild(input)
        memCells.push(input)
      }
      else if (i == 16 && j == 16)
        td.textContent = 'Memory'
      else if (i == 16)
        td.textContent = j
      else if (j == 16)
        td.textContent = 16 * i
    }    
  }
  document.getElementById('run').addEventListener('click', run)
  document.getElementById('step').addEventListener('click', step)
  document.getElementById('stop').addEventListener('click', () => { halted = true })
  document.getElementById('sample1').addEventListener('click', () =>
    setSample({ '0': 'load', '1': 99, '2': 'subthis', '3': 1, '4': 'goto', '5': 2, '6': 'stop', '99': 5 }))
  document.getElementById('sample2').addEventListener('click', () =>
    setSample({ '0':'load','1': 255, '2':'addfrom', '3':159,'4':'save','5':255,'6':'load','7':159,'8':'subthis',
                '9':1,'10':'save','11':159,'12':'goto','13':'0','14':'stop',"159":5,"255":0
              }))
  document.getElementById('sample3').addEventListener('click', () =>
    setSample({ '0': 'load', '1': 52, '2': 'addfrom', '3': 50,
                '4': 'save', '5': 50, '6': 'load', '7': 1,
                '8': 'addthis', '9': 1, '10': 'save', '11': 1,
                '12': 'load', '13': 51, '14': 'subthis', '15': 1,
                '16': 'save', '17': 51, '18': 'goto', '19': 0,
                '20': 'stop',
                '50': 0, '51': 5, '52': 10, '53': 20, '54': 30, '55': 40, '56': 50
              }))
  if (typeof runs !== 'undefined') {
    const checkButton = document.createElement('button')
    checkButton.textContent = 'Check'
    document.getElementById('check').appendChild(checkButton)
    checkButton.addEventListener('click', check)
  }
  EPUB.Education.getScores(['default'], (scores) => { 
    for (let key in memCells) memCells[key].value = ''
    for (let key in scores[0].metadata)
      memCells[key].value = scores[0].metadata[key]
    check('restoring')
  })
})
