/* eslint-disable no-undef */

import React from 'react'
import { shallow, mount, render } from 'enzyme'
import skipIf from 'skip-if'

import Terminal from '../src/components/Terminal'

const skipIfDepTestOnly = skipIf(process.env.DEPTEST)

const commands = {
  echo: {
    description: 'Echo a passed string.',
    usage: 'echo <string>',
    fn: function () {
      return `${Array.from(arguments).join(' ')}`
    }
  },
  ping: {
    description: 'Tells you pong!',
    fn: () => 'Pong!'
  },
  danger: {
    fn: () => '<div style="color: red;>danger mode enabled</div>'
  }
}

const changedCommands = {
  changedEcho: {
    description: 'This was not here before.',
    usage: 'echo <string>',
    fn: function () {
      return `${Array.from(arguments).join(' ')}`
    }
  }
}

const newDefaultCommands = {
  help: {
    description: 'New help command',
    fn: () => 'This is a new help command'
  },
  validation: {
    description: 'This is to make sure this object registered',
    fn: () => 'valid'
  }
}

beforeAll(async () => {
  await page.goto('http://localhost:8000')
})

describe('Terminal HTML structure', () => {
  it('Has required elements', () => {
    const wrapper = shallow(<Terminal commands={commands}/>)

    expect(wrapper.find('[name="react-console-emulator"]')).toHaveLength(1)
    expect(wrapper.find('[name="react-console-emulator__content"]')).toHaveLength(1)
    expect(wrapper.find('[name="react-console-emulator__inputArea"]')).toHaveLength(1)
    expect(wrapper.find('[name="react-console-emulator__input"]')).toHaveLength(1)
  })
})

describe('Terminal welcome messages', () => {
  it('Displays default welcome', () => {
    const wrapper = mount(<Terminal commands={commands} welcomeMessage={true}/>)
    const content = wrapper.find('[name="react-console-emulator__content"]')

    expect(content.childAt(0).text()).toBe('Welcome to the React terminal! Type \'help\' to get a list of commands.')

    wrapper.unmount()
  })

  it('Displays custom welcomes', () => {
    const wrapperSingle = mount(<Terminal commands={commands} welcomeMessage={'test'}/>)
    const wrapperMulti = mount(<Terminal commands={commands} welcomeMessage={['test', 'test2']}/>)

    const singleContent = wrapperSingle.find('[name="react-console-emulator__content"]')
    const multiContent = wrapperMulti.find('[name="react-console-emulator__content"]')

    // Renders single string correctly
    expect(singleContent.childAt(0).text()).toBe('test')

    // Renders array of strings correctly
    expect(multiContent.children('p')).toHaveLength(2)
    expect(multiContent.childAt(0).text()).toBe('test')
    expect(multiContent.childAt(1).text()).toBe('test2')

    wrapperSingle.unmount()
    wrapperMulti.unmount()
  })
})

describe('Terminal functionality', () => {
  it('Validates commands when they update', () => {
    const wrapper = mount(<Terminal commands={commands}/>)

    expect(wrapper.state().commands).toHaveProperty('echo')
    wrapper.setProps({ commands: changedCommands })
    expect(wrapper.state().commands).not.toHaveProperty('echo')
    expect(wrapper.state().commands).toHaveProperty('changedEcho')

    wrapper.unmount()
  })

  it('Registers new default commands', () => {
    const wrapper = mount(<Terminal commands={newDefaultCommands} noDefaults={true}/>)

    expect(wrapper.state().commands).toHaveProperty('validation')
    expect(wrapper.state().commands).toHaveProperty('help')

    wrapper.unmount()
  })
})

describe('Terminal user interactivity', () => {
  // Helper functions for common testing functions

  async function enterCommand (command) {
    await page.click('[name="react-console-emulator"]')
    if (command) await page.keyboard.type(command)
    await page.keyboard.press('Enter', { delay: '10' })
  }

  async function getStdout (whichTerminal) {
    const output = await page.evaluate(whichTerminal => {
      const elements = Array.from(document.querySelectorAll('[name="react-console-emulator__content"]'))
      return elements[whichTerminal || 0].innerText.trim().replace(/\n/gi, '|')
    })

    return output
  }

  async function getInputValue (whichTerminal) {
    const output = await page.evaluate(whichTerminal => {
      const elements = Array.from(document.querySelectorAll('[name="react-console-emulator__input"]'))
      return elements[whichTerminal || 0].value
    })

    return output
  }

  async function clearStdout () {
    await page.keyboard.type('clear')
    await page.keyboard.press('Enter', { delay: '10' })
  }

  skipIfDepTestOnly('Outputs blank on no input', async () => {
    await enterCommand()
    const output = await getStdout()

    expect(output).toBe('$||$')
    await clearStdout()
  })

  skipIfDepTestOnly('Outputs error on bad command', async () => {
    await enterCommand('doot')
    const output = await getStdout()

    expect(output.split('||')[1]).toBe('Command \'doot\' not found!')
    await clearStdout()
  })

  skipIfDepTestOnly('Outputs a command response correctly', async () => {
    await enterCommand('echo test')
    const output = await getStdout()

    expect(output.split('||')[1]).toBe('test')
    await clearStdout()
  })

  skipIfDepTestOnly('Outputs help', async () => {
    await enterCommand('help')
    const output = await getStdout()

    expect(output.split('||')[1]).toBe('help - Show a list of available commands.')
    await clearStdout()
  })

  skipIfDepTestOnly('Shows history and reacts appropriately', async () => {
    await enterCommand('echo test')
    await page.keyboard.press('ArrowUp')
    expect(await getInputValue()).toBe('echo test')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown') // Temp workaround
    expect(await getInputValue()).toBe('')
  })
})
