/**
 * Local estimate ledger. It is deliberately explicit that this is not the
 * platform balance: ordinary MiniMax keys cannot read the account balance
 * (403 `not an admin key`). `current` is a user-set anchor minus estimated
 * spend since that anchor was written.
 */
const MAX_ENTRIES = 5000

function round(value, digits = 4) {
  const factor = 10 ** digits
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor
}

function nowIso() {
  return new Date().toISOString()
}

export class Ledger {
  constructor(store, { log = () => {} } = {}) {
    this.store = store
    this.log = log
    this.state = null
  }

  init() {
    const settings = this.store.getSettings()
    const saved = this.store.readLedger()
    const fallback = {
      anchor: Number(settings.balance.current) || 0,
      anchorAt: settings.balance.updatedAt || nowIso(),
      spend: [],
      alert: { triggered: false, lastAt: '' },
    }
    this.state = saved && typeof saved === 'object' ? { ...fallback, ...saved } : fallback
    if (!Array.isArray(this.state.spend)) this.state.spend = []
    if (!this.state.alert) this.state.alert = { triggered: false, lastAt: '' }
    // A newer anchor in settings wins; otherwise adopt the saved anchor back
    // into settings so both surfaces report the same number.
    const settingsAt = Date.parse(settings.balance.updatedAt || '') || 0
    const ledgerAt = Date.parse(this.state.anchorAt || '') || 0
    if (settingsAt > ledgerAt) {
      this.state.anchor = Number(settings.balance.current) || 0
      this.state.anchorAt = settings.balance.updatedAt
    } else if (this.state.anchorAt && this.state.anchor !== settings.balance.current) {
      this.store.saveSettings({
        balance: { current: round(this.state.anchor, 2), updatedAt: this.state.anchorAt },
      })
    }
    this.persist()
    return this
  }

  persist() {
    this.store.writeLedger({
      version: 1,
      anchor: this.state.anchor,
      anchorAt: this.state.anchorAt,
      spend: this.state.spend,
      alert: this.state.alert,
    })
  }

  /** Clear estimated spend while keeping the user's balance anchor. */
  clearSpend() {
    this.state.spend = []
    this.state.alert.triggered = false
    this.state.alert.lastAt = ''
    this.persist()
  }

  /** Current estimated balance: anchor minus spend after the anchor instant. */
  currentBalance() {
    const since = Date.parse(this.state.anchorAt || '') || 0
    let spent = 0
    for (const entry of this.state.spend) {
      if ((Date.parse(entry.at || '') || 0) >= since) spent += Number(entry.cost) || 0
    }
    return round(this.state.anchor - spent, 4)
  }

  sessionSpend(sessionId) {
    const id = String(sessionId ?? '')
    let total = 0
    for (const entry of this.state.spend) if (String(entry.sessionId ?? '') === id) total += Number(entry.cost) || 0
    return round(total, 4)
  }

  byModel() {
    const map = new Map()
    for (const entry of this.state.spend) {
      const model = String(entry.model || 'unknown')
      const row = map.get(model) ?? { model, count: 0, seconds: 0, images: 0, tokens: 0, cost: 0 }
      row.count += 1
      if (entry.unit === 'second') row.seconds += Number(entry.units) || 0
      else if (entry.unit === 'image') row.images += Number(entry.units) || 0
      else if (entry.unit === 'token') row.tokens += Number(entry.units) || 0
      row.cost = round(row.cost + (Number(entry.cost) || 0), 4)
      map.set(model, row)
    }
    return [...map.values()].sort((a, b) => b.cost - a.cost)
  }

  /** Append one estimated cost and re-evaluate the alert. */
  charge({ taskId, sessionId, kind, model, cost, units, unit, at }) {
    const amount = round(Number(cost) || 0, 4)
    this.state.spend.push({
      taskId: taskId ?? '',
      sessionId: String(sessionId ?? ''),
      kind: kind ?? 'image',
      model: model ?? '',
      cost: amount,
      units: Number(units) || 0,
      unit: unit ?? 'image',
      at: at ?? nowIso(),
    })
    if (this.state.spend.length > MAX_ENTRIES) this.state.spend = this.state.spend.slice(-MAX_ENTRIES)
    this.evaluate()
    this.persist()
    return amount
  }

  setAnchor(value) {
    const current = Number(value)
    if (!Number.isFinite(current)) throw new Error('余额必须是数字。')
    this.state.anchor = round(current, 4)
    this.state.anchorAt = nowIso()
    // A manual anchor also resets the session display's alert flag: the new
    // number decides whether the warning is still true.
    this.state.alert.triggered = false
    this.store.saveSettings({ balance: { current: round(current, 2), updatedAt: this.state.anchorAt } })
    this.evaluate()
    this.persist()
    return this.currentBalance()
  }

  setAlert(patch) {
    const settings = this.store.getSettings()
    const enabled = patch.enabled === undefined ? settings.alert.enabled : Boolean(patch.enabled)
    const raw = patch.threshold === undefined ? settings.alert.threshold : patch.threshold
    if (raw !== undefined && (typeof raw !== 'number' || !Number.isFinite(raw))) {
      throw new Error('预警阈值必须是数字（不做数值范围校验）。')
    }
    const threshold = raw === undefined ? settings.alert.threshold : raw
    this.store.saveSettings({ alert: { enabled, threshold } })
    if (!enabled) this.state.alert.triggered = false
    this.evaluate()
    this.persist()
    return { enabled, threshold, triggered: this.state.alert.triggered }
  }

  evaluate() {
    const settings = this.store.getSettings()
    const { enabled, threshold } = settings.alert
    const current = this.currentBalance()
    const limit = Number(threshold)
    if (!enabled || !Number.isFinite(limit)) {
      this.state.alert.triggered = false
      return { triggered: false }
    }
    if (current < limit) {
      if (!this.state.alert.triggered) {
        this.state.alert.triggered = true
        this.state.alert.lastAt = nowIso()
      }
    } else if (this.state.alert.triggered) {
      // Crossing back above the threshold re-arms the next warning.
      this.state.alert.triggered = false
    }
    return { triggered: this.state.alert.triggered }
  }

  /** Snapshot consumed by the dock, the detail popover, and the settings page. */
  status(sessionId) {
    const settings = this.store.getSettings()
    const current = this.currentBalance()
    const triggered = Boolean(this.state.alert.triggered) && settings.alert.enabled && current < Number(settings.alert.threshold)
    return {
      estimated: true,
      source: settings.balance.source,
      anchor: round(this.state.anchor, 4),
      anchorAt: this.state.anchorAt,
      current: round(current, 2),
      sessionSpend: round(this.sessionSpend(sessionId), 2),
      byModel: this.byModel().map((row) => ({
        ...row,
        cost: round(row.cost, 2),
      })),
      alert: {
        enabled: Boolean(settings.alert.enabled),
        threshold: Number(settings.alert.threshold),
        triggered,
        justTriggered:
          triggered && this.state.alert.lastAt
            ? Date.now() - (Date.parse(this.state.alert.lastAt) || 0) < 8000
            : false,
        lastAt: this.state.alert.lastAt || '',
      },
      pricing: settings.pricing,
    }
  }
}

/** Video cost helper: output seconds times the configured per-second price. */
export function videoCost(outputSeconds, perSecond) {
  return round((Number(outputSeconds) || 0) * (Number(perSecond) || 0), 4)
}

/** Image cost helper: successful images times the configured per-image price. */
export function imageCost(count, perImage) {
  return round((Number(count) || 0) * (Number(perImage) || 0), 4)
}

/** Prompt-enhancement cost helper; zero by default because it is token based. */
export function tokenCost(tokens, per1k) {
  return round(((Number(tokens) || 0) / 1000) * (Number(per1k) || 0), 4)
}
