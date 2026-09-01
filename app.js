/**
 * OmniCalc Core Engine & UI Controller
 */

class Calculator {
  constructor(displayElement, expressionElement, memoryIndicatorElement) {
    this.displayElement = displayElement;
    this.expressionElement = expressionElement;
    this.memoryIndicatorElement = memoryIndicatorElement;
    
    this.currentValue = '0';
    this.expression = '';
    this.waitingForOperand = false;
    this.isAngleDegree = true; // Degrees vs Radians
    this.memory = 0;
    this.history = this.loadHistory();
    
    this.updateDisplay();
  }

  loadHistory() {
    try {
      const stored = localStorage.getItem('omnicalc_history');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  }

  saveHistory() {
    try {
      localStorage.setItem('omnicalc_history', JSON.stringify(this.history.slice(0, 50)));
    } catch (e) {
      console.error('Failed to save calculation history', e);
    }
  }

  inputDigit(digit) {
    if (this.waitingForOperand) {
      this.currentValue = digit;
      this.waitingForOperand = false;
    } else {
      if (this.currentValue === '0' && digit !== '.') {
        this.currentValue = digit;
      } else if (digit === '.' && this.currentValue.includes('.')) {
        return;
      } else {
        this.currentValue += digit;
      }
    }
    this.updateDisplay();
  }

  inputDecimal() {
    if (this.waitingForOperand) {
      this.currentValue = '0.';
      this.waitingForOperand = false;
    } else if (!this.currentValue.includes('.')) {
      this.currentValue += '.';
    }
    this.updateDisplay();
  }

  clear() {
    this.currentValue = '0';
    this.expression = '';
    this.waitingForOperand = false;
    this.updateDisplay();
  }

  delete() {
    if (this.waitingForOperand) return;
    if (this.currentValue.length > 1) {
      this.currentValue = this.currentValue.slice(0, -1);
    } else {
      this.currentValue = '0';
    }
    this.updateDisplay();
  }

  negate() {
    const num = parseFloat(this.currentValue);
    if (!isNaN(num) && num !== 0) {
      this.currentValue = (-num).toString();
      this.updateDisplay();
    }
  }

  percentage() {
    const num = parseFloat(this.currentValue);
    if (!isNaN(num)) {
      this.currentValue = (num / 100).toString();
      this.updateDisplay();
    }
  }

  applyOperator(operator) {
    const sanitizedVal = this.currentValue;
    
    // If already waiting for operand, replace the last operator in expression
    if (this.waitingForOperand && this.expression.length > 0) {
      const lastChar = this.expression.trim().slice(-1);
      if (['+', '-', '*', '/'].includes(lastChar)) {
        this.expression = this.expression.trim().slice(0, -1) + ' ' + operator + ' ';
        this.updateDisplay();
        return;
      }
    }

    this.expression += `${sanitizedVal} ${operator} `;
    this.waitingForOperand = true;
    this.updateDisplay();
  }

  // Scientific Unary Operations
  applyFunction(funcName) {
    const val = parseFloat(this.currentValue);
    if (isNaN(val)) return;

    let result = 0;
    let desc = '';

    switch (funcName) {
      case 'sin': {
        const rad = this.isAngleDegree ? (val * Math.PI) / 180 : val;
        result = Math.sin(rad);
        desc = `sin(${val})`;
        break;
      }
      case 'cos': {
        const rad = this.isAngleDegree ? (val * Math.PI) / 180 : val;
        result = Math.cos(rad);
        desc = `cos(${val})`;
        break;
      }
      case 'tan': {
        const rad = this.isAngleDegree ? (val * Math.PI) / 180 : val;
        result = Math.tan(rad);
        desc = `tan(${val})`;
        break;
      }
      case 'sqrt': {
        if (val < 0) {
          this.currentValue = 'Error';
          this.updateDisplay();
          return;
        }
        result = Math.sqrt(val);
        desc = `√(${val})`;
        break;
      }
      case 'square': {
        result = Math.pow(val, 2);
        desc = `sqr(${val})`;
        break;
      }
      case 'log': {
        if (val <= 0) {
          this.currentValue = 'Error';
          this.updateDisplay();
          return;
        }
        result = Math.log10(val);
        desc = `log(${val})`;
        break;
      }
      case 'ln': {
        if (val <= 0) {
          this.currentValue = 'Error';
          this.updateDisplay();
          return;
        }
        result = Math.log(val);
        desc = `ln(${val})`;
        break;
      }
      case 'fact': {
        if (val < 0 || !Number.isInteger(val)) {
          this.currentValue = 'Error';
          this.updateDisplay();
          return;
        }
        result = this.factorial(val);
        desc = `fact(${val})`;
        break;
      }
      case 'abs': {
        result = Math.abs(val);
        desc = `abs(${val})`;
        break;
      }
      default:
        return;
    }

    // Clean floating point errors (e.g. 0.0000000000000001)
    result = this.cleanPrecision(result);
    this.expression = desc;
    this.currentValue = result.toString();
    this.waitingForOperand = true;
    this.updateDisplay();
  }

  factorial(n) {
    if (n === 0 || n === 1) return 1;
    if (n > 170) return Infinity; // max js float limit
    let fact = 1;
    for (let i = 2; i <= n; i++) fact *= i;
    return fact;
  }

  insertConstant(type) {
    if (type === 'pi') {
      this.currentValue = Math.PI.toString();
    } else if (type === 'e') {
      this.currentValue = Math.E.toString();
    }
    this.waitingForOperand = false;
    this.updateDisplay();
  }

  evaluate() {
    if (!this.expression && !this.waitingForOperand) return;

    let fullExpression = this.expression + this.currentValue;
    try {
      // Tokenize and safely evaluate arithmetic expression
      const sanitized = fullExpression.replace(/×/g, '*').replace(/÷/g, '/');
      const result = this.safeCalculate(sanitized);
      
      if (!isFinite(result) || isNaN(result)) {
        this.currentValue = 'Error';
      } else {
        const formattedResult = this.cleanPrecision(result).toString();
        this.addHistoryRecord(fullExpression, formattedResult);
        this.currentValue = formattedResult;
      }
    } catch (e) {
      this.currentValue = 'Error';
    }

    this.expression = '';
    this.waitingForOperand = true;
    this.updateDisplay();
  }

  safeCalculate(expr) {
    // Function constructor parser with strict mathematical whitelist
    const cleanExpr = expr.replace(/[^0-9+\-*/.()eE ]/g, '');
    // eslint-disable-next-line no-new-func
    return Function(`'use strict'; return (${cleanExpr})`)();
  }

  cleanPrecision(num) {
    return Math.round((num + Number.EPSILON) * 1e12) / 1e12;
  }

  // Memory Ops
  memoryClear() {
    this.memory = 0;
    this.updateMemoryIndicator();
  }

  memoryRecall() {
    this.currentValue = this.memory.toString();
    this.waitingForOperand = false;
    this.updateDisplay();
  }

  memoryAdd() {
    const val = parseFloat(this.currentValue);
    if (!isNaN(val)) {
      this.memory += val;
      this.updateMemoryIndicator();
    }
  }

  memorySubtract() {
    const val = parseFloat(this.currentValue);
    if (!isNaN(val)) {
      this.memory -= val;
      this.updateMemoryIndicator();
    }
  }

  memoryStore() {
    const val = parseFloat(this.currentValue);
    if (!isNaN(val)) {
      this.memory = val;
      this.updateMemoryIndicator();
    }
  }

  updateMemoryIndicator() {
    if (this.memory !== 0) {
      this.memoryIndicatorElement.classList.remove('hidden');
    } else {
      this.memoryIndicatorElement.classList.add('hidden');
    }
  }

  toggleAngleMode(indicatorElem) {
    this.isAngleDegree = !this.isAngleDegree;
    indicatorElem.textContent = this.isAngleDegree ? 'DEG' : 'RAD';
  }

  addHistoryRecord(expr, res) {
    this.history.unshift({ expr, res, time: new Date().toLocaleTimeString() });
    this.saveHistory();
    renderHistory();
  }

  clearHistory() {
    this.history = [];
    this.saveHistory();
    renderHistory();
  }

  updateDisplay() {
    this.displayElement.textContent = this.currentValue;
    this.expressionElement.textContent = this.expression;

    // Dynamically adjust font-size if digits overflow
    if (this.currentValue.length > 12) {
      this.displayElement.style.fontSize = '1.75rem';
    } else if (this.currentValue.length > 8) {
      this.displayElement.style.fontSize = '2.1rem';
    } else {
      this.displayElement.style.fontSize = '2.5rem';
    }
  }
}

/* ==========================================================================
   UI Initialization & Event Listeners
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  const displayEl = document.getElementById('main-display');
  const exprEl = document.getElementById('expression-display');
  const memIndicator = document.getElementById('memory-indicator');
  const angleIndicator = document.getElementById('angle-mode-indicator');
  const modeIndicator = document.getElementById('mode-indicator');
  const sciKeypad = document.getElementById('scientific-keypad');
  const appContainer = document.querySelector('.app-container');
  const historyPanel = document.getElementById('history-panel');
  const historyList = document.getElementById('history-list');

  const calc = new Calculator(displayEl, exprEl, memIndicator);

  // Render saved history
  window.renderHistory = function() {
    if (!historyList) return;
    if (calc.history.length === 0) {
      historyList.innerHTML = '<p class="empty-history-msg">There\'s no calculation history yet.</p>';
      return;
    }

    historyList.innerHTML = '';
    calc.history.forEach((item, index) => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'history-item';
      itemDiv.innerHTML = `
        <div class="history-expr">${item.expr} =</div>
        <div class="history-res">${item.res}</div>
      `;
      itemDiv.addEventListener('click', () => {
        calc.currentValue = item.res.toString();
        calc.expression = '';
        calc.waitingForOperand = false;
        calc.updateDisplay();
        historyPanel.classList.add('hidden');
      });
      historyList.appendChild(itemDiv);
    });
  };
  renderHistory();

  // Button Event Delegation
  document.querySelector('.app-container').addEventListener('click', (e) => {
    const target = e.target.closest('button');
    if (!target) return;

    // Number input
    if (target.dataset.number !== undefined) {
      calc.inputDigit(target.dataset.number);
      return;
    }

    // Basic operators
    if (target.dataset.operator) {
      calc.applyOperator(target.dataset.operator);
      return;
    }

    // Action handlers
    const action = target.dataset.action;
    if (!action) return;

    switch (action) {
      case 'clear': calc.clear(); break;
      case 'delete': calc.delete(); break;
      case 'equals': calc.evaluate(); break;
      case 'percent': calc.percentage(); break;
      case 'negate': calc.negate(); break;
      case 'toggle-angle': calc.toggleAngleMode(angleIndicator); break;
      
      // Memory
      case 'mc': calc.memoryClear(); break;
      case 'mr': calc.memoryRecall(); break;
      case 'm-plus': calc.memoryAdd(); break;
      case 'm-minus': calc.memorySubtract(); break;
      case 'ms': calc.memoryStore(); break;
      
      // Scientific unary/constants
      case 'sin':
      case 'cos':
      case 'tan':
      case 'sqrt':
      case 'square':
      case 'log':
      case 'ln':
      case 'fact':
      case 'abs':
        calc.applyFunction(action);
        break;
      case 'pi':
      case 'e':
        calc.insertConstant(action);
        break;
      case 'power':
        calc.applyOperator('**');
        break;
      case 'open-paren':
        calc.expression += '(';
        calc.updateDisplay();
        break;
      case 'close-paren':
        calc.expression += `${calc.currentValue})`;
        calc.waitingForOperand = true;
        calc.updateDisplay();
        break;
    }
  });

  // Header Controls (Mode, History, Theme)
  const modeBtn = document.getElementById('mode-toggle-btn');
  const historyBtn = document.getElementById('history-toggle-btn');
  const closeHistoryBtn = document.getElementById('close-history-btn');
  const clearHistoryBtn = document.getElementById('clear-history-btn');
  const themeBtn = document.getElementById('theme-toggle-btn');

  modeBtn.addEventListener('click', () => {
    const isCollapsed = sciKeypad.classList.contains('collapsed');
    if (isCollapsed) {
      sciKeypad.classList.remove('collapsed');
      modeIndicator.textContent = 'SCIENTIFIC';
      modeBtn.querySelector('.mode-badge').classList.add('active');
      appContainer.classList.add('expanded');
    } else {
      sciKeypad.classList.add('collapsed');
      modeIndicator.textContent = 'BASIC';
      modeBtn.querySelector('.mode-badge').classList.remove('active');
      appContainer.classList.remove('expanded');
    }
  });

  historyBtn.addEventListener('click', () => {
    historyPanel.classList.toggle('hidden');
  });

  closeHistoryBtn.addEventListener('click', () => {
    historyPanel.classList.add('hidden');
  });

  clearHistoryBtn.addEventListener('click', () => {
    calc.clearHistory();
  });

  // Theme Switcher
  themeBtn.addEventListener('click', () => {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', newTheme);
    
    document.getElementById('theme-icon-dark').classList.toggle('hidden', newTheme === 'light');
    document.getElementById('theme-icon-light').classList.toggle('hidden', newTheme === 'dark');
  });

  // Full Keyboard Shortcuts Support
  window.addEventListener('keydown', (e) => {
    if (e.key >= '0' && e.key <= '9') {
      calc.inputDigit(e.key);
    } else if (e.key === '.') {
      calc.inputDecimal();
    } else if (['+', '-', '*', '/'].includes(e.key)) {
      calc.applyOperator(e.key);
    } else if (e.key === 'Enter' || e.key === '=') {
      e.preventDefault();
      calc.evaluate();
    } else if (e.key === 'Backspace') {
      calc.delete();
    } else if (e.key === 'Escape') {
      calc.clear();
    } else if (e.key === '%') {
      calc.percentage();
    }
  });
});